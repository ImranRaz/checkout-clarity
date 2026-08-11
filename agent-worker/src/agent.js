import { AISdkClient, Stagehand } from "@browserbasehq/stagehand";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

import { FRICTION_SCRIPT, PAGE_DIGEST_SCRIPT } from "./friction.js";
import { createReviewer } from "./ux-review.js";
import { VITALS_INIT, VITALS_READ } from "./vitals.js";
import { dismissOverlays } from "./overlays.js";
import { isExhaustedStatus, keyLabel, loadKeys, rotationOrder } from "./keys.js";

/**
 * Drives a real cloud browser from an entry URL through to the cart, emitting
 * the same ForensicAuditReport shape the UI already renders.
 *
 * The loop is goal-driven, not a fixed script: at each step it asks what the
 * page is and what the next move toward the cart is. That is what lets a
 * two-step Shopify store and a six-step cruise booking share one code path.
 */

const MAX_STEPS = Number(process.env.AGENT_MAX_STEPS || 22);
/** Long booking flows need room; the budget stops a runaway from burning credits. */
const RUN_BUDGET_MS = Number(process.env.AGENT_BUDGET_MS || 8 * 60 * 1000);
/**
 * Stop expensive browser calls that can otherwise sit unresolved for minutes.
 * Acting on a heavy retail page (variant pickers, lazy media) routinely takes
 * longer than planning does, so the two get separate budgets — a single 30s
 * cap was ending runs on sites that were merely slow, not stuck.
 */
const ACTION_TIMEOUT_MS = Number(process.env.AGENT_ACTION_TIMEOUT_MS || 60 * 1000);
const THINK_TIMEOUT_MS = Number(process.env.AGENT_THINK_TIMEOUT_MS || 35 * 1000);
/** Three consecutive turns with no visible progress are enough evidence to stop. */
const MAX_STALLED_ATTEMPTS = Number(process.env.AGENT_MAX_STALLED_ATTEMPTS || 3);
/** Findings are judged against the form factor actually being driven. */
const DEVICE = process.env.AGENT_DEVICE || "desktop";

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.ceil(timeoutMs / 1000)}s`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The API key alone identifies the account, so the project id is looked up
 * rather than asked for. Cached per key for the life of the process.
 */
const projectIdCache = new Map();
async function resolveProjectId(key) {
  if (process.env.BROWSERBASE_PROJECT_ID && loadKeys().length <= 1) {
    return process.env.BROWSERBASE_PROJECT_ID;
  }
  if (projectIdCache.has(key)) return projectIdCache.get(key);
  const response = await fetch("https://api.browserbase.com/v1/projects", {
    headers: { "X-BB-API-Key": key },
  });
  if (!response.ok) {
    const error = new Error(`Could not resolve a Browserbase project (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  const projects = await response.json();
  const id = Array.isArray(projects) ? projects[0]?.id : projects?.id;
  if (!id) throw new Error("The Browserbase account has no projects.");
  projectIdCache.set(key, id);
  return id;
}

/**
 * Creates the cloud browser session up front so plan/quota failures read as
 * plain English instead of a downstream CDP error.
 */
async function createBrowserSession(key, projectId) {
  const response = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "X-BB-API-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
    }),
  });

  if (response.ok) {
    const session = await response.json();
    if (!session?.id) throw new Error("Browserbase returned a session with no id.");
    return session.id;
  }

  const detail = await response.text().catch(() => "");
  let message = detail.slice(0, 300);
  try {
    message = JSON.parse(detail).message || message;
  } catch {
    /* non-JSON body */
  }

  const reason =
    response.status === 402
      ? "out of cloud browser minutes"
      : response.status === 429
        ? "all sessions on this account are busy"
        : response.status === 401 || response.status === 403
          ? "the API key was rejected"
          : `HTTP ${response.status}${message ? `: ${message}` : ""}`;

  const error = new Error(reason);
  error.status = response.status;
  throw error;
}

/**
 * Walks the key pool until one account gives us a session. Keys that are out
 * of minutes, busy, or rejected are skipped so a spare account can take over
 * mid-test without a redeploy.
 */
async function acquireSession(emit) {
  const keys = rotationOrder();
  if (keys.length === 0) {
    const friendly = "No Browserbase API key is configured on the agent worker.";
    emit?.("system", friendly, "error");
    throw new Error(friendly);
  }

  const failures = [];

  for (const key of keys) {
    try {
      const projectId = await resolveProjectId(key);
      const sessionId = await createBrowserSession(key, projectId);
      if (keys.length > 1) {
        emit?.("system", `Using cloud browser account ${keyLabel(key)}`);
      }
      return { key, projectId, sessionId };
    } catch (error) {
      const reason = error?.message || "unknown error";
      failures.push(`${keyLabel(key)} — ${reason}`);
      if (!isExhaustedStatus(error?.status)) break;
      emit?.("system", `Cloud browser account ${keyLabel(key)} unavailable (${reason}); trying the next key.`);
    }
  }

  const friendly =
    keys.length > 1
      ? `No cloud browser account could start a session. ${failures.join(" · ")}. ` +
        "Add another key or wait for the monthly reset — sample reports still work in the meantime."
      : `Could not start a cloud browser session: ${failures[0]}. ` +
        "Add a second key via BROWSERBASE_API_KEYS to rotate accounts while testing.";
  emit?.("system", friendly, "error");
  throw new Error(friendly);
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
 * Product-tile links on a grid, in DOM order, most-likely-first. Grids are
 * where the loop used to burn a whole turn: the tiles are image-only links, so
 * a described click often lands on nothing. Reading the hrefs directly is both
 * instant and far more reliable than asking a model to describe them.
 */
const PRODUCT_LINKS_SCRIPT = `(() => {
  const detail = /\\/(products?|p|item|itm|dp|sku|shop\\/[^/]+\\/[^/]+|t\\/[^/]+)\\//i;
  const junk = /(login|account|help|store-locator|gift-card|privacy|terms|careers|blog|search\\?)/i;
  const seen = new Set();
  const out = [];
  for (const a of Array.from(document.querySelectorAll('a[href]'))) {
    const href = a.href || "";
    if (!href.startsWith('http') || junk.test(href) || !detail.test(new URL(href, location.href).pathname)) continue;
    if (href === location.href || seen.has(href)) continue;
    const box = a.getBoundingClientRect();
    if (box.width < 24 || box.height < 24) continue;
    seen.add(href);
    out.push({ href, text: (a.innerText || a.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 60) });
    if (out.length >= 8) break;
  }
  return out;
})()`;

/**
 * Every control a shopper could act on, read straight from the DOM.
 *
 * This used to be a Stagehand observe() call — an LLM pass over the whole
 * accessibility tree. On a big catalogue page (Nike's 198-item grid) that
 * routinely ran past 35s and killed the run before the agent had made a single
 * move. The same information is in the DOM; reading it takes milliseconds and
 * costs nothing, which is what makes the loop fast enough to be worth watching.
 */
const CONTROLS_SCRIPT = `(() => {
  const vh = window.innerHeight, vw = window.innerWidth;
  const nodes = document.querySelectorAll(
    'button,a[href],select,[role=button],[role=option],[role=radio],input[type=submit],input[type=button],input[type=date],[data-testid*=size],[class*=swatch]'
  );
  const out = [];
  const seen = new Set();
  for (const el of Array.from(nodes)) {
    const box = el.getBoundingClientRect();
    if (box.width < 8 || box.height < 8) continue;
    if (box.bottom < -vh || box.top > vh * 3 || box.right < 0 || box.left > vw) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.05) continue;
    let text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '')
      .replace(/\\s+/g, ' ').trim();
    if (el.tagName === 'SELECT') {
      const opts = Array.from(el.options || []).slice(1, 6).map((o) => o.text.trim()).filter(Boolean);
      text = (el.getAttribute('aria-label') || el.name || 'dropdown') + (opts.length ? ' [' + opts.join(' / ') + ']' : '');
    }
    if (!text || text.length > 70) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const disabled = el.disabled === true || el.getAttribute('aria-disabled') === 'true';
    out.push(text + (disabled ? ' (disabled)' : ''));
    if (out.length >= 40) break;
  }
  return out;
})()`;

async function visibleControls(page) {
  try {
    const found = await page.evaluate(CONTROLS_SCRIPT);
    return (found || []).slice(0, 26);
  } catch {
    return [];
  }
}

async function productLinks(page) {
  try {
    return (await page.evaluate(PRODUCT_LINKS_SCRIPT)) || [];
  } catch {
    return [];
  }
}

/** Cheap page-kind guess so the entry step doesn't need an LLM round trip. */
const CLASSIFY_SCRIPT = `(() => {
  const text = (document.body ? document.body.innerText : "").toLowerCase();
  const path = location.pathname.toLowerCase();
  const has = (re) => re.test(text);
  if (has(/order summary|subtotal|your (cart|bag|basket)|proceed to checkout/)) return 'cart';
  if (has(/payment|billing address|card number/) && has(/place order|pay now/)) return 'checkout';
  if (has(/booking summary|review your (booking|trip|cruise)|total (fare|due)/)) return 'summary';
  const buy = has(/add to (cart|bag|basket)|buy it now|book now|reserve now|select (cabin|room|fare)/);
  const grid = document.querySelectorAll('a[href*="/product"],a[href*="/p/"],a[href*="/item"],[data-testid*="product-card"],[class*="product-card"],[class*="product-tile"]').length;
  if (buy && grid < 6) return 'detail';
  if (grid >= 6) return 'listing';
  if (buy) return 'detail';
  return 'other';
})()`;


/** Heuristic backstop for "is something reserved / in the basket yet". */
const CART_CHECK = `(() => {
  const text = (document.body ? document.body.innerText : "").toLowerCase();
  const cartish = /(subtotal|order summary|booking summary|your (cart|bag|basket)|proceed to checkout|checkout now|review your (booking|cruise|trip|reservation)|guest details|passenger details|total (price|due|fare)|price summary|continue to payment|your (booking|reservation|itinerary) so far)/.test(text);
  const empty = /(cart is empty|bag is empty|basket is empty|no items in your)/.test(text);
  return cartish && !empty;
})()`;

/**
 * Set once per run. The measured audit always runs; the LLM judgement pass is
 * additive, and a failure there degrades the report rather than failing it.
 */
let reviewer = null;

/**
 * Vision reviews are slow (a multimodal call per stage) and nothing in the
 * journey depends on their result, so they no longer block navigation: the
 * screenshot and digest are taken synchronously while the page is still in
 * that state, then the review runs alongside the next browser step and its
 * findings are merged in when the run finishes.
 */
let pendingReviews = [];

async function captureStage(page, { kind, label: rawLabel, transition, emit }) {
  const label = cleanLabel(rawLabel, kind);
  const [metrics, friction, shot, size, digest] = await Promise.all([
    page.evaluate(VITALS_READ),
    page.evaluate(FRICTION_SCRIPT(kind, DEVICE)),
    page.screenshot({ fullPage: true, type: "jpeg", quality: 70 }),
    page.evaluate(
      `({ width: window.innerWidth, height: Math.max(document.documentElement.scrollHeight, window.innerHeight) })`,
    ),
    reviewer ? page.evaluate(PAGE_DIGEST_SCRIPT).catch(() => null) : Promise.resolve(null),
  ]);

  const friction_points = friction.map((point, index) => ({ ...point, id: index + 1 }));

  const stage = {
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
    friction_points,
  };

  // Fire-and-merge: the review runs while the agent keeps clicking.
  if (reviewer) {
    pendingReviews.push(
      (async () => {
        try {
          const judged = await reviewer(page, { kind, label, screenshot: shot, digest });
          if (judged.length > 0) {
            stage.friction_points = [...friction, ...judged].map((point, index) => ({
              ...point,
              id: index + 1,
            }));
            emit?.(
              "vision",
              `Reviewed ${label}: ${judged.length} experience issue${judged.length === 1 ? "" : "s"}`,
            );
          }
        } catch (error) {
          emit?.("vision", `Experience review skipped on ${label} (${error.message})`, "warn");
        }
      })(),
    );
  }

  return stage;
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


  // Stagehand's built-in model routing only knows a fixed list of providers
  // and ignores a custom base URL, so the LLM is wired explicitly through the
  // AI SDK. Any OpenAI-compatible endpoint works: OpenAI, OpenRouter, etc.
  const provider = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    compatibility: process.env.OPENAI_BASE_URL ? "compatible" : "strict",
  });

  // The judgement layer shares the same provider as the navigator.
  reviewer = createReviewer(provider);

  // The session is created explicitly rather than left to Stagehand. Stagehand
  // swallows the creation failure and only reports "browser context is
  // undefined ... CDP connection failed", which hides the real cause (out of
  // plan minutes, concurrency limit, bad key). Creating it here surfaces the
  // actual HTTP status and message.
  const { key: browserbaseKey, projectId, sessionId } = await acquireSession(emit);

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    // Run the agent loop in this process against the remote browser; the
    // hosted Stagehand API does not accept a custom LLM provider.
    useAPI: false,
    apiKey: browserbaseKey,
    projectId,
    browserbaseSessionID: sessionId,
    llmClient: new AISdkClient({
      model: provider(process.env.STAGEHAND_MODEL || "gpt-4.1-mini"),
    }),
  });

  let status = "complete";
  let blockedReason = null;

  try {
    try {
      await stagehand.init();
    } catch (error) {
      throw new Error(
        `Could not attach to the cloud browser session (${error?.message || error}). ` +
          "The session was created but the connection dropped — retry in a moment.",
      );
    }

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

    // Classifying the entry page used to be an LLM round trip before a single
    // click. The DOM already answers it, so the run starts moving immediately.
    let kind = "other";
    let entryLabel = "";
    if (!wall) {
      kind = await page.evaluate(CLASSIFY_SCRIPT).catch(() => "other");
    }

    stages.push(
      await captureStage(page, {
        kind,
        label: entryLabel || KIND_LABELS[kind],
        transition: null,
        emit,
      }),
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
    const openedProducts = new Set();

    for (let step = 0; !wall && step < MAX_STEPS && Date.now() < deadline; step += 1) {
      await withTimeout(dismissOverlays(page, { emit }), 12000, "Clearing pop-ups").catch(() => {});

      // Reading controls is now a DOM scan, so it cannot stall the run; if it
      // ever does, the planner simply works from the screen alone.
      const controls = await withTimeout(
        visibleControls(page),
        10000,
        "Reading page controls",
      ).catch(() => []);

      // FAST LANE. Opening an item from a grid is the one move that never
      // needs a model: the tiles are ordinary links. Skipping the planning
      // call here is what turns "stuck on the listing for a minute" into a
      // couple of seconds — and it cannot land on a logo or a filter.
      const pageKind = await page.evaluate(CLASSIFY_SCRIPT).catch(() => "other");
      if (pageKind === "listing") {
        const candidates = (await productLinks(page)).filter((l) => !openedProducts.has(l.href));
        const target = candidates[0];
        if (target) {
          openedProducts.add(target.href);
          emit("vision", `Opening ${target.text || "the first item"} from this listing`);
          const tJump = Date.now();
          await page
            .goto(target.href, { waitUntil: "domcontentloaded", timeout: 30000 })
            .catch(() => {});
          await page.waitForTimeout(1200);
          await withTimeout(dismissOverlays(page, { emit }), 12000, "Clearing pop-ups").catch(
            () => {},
          );
          const jumpedKind = await page.evaluate(CLASSIFY_SCRIPT).catch(() => "detail");
          const stage = await captureStage(page, {
            kind: jumpedKind === "listing" ? "detail" : jumpedKind,
            label: target.text || "Product page",
            transition: { action: `open "${target.text || "item"}"`, duration_ms: Date.now() - tJump },
            emit,
          });
          stages.push(stage);
          emit("browser", `${stage.label} captured in ${Date.now() - tJump}ms`, "success");
          continue;
        }
      }


      const decision = await withTimeout(stagehand.page.extract({
        instruction:
          "GOAL: get one bookable or purchasable item as far as a cart or booking summary on this site. " +
          "Sites differ wildly: it may take one step or a dozen. Work out this site's own flow from what is on screen — " +
          "never assume a standard retail checkout. " +
          "TWO COMMON SHAPES. (a) Catalogue: listing grid -> item detail -> choose required options -> add to cart. " +
          "(b) Search-first booking funnel (cruises, hotels, flights, tickets, rentals): the homepage has no products at " +
          "all — you must first fill a search widget (destination or region, month or departure date, number of guests) " +
          "and submit it, then pick a result (a sailing, itinerary, date or departure), then pick a fare or category, " +
          "then a specific cabin, room, seat or slot, then continue through guest/traveller steps until a summary with a " +
          "total price appears. On these sites 'add to cart' does not exist — the equivalent is Book, Reserve, Select, " +
          "Choose, or Continue. Progressing one step of that funnel IS progress; keep going. " +
          "Fill required fields with sensible defaults: nearest available future date, 2 adults, cheapest available " +
          "option, first available cabin/room. Skip optional upsells, insurance, extras and loyalty prompts by choosing " +
          "the plain continue / no-thanks option. " +
          "IMPORTANT — where the buy control lives: a category or listing grid almost never has an add-to-cart button. " +
          "If you are on a grid of several items, do NOT look for add-to-cart; open one in-stock item to reach its " +
          "detail page first. On a detail page for clothing, footwear or anything with variants, the add-to-cart " +
          "control is usually disabled until every required option is chosen — pick a size, colour, length or fit " +
          "(swatch, dropdown or button) before clicking add. Prefer an option that is not marked sold out or " +
          "unavailable. Quick-add or hover 'add' buttons on a grid tile are a shortcut, not the main flow: use one " +
          "only if it is plainly visible and does not open a picker you cannot complete. " +
          `You are on ${page.url()}, driving a ${DEVICE} browser. ` +
          (controls.length
            ? `Controls visible right now: ${controls.map((c) => `"${c}"`).join(", ")}. `
            : "") +
          (history.length
            ? `Already attempted (never repeat one marked no effect — pick a different control or route): ${history.map((h) => `"${h}"`).join(", ")}. `
            : "") +
          "If a cookie banner, newsletter modal, region picker or any other pop-up is covering the page, your first move must close or accept it. " +
          "Return the next 1-3 moves that belong together (for example: open the size dropdown, then choose an available size; " +
          "or set the departure month, then click Search). " +
          "Set done=true only when the current page already shows the chosen item in a cart or a booking summary with a total.",
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
      }), THINK_TIMEOUT_MS, "Planning the next move");

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
        await settle(page, await readSignature(page), 7000);
      }

      if (failure) {
        // A pop-up that appeared mid-turn is the most common cause of an
        // action timing out. Clear it and give this turn one free retry.
        const { blocker, cleared } = await withTimeout(
          dismissOverlays(page, { emit, deep: true }),
          THINK_TIMEOUT_MS,
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

      let moved = (await readSignature(page)) !== before || (await settle(page, before, 7000));

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
        const href = (await productLinks(page))[0]?.href;
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
        emit,
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
              emit,
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
    // The reviews ran alongside navigation; collect them before the browser
    // goes away, since they read element geometry from the live page.
    await withTimeout(
      Promise.allSettled(pendingReviews),
      45000,
      "Finishing the experience review",
    ).catch(() => {});
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
