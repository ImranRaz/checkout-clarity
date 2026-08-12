import { generateObject, generateText } from "ai";
import { z } from "zod";


import { RESOLVE_REF_SCRIPT } from "./friction.js";

/**
 * The judgement layer.
 *
 * friction.js measures what a machine can measure. It cannot tell you that a
 * price says "from $199" without saying what the real price is, that a page
 * asks for an email before showing anything, or that the next step in a
 * booking funnel is buried under three upsells. That is conversion-experience
 * judgement, and it is what this file asks a vision model for.
 *
 * Two rules keep the output honest:
 *   1. The model never invents coordinates. It names an element ref from the
 *      page digest; we read that element's real bounding box in the browser.
 *      Refs that don't resolve are dropped.
 *   2. The model is told, explicitly and with examples, which patterns are
 *      intentional design rather than friction — variant-gated buy buttons,
 *      cookie banners already dismissed, small utility-nav links on desktop.
 *      Precision is scored higher than recall.
 */

const SEVERITIES = ["high", "medium", "low"];
const CATEGORIES = ["trust", "clarity", "accessibility", "form", "performance"];

/**
 * Deliberately permissive. A `.max()` on a string or a strict enum makes the
 * whole call fail with "response did not match schema" and silently throws away
 * a page's findings, so length and vocabulary are normalised in code instead.
 */
const reviewFinding = z.object({
  ref: z.string().describe("The element ref from the digest, e.g. 'e12'. Must be one that exists."),
  severity: z.string().describe("high, medium or low"),
  category: z.string().describe("trust, clarity, accessibility, form or performance"),
  title: z.string().describe("Plain, specific. What a shopper loses, not a rule name."),
  description: z.string().describe("Why this costs conversions on THIS page, in concrete terms."),
  evidence: z.string().describe("The exact wording, number, or measurement you observed."),
});

const reviewSchema = z.object({
  findings: z.array(reviewFinding),
});

function clamp(value, limit) {
  const text = String(value ?? "").trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

/** Maps whatever vocabulary the model used onto the values the UI renders. */
function normalise(finding) {
  const severity = String(finding?.severity || "").toLowerCase();
  const category = String(finding?.category || "").toLowerCase();
  return {
    ref: String(finding?.ref || "").trim(),
    severity: SEVERITIES.find((s) => severity.includes(s)) || "medium",
    category: CATEGORIES.find((c) => category.includes(c)) || "clarity",
    title: clamp(finding?.title, 80),
    description: clamp(finding?.description, 320),
    evidence: clamp(finding?.evidence, 200),
  };
}

/** Last resort: pull the first JSON object out of a plain-text completion. */
function parseLoose(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}


const SYSTEM = `You are a senior conversion-experience reviewer auditing one step of a real purchase or booking journey. You have 15 years of e-commerce CRO and WCAG experience and your reputation rests on precision.

You are looking for LEAKAGE — the reasons a motivated buyer on this exact page hesitates, backtracks, or leaves:
- Is the next step unambiguous, or does the shopper have to guess what to click?
- Is the price complete and honest at this point, or does cost appear later?
- Is the information needed to decide (size guide, availability, delivery date, what's included, cancellation terms) present at the decision point, or does it require leaving the page?
- Does the page ask for effort or personal data before delivering value?
- Does anything visually compete with, or outrank, the primary action?
- Is the state of a choice (selected size, chosen date, current step of N) legible?
- Are error, empty, and disabled states explained rather than silent?
- Real accessibility barriers that a shopper would actually feel: contrast so low the price is hard to read, a control that reads as decoration, meaning carried by colour alone.

DO NOT REPORT any of the following. They are correct design or already covered by automated measurement, and reporting them destroys trust in the audit:
- A buy/reserve button that is absent or disabled because a size, colour, date, or cabin has not been chosen yet. That gating is intentional. Only flag it if choosing an option is itself unclear.
- A category, listing, or search-results page having no add-to-cart. That is expected.
- Small link or tap sizes, missing alt text, missing form labels, page-speed and layout-shift numbers, console errors. All of these are measured separately.
- Images that are blank, grey, or missing in the lower part of a long screenshot. Modern catalogues lazy-load imagery below the fold and the capture is taken before off-screen images decode. This is correct, intentional behaviour — NEVER report it as "images fail to load", "broken images", or "catalogue does not render". Only report an image problem if an image is missing INSIDE the first viewport height, or if a visible placeholder explicitly reads as an error.
- Anything you cannot see evidence for in the screenshot or the digest. Never speculate about behaviour behind a click.
- Generic advice that would apply to any website ("add social proof", "improve the design", "use clearer CTAs").


Return AT MOST 3 findings, and return an empty list if the page is genuinely sound — an empty list is a valid, respected answer. Rank by revenue impact. Each finding must reference a real element ref from the digest and quote specific evidence from this page.`;

/**
 * @param {(modelId: string) => any} provider  AI SDK provider factory
 */
export function createReviewer(provider) {
  const modelId = process.env.UX_REVIEW_MODEL || process.env.STAGEHAND_MODEL || "gpt-4.1-mini";
  if (process.env.UX_REVIEW_DISABLED === "1") return null;

  return async function review(page, { kind, label, screenshot, digest, timeoutMs = 45000 }) {
    const prompt = [
      `Journey step: ${label} (stage type: ${kind}).`,
      `URL: ${digest.url}`,
      `Viewport ${digest.viewport.width}×${digest.viewport.height}, full page height ${digest.viewport.document_height}px. This is a ${process.env.AGENT_DEVICE || "desktop"} session.`,
      ``,
      `Headings: ${JSON.stringify(digest.headings)}`,
      ``,
      `Interactive controls (ref, text, disabled, position as % of page): ${JSON.stringify(digest.controls)}`,
      ``,
      `Page copy: ${digest.above_fold_text}`,
    ].join("\n");

    const content = [
      { type: "text", text: prompt },
      { type: "image", image: screenshot },
    ];

    const withTimeout = (promise) => {
      let timer;
      return Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("UX review timed out")), timeoutMs);
        }),
      ]).finally(() => clearTimeout(timer));
    };

    let raw = null;
    try {
      const result = await withTimeout(
        generateObject({
          model: provider(modelId),
          schema: reviewSchema,
          system: SYSTEM,
          messages: [{ role: "user", content }],
        }),
      );
      raw = result.object?.findings;
    } catch (error) {
      if (/timed out/i.test(error?.message || "")) throw error;
      // Structured mode failed (the classic "response did not match schema").
      // Ask again in plain text and parse it ourselves rather than losing a
      // whole page's worth of findings.
      const retry = await withTimeout(
        generateText({
          model: provider(modelId),
          system: `${SYSTEM}\n\nReply with JSON only, no prose: {"findings":[{"ref":"e12","severity":"high","category":"clarity","title":"...","description":"...","evidence":"..."}]}`,
          messages: [{ role: "user", content }],
        }),
      );
      raw = parseLoose(retry.text)?.findings;
    }

    if (!Array.isArray(raw)) return [];

    const findings = [];
    for (const candidate of raw.slice(0, 3)) {
      const f = normalise(candidate);
      if (!f.ref || !f.title) continue;
      let geometry = null;
      try {
        geometry = await page.evaluate(RESOLVE_REF_SCRIPT(f.ref));
      } catch {
        geometry = null;
      }

      // No resolvable element means no verifiable location — drop it rather
      // than pin it somewhere plausible-looking.
      if (!geometry) continue;
      findings.push({
        x_percentage: geometry.x_percentage,
        y_percentage: geometry.y_percentage,
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        evidence: f.evidence,
        selector: geometry.selector,
      });
    }
    return findings;
  };
}
