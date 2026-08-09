import { AISdkClient, Stagehand } from "@browserbasehq/stagehand";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

import { FRICTION_SCRIPT } from "./friction.js";
import { VITALS_INIT, VITALS_READ } from "./vitals.js";

/**
 * Drives a real cloud browser from an entry URL through to the cart, emitting
 * the same ForensicAuditReport shape the UI already renders.
 *
 * The loop is goal-driven, not a fixed script: at each step it asks what the
 * page is and what the next move toward the cart is. That is what lets a
 * two-step Shopify store and a six-step cruise booking share one code path.
 */

const MAX_STEPS = 8;

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

const stageKind = z.enum(["category", "product", "variant", "mini-cart", "cart"]);

const KIND_LABELS = {
  category: "Category",
  product: "Product page",
  variant: "Variant selected",
  "mini-cart": "Mini-cart",
  cart: "Cart",
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


async function captureStage(page, { kind, label, transition }) {
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

    let kind = "product";
    if (!wall) {
      const classified = await stagehand.page.extract({
        instruction:
          "Classify this page as one of: category (a list of products), product (a single product with a buy control), variant, mini-cart, or cart.",
        schema: z.object({ kind: stageKind }),
      });
      kind = classified.kind;
    }

    stages.push(
      await captureStage(page, {
        kind,
        label: kind === "category" ? "Category" : "Product page",
        transition: null,
      }),
    );
    emit("browser", `Landed on ${kind} in ${Date.now() - t0}ms`, "success");

    // Goal loop: keep taking the single next action that moves toward a cart
    // containing an item, stopping when we get there or run out of moves.
    // The action history is fed back in, otherwise the model happily retries
    // the same variant click forever on stores with sticky size pickers.
    const history = [];
    for (let step = 0; !wall && step < MAX_STEPS; step += 1) {
      const decision = await stagehand.page.extract({
        instruction:
          "You are walking this store from a product page to a cart containing one item. What is the single next action? " +
          (history.length
            ? `Actions already tried (do NOT repeat them; if one appears to have had no effect, try a different route such as opening the cart directly): ${history.map((h) => `"${h}"`).join(", ")}. `
            : "") +
          "Reply done=true only if the current page is a cart page that already contains at least one item.",
        schema: z.object({
          done: z.boolean(),
          action: z.string().describe("A short imperative instruction, e.g. 'click the Add to Cart button'"),
          resulting_kind: stageKind,
          label: z.string(),
        }),
      });

      if (decision.done) {
        emit("system", "Cart reached with an item present", "success");
        break;
      }

      history.push(decision.action);
      emit("vision", decision.action);

      const tAct = Date.now();
      try {
        await stagehand.page.act(decision.action);
      } catch (error) {
        status = "partial";
        blockedReason = `The agent could not complete "${decision.action}" — ${error.message.slice(0, 160)}`;
        emit("browser", blockedReason, "error");
        break;
      }
      await page.waitForTimeout(2200);

      stages.push(
        await captureStage(page, {
          kind: decision.resulting_kind,
          label: decision.label,
          transition: { action: decision.action, duration_ms: Date.now() - tAct },
        }),
      );
      emit("browser", `${decision.label} captured in ${Date.now() - tAct}ms`, "success");

      if (decision.resulting_kind === "cart") break;
    }

    // Many stores add to cart via a drawer and never navigate, so the loop can
    // end one hop short. Try the conventional cart URL before giving up.
    if (!wall && !stages.some((s) => s.kind === "cart")) {
      try {
        const cartUrl = new URL("/cart", page.url()).toString();
        emit("system", `No cart page captured yet — opening ${cartUrl}`);
        const tCart = Date.now();
        await page.goto(cartUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(2000);
        stages.push(
          await captureStage(page, {
            kind: "cart",
            label: "Cart",
            transition: { action: "open the cart page directly", duration_ms: Date.now() - tCart },
          }),
        );
        emit("browser", `Cart captured in ${Date.now() - tCart}ms`, "success");
        blockedReason = null;
        status = "complete";
      } catch (error) {
        status = "partial";
        blockedReason = `The run stopped before reaching a cart page (${error.message.slice(0, 120)}).`;
      }
    }

    if (!stages.some((s) => s.kind === "cart") && !blockedReason) {
      status = "partial";
      blockedReason = "The run stopped before reaching a cart page.";
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
