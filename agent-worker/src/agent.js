import { AISdkClient, Stagehand } from "@browserbasehq/stagehand";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

import { FRICTION_SCRIPT } from "./friction.js";
import { VITALS_INIT, VITALS_READ } from "./vitals.js";
import { dismissOverlays } from "./overlays.js";

/**
 * Drives a real cloud browser from an entry URL through to the cart, emitting
 * the same ForensicAuditReport shape the UI already renders.
 *
 * The loop is goal-driven, not a fixed script: at each step it asks what the
 * page is and what the next move toward the cart is. That is what lets a
 * two-step Shopify store and a six-step cruise booking share one code path.
 */

const MAX_STEPS = Number(process.env.AGENT_MAX_STEPS || 16);
/** Long booking flows need room; the budget stops a runaway from burning credits. */
const RUN_BUDGET_MS = Number(process.env.AGENT_BUDGET_MS || 6 * 60 * 1000);
/** Stop expensive browser calls that can otherwise sit unresolved for minutes. */
const ACTION_TIMEOUT_MS = Number(process.env.AGENT_ACTION_TIMEOUT_MS || 30 * 1000);
/** Two consecutive turns with no visible progress are enough evidence to stop. */
const MAX_STALLED_ATTEMPTS = Number(process.env.AGENT_MAX_STALLED_ATTEMPTS || 2);

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.ceil(timeoutMs / 1000)}s`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The API key alone identifies the account, so the project id is looked up
 * rather than asked for. Cached for the life of the process.
 */
let cachedProjectId = null;
async function resolveProjectId() {
  if (process.env.BROWSERBASE_PROJECT_ID) return process.env.BROWSERBASE_PROJECT_ID;
  if (cachedProjectId) return cachedProjectId;
  const response = await fetch("https://api.browserbase.com/v1/projects", {
    headers: { "X-BB-API-Key": process.env.BROWSERBASE_API_KEY || "" },
  });
  if (!response.ok) {
    throw new Error(`Could not resolve a Browserbase project (HTTP ${response.status}).`);
  }
  const projects = await response.json();
  const id = Array.isArray(projects) ? projects[0]?.id : projects?.id;
  if (!id) throw new Error("The Browserbase account has no projects.");
  cachedProjectId = id;
  return id;
}

// Deliberately generic. A shoe store's journey is listing -> product -> cart;
// a cruise line's is listing (sailings) -> detail (itinerary) -> options
// (cabin) -> form (guests) -> summary -> cart. One vocabulary covers both.
const stageKind = z.enum([
  "category",
  "listing",
  "product",
  "detail",
  "variant",
  "options",
  "form",
  "mini-cart",
  "summary",
  "cart",
  "checkout",
  "other",
]);

const KIND_LABELS = {
  category: "Category",
  listing: "Listing",
  product: "Product page",
  detail: "Detail page",
  variant: "Variant selected",
  options: "Options",
  form: "Details form",
  "mini-cart": "Mini-cart",
  summary: "Summary",
  cart: "Cart",
  checkout: "Checkout",
  other: "Step",
};

/**
 * The model sometimes hands back an element caption ("0-2289", "ADD TO CART - $100")
 * instead of a stage name, which reads as noise in the journey strip. Anything
 * that isn't a short, wordy label falls back to the stage kind.
 */
function cleanLabel(label, kind) {
  const fallback = KIND_LABELS[kind] || "Stage";
  const text = (label || "").trim();
  if (!text || text.length > 32) return fallback;
  if (!/[a-z]/i.test(text)) return fallback;
  if (/^[\d\W]/.test(text)) return fallback;
  if (/\$|\d{3,}/.test(text)) return fallback;
  return text;
}

function log(steps, actor, text, tone = "normal") {
  steps.push({ actor, text, delay_ms: 260, tone });
}

/**
 * A cheap fingerprint of what the shopper can currently see. Used to tell a
 * click that actually moved the journey from one that silently did nothing —
 * without it the run captures the same screen three times and calls it a
 * journey (which is exactly what happened on stores with overlay pickers).
 */
const PAGE_SIGNATURE = `(() => {
  const text = (document.body ? document.body.innerText : "").replace(/\\s+/g, " ").slice(0, 1200);
  const dialogs = document.querySelectorAll('[role=dialog],[aria-modal=true],dialog[open]').length;
  return location.href + "|" + dialogs + "|" + document.title + "|" + text;
})()`;

async function readSignature(page) {
  try {
    return await page.evaluate(PAGE_SIGNATURE);
  } catch {
    return String(Math.random());
  }
}

/** Wait until the page stops changing, or the budget runs out. */
async function settle(page, before, budgetMs = 9000) {
  const deadline = Date.now() + budgetMs;
  let last = before;
  while (Date.now() < deadline) {
    await page.waitForTimeout(700);
    const now = await readSignature(page);
    if (now !== before) {
      // Changed — give it one more quiet tick so async carts finish rendering.
      if (now === last) return true;
      last = now;
    }
  }
  return (await readSignature(page)) !== before;
}

/**
 * Category pages are where act() most often no-ops (product tiles are often
 * image-only links). Falling back to the first plausible product href keeps
 * the journey moving instead of screenshotting the grid again.
 */
async function firstProductHref(page) {
  try {
    return await page.evaluate(`(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const hit = links.find((a) => /\\/(products?|p|item|shop\\/[^/]+\\/[^/]+)\\//i.test(a.getAttribute('href') || ''));
      return hit ? hit.href : null;
    })()`);
  } catch {
    return null;
  }
}

/**
 * What can actually be clicked right now, in the model's own words. Feeding
 * this in is what lets the planner cope with a cruise line's cabin grid or a
 * dropdown size picker without any per-site rules.
 */
async function visibleControls(page) {
  try {
    const found = await page.observe(
      "List the interactive controls on this page that could move a shopper forward: product links, size/colour/date/cabin selectors, dropdowns, quantity controls, add-to-cart, continue, and cart links.",
    );
    return (found || [])
      .map((item) => (item.description || "").trim())
      .filter(Boolean)
      .slice(0, 14);
  } catch {
    return [];
  }
}

/** Heuristic backstop for "is there something in the basket yet". */
const CART_CHECK = `(() => {
  const text = (document.body ? document.body.innerText : "").toLowerCase();
  const cartish = /(subtotal|order summary|booking summary|your (cart|bag|basket)|proceed to checkout|checkout now)/.test(text);
  const empty = /(cart is empty|bag is empty|basket is empty|no items in your)/.test(text);
  return cartish && !empty;
})()`;

async function captureStage(page, { kind, label: rawLabel, transition }) {
  const label = cleanLabel(rawLabel, kind);
  const [metrics, friction, shot, size] = await Promise.all([
    page.evaluate(VITALS_READ),
    page.evaluate(FRICTION_SCRIPT),
    page.screenshot({ fullPage: true, type: "jpeg", quality: 70 }),
    page.evaluate(
      `({ width: window.innerWidth, height: Math.max(document.documentElement.scrollHeight, window.innerHeight) })`,
    ),
  ]);

  return {
    id: `${kind}-${Date.now()}`,
    kind,
    label,
    url: page.url(),
    transition_in: transition,
    screenshot: {
      src: `data:image/jpeg;base64,${shot.toString("base64")}`,
      width: size.width,
      height: size.height,
      caption: `${label} — captured at ${size.width}×${size.height}`,
    },

    technical_metrics: metrics,
    friction_points: friction,
  };
}

export async function runJourney(entryUrl, { onLog } = {}) {
  const startedAt = Date.now();
  const steps = [];
  const stages = [];
  const consoleErrors = [];
  const emit = (actor, text, tone) => {
    log(steps, actor, text, tone);
    onLog?.({ actor, text, tone });
  };

  const projectId = await resolveProjectId();

  // Stagehand's built-in model routing only knows a fixed list of providers
  // and ignores a custom base URL, so the LLM is wired explicitly through the
  // AI SDK. Any OpenAI-compatible endpoint works: OpenAI, OpenRouter, etc.
  const provider = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    compatibility: process.env.OPENAI_BASE_URL ? "compatible" : "strict",
  });

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    // Run the agent loop in this process against the remote browser; the
    // hosted Stagehand API does not accept a custom LLM provider.
    useAPI: false,
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId,
    llmClient: new AISdkClient({
      model: provider(process.env.STAGEHAND_MODEL || "gpt-4.1-mini"),
    }),

    browserbaseSessionCreateParams: {
      projectId,
      // Residential proxies and Verified (advanced stealth) mode are paid /
      // enterprise features: requesting them on a free plan makes session
      // creation fail outright, so both are opt-in via env.
      ...(process.env.BROWSERBASE_PROXIES === "true" ? { proxies: true } : {}),
      browserSettings: {
        ...(process.env.BROWSERBASE_STEALTH === "true" ? { advancedStealth: true } : {}),
        viewport: { width: 1280, height: 900 },
        solveCaptchas: true,
      },
    },
  });

  let status = "complete";
  let blockedReason = null;

  try {
    await stagehand.init();
    const page = stagehand.page;
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 240));
    });
    await page.addInitScript(VITALS_INIT);

    emit("system", `Opening ${entryUrl} in a cloud browser`);
    const t0 = Date.now();
    await page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);

    const wall = await page.evaluate(
      `/just a moment|robot or human|are you a (human|robot)|verify you are|captcha|access denied/i.test(document.body.innerText || '')`,
    );
    if (wall) {
      status = "partial";
      blockedReason =
        "The target served a bot-protection challenge instead of the page. Retry with a different target or a residential proxy region.";
      emit("browser", blockedReason, "error");
    }

    // First-visit interstitials often fire on a timer, so sweep twice.
    await dismissOverlays(page, { emit, deep: true });
    await page.waitForTimeout(1800);
    await dismissOverlays(page, { emit, deep: true });

    let kind = "other";
    let entryLabel = "";
    if (!wall) {
      const classified = await stagehand.page.extract({
        instruction:
          "What kind of page is this in a buying journey? listing = several items to choose from, detail = one item with a buy or book control, options = choosing size/colour/date/cabin/room, form = entering traveller or shopper details, summary = a review step, cart = a basket with items, checkout = payment.",
        schema: z.object({ kind: stageKind, label: z.string() }),
      });
      kind = classified.kind;
      entryLabel = classified.label;
    }

    stages.push(
      await captureStage(page, { kind, label: entryLabel || KIND_LABELS[kind], transition: null }),
    );
    emit("browser", `Landed on ${KIND_LABELS[kind] || kind} in ${Date.now() - t0}ms`, "success");

    // The goal loop. Nothing here is store-specific: every turn the model sees
    // where it is, what it can click, and what has already been tried, then
    // proposes the next one-to-three moves. That is the same code path for a
    // two-step Shopify store and a six-step cruise booking.
    const history = [];
    const deadline = startedAt + RUN_BUDGET_MS;
    let reachedGoal = false;
    let stalledAttempts = 0;
    let overlayRetryUsed = false;

    for (let step = 0; !wall && step < MAX_STEPS && Date.now() < deadline; step += 1) {
      await withTimeout(dismissOverlays(page, { emit }), ACTION_TIMEOUT_MS, "Clearing pop-ups").catch(
        () => {},
      );

      const controls = await withTimeout(
        visibleControls(page),
        ACTION_TIMEOUT_MS,
        "Reading page controls",
      );

      const decision = await withTimeout(stagehand.page.extract({
        instruction:
          "GOAL: get one bookable or purchasable item into the cart / booking summary on this site. " +
          "The site may need anywhere from one to six steps: opening an item from a listing, choosing required options " +
          "(size, colour, date, sailing, cabin, room, guests) using swatches, dropdowns or steppers, filling a short " +
          "required form, then adding to cart or continuing to a summary. Work out the site's own flow — do not assume " +
          "a standard retail checkout. " +
          `You are on ${page.url()}. ` +
          (controls.length
            ? `Controls visible right now: ${controls.map((c) => `"${c}"`).join(", ")}. `
            : "") +
          (history.length
            ? `Already attempted (never repeat one marked no effect — pick a different control or route): ${history.map((h) => `"${h}"`).join(", ")}. `
            : "") +
          "If a cookie banner, newsletter modal, region picker or any other pop-up is covering the page, your first move must close or accept it. " +
          "Return the next 1-3 moves that belong together (for example: open the size dropdown, then choose an available size). " +
          "Set done=true only when the current page already shows the item in a cart or booking summary.",
        schema: z.object({
          done: z.boolean(),
          note: z
            .string()
            .describe("One short plain-English sentence about what you are doing and why"),
          actions: z
            .array(z.string())
            .describe("Imperative browser instructions, e.g. 'click the Add to Bag button'"),
          resulting_kind: stageKind,
          label: z.string(),
        }),
      }), ACTION_TIMEOUT_MS, "Planning the next move");

      if (decision.done) {
        reachedGoal = true;
        emit("system", "Item is in the cart — journey complete", "success");
        break;
      }

      const moves = (decision.actions || []).filter(Boolean).slice(0, 3);
      if (moves.length === 0) break;

      if (decision.note) emit("vision", decision.note);

      const tAct = Date.now();
      const before = await readSignature(page);
      let failure = null;

      for (const move of moves) {
        emit("vision", move);
        try {
          await withTimeout(stagehand.page.act(move), ACTION_TIMEOUT_MS, `Action: ${move}`);
        } catch (error) {
          failure = error.message.slice(0, 120);
          break;
        }
        await settle(page, await readSignature(page), 4000);
      }

      if (failure) {
        // A pop-up that appeared mid-turn is the most common cause of an
        // action timing out. Clear it and give this turn one free retry.
        const { blocker, cleared } = await withTimeout(
          dismissOverlays(page, { emit, deep: true }),
          ACTION_TIMEOUT_MS,
          "Clearing pop-ups",
        ).catch(() => ({ blocker: null, cleared: 0 }));
        if ((cleared > 0 || blocker === null) && !overlayRetryUsed) {
          overlayRetryUsed = true;
          emit("system", "Cleared what was in the way — retrying that step");
          step -= 1;
          continue;
        }
        emit("browser", `That didn't work — ${failure}`, "warn");
        history.push(`${moves[0]} (failed)`);
        stalledAttempts += 1;
        if (stalledAttempts >= MAX_STALLED_ATTEMPTS) {
          blockedReason = `The page stopped responding after ${stalledAttempts} attempts, so the run was ended early to conserve browser minutes.`;
          emit("system", blockedReason, "error");
          break;
        }
        continue;
      }

      let moved = (await readSignature(page)) !== before || (await settle(page, before, 4000));

      // Recovery ladder — nothing on screen changed, so the clicks landed on
      // nothing. Reveal more of the page, then fall back to a real link.
      if (!moved) {
        const { cleared } = await dismissOverlays(page, { emit, deep: true });
        if (cleared > 0) {
          await page.waitForTimeout(600);
          moved = (await readSignature(page)) !== before;
        }
      }
      if (!moved) {
        await page.evaluate(`window.scrollBy(0, window.innerHeight * 1.2)`).catch(() => {});
        await page.waitForTimeout(900);
        moved = (await readSignature(page)) !== before;
      }
      if (!moved) {
        const href = await firstProductHref(page);
        if (href && href !== page.url()) {
          emit("system", "That control did nothing — opening the item directly");
          await page.goto(href, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
          await dismissOverlays(page, { emit });
          moved = (await readSignature(page)) !== before;
        }
      }

      if (!moved) {
        history.push(`${moves.join(" then ")} (no visible effect)`);
        emit("browser", "Nothing on the page changed — trying another route", "warn");
        stalledAttempts += 1;
        if (stalledAttempts >= MAX_STALLED_ATTEMPTS) {
          blockedReason = `The page did not change after ${stalledAttempts} different attempts, so the run was ended early to conserve browser minutes.`;
          emit("system", blockedReason, "error");
          break;
        }
        continue;
      }

      stalledAttempts = 0;
      history.push(moves.join(" then "));
      await dismissOverlays(page, { emit });

      const stage = await captureStage(page, {
        kind: decision.resulting_kind,
        label: decision.label,
        transition: { action: moves.join(" then "), duration_ms: Date.now() - tAct },
      });
      stages.push(stage);
      emit("browser", `${stage.label} captured in ${Date.now() - tAct}ms`, "success");

      if (await page.evaluate(CART_CHECK).catch(() => false)) {
        reachedGoal = true;
        emit("system", "Item is in the cart — journey complete", "success");
        break;
      }
    }

    // Many stores add to cart via a drawer and never navigate, so the loop can
    // end one hop short of a cart page. Try the conventional cart URL. This is
    // a convention, not a requirement: flows without one just stay partial.
    if (!wall && !reachedGoal) {
      try {
        const cartUrl = new URL("/cart", page.url()).toString();
        emit("system", `No cart captured yet — trying ${cartUrl}`);
        const tCart = Date.now();
        await page.goto(cartUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(2000);
        if (await page.evaluate(CART_CHECK).catch(() => false)) {
          stages.push(
            await captureStage(page, {
              kind: "cart",
              label: "Cart",
              transition: {
                action: "open the cart page directly",
                duration_ms: Date.now() - tCart,
              },
            }),
          );
          emit("browser", `Cart captured in ${Date.now() - tCart}ms`, "success");
          reachedGoal = true;
          blockedReason = null;
          status = "complete";
        }
      } catch {
        /* no conventional cart URL — handled below */
      }
    }

    if (!reachedGoal && !blockedReason) {
      status = "partial";
      blockedReason = `The run captured ${stages.length} step${stages.length === 1 ? "" : "s"} but never reached a cart or booking summary.`;
    }
  } catch (error) {
    status = "partial";
    blockedReason = error.message.slice(0, 240);
    emit("system", blockedReason, "error");
  } finally {
    await stagehand.close().catch(() => {});
  }

  // Console errors are collected per run; attribute them to the last stage.
  const last = stages[stages.length - 1];
  if (last && consoleErrors.length > 0) {
    last.technical_metrics.console_errors = [...new Set(consoleErrors)].slice(0, 8);
  }

  if (stages.length === 0) {
    throw new Error(blockedReason || "The run produced no stages.");
  }

  // Journey strips read badly with two "Category" chips in a row; number repeats.
  const seen = new Map();
  for (const stage of stages) {
    const count = (seen.get(stage.label) || 0) + 1;
    seen.set(stage.label, count);
    if (count > 1) stage.label = `${stage.label} ${count}`;
  }

  const host = new URL(entryUrl).hostname.replace(/^www\./, "");
  return {
    id: `live-${Date.now().toString(36)}`,
    url: entryUrl,
    domain: host,
    status,
    blocked_reason: blockedReason,
    captured_at: new Date().toISOString(),
    run_duration_ms: Date.now() - startedAt,
    steps,
    stages,
  };
}
