import { generateObject, generateText } from "ai";
import { z } from "zod";

import { verticalBrief } from "./vertical.js";

/**
 * The judgement layer — a small consulting council rather than a linter.
 *
 * friction.js measures what a machine can measure. It cannot tell you that a
 * price says "from $199" without saying what the real price is, that the hero
 * CTA promises something the funnel can't deliver yet, or that the headline is
 * talking about the brand instead of the buyer. That is conversion judgement,
 * and it is what this file asks a strong multimodal model for — in three
 * distinct voices:
 *
 *   strategist — funnel logic, hierarchy, price transparency, decision info
 *   copy       — headline/CTA/value proposition, with a literal rewrite
 *   trust      — reassurance appropriate to THIS business model
 *
 * Three guards keep it honest:
 *   1. Geometry is frozen at capture time. The model names a ref from the
 *      digest; we look it up in that stage's own geometry map. Refs that are
 *      not in the map are dropped. Nothing is ever resolved against a live
 *      page that has since navigated away.
 *   2. Quoted evidence must actually appear in the captured page text.
 *   3. The vertical brief tells the model what this category's buyer needs —
 *      and, explicitly, what it must never fault this category for.
 */

const SEVERITIES = ["high", "medium", "low"];
const CATEGORIES = ["trust", "clarity", "accessibility", "form", "performance"];
const PERSONAS = ["strategist", "copy", "trust", "accessibility"];
const IMPACTS = ["material", "meaningful", "minor"];

/**
 * Deliberately permissive. A `.max()` on a string or a strict enum makes the
 * whole call fail with "response did not match schema" and silently throws away
 * a page's findings, so length and vocabulary are normalised in code instead.
 */
const reviewFinding = z.object({
  ref: z.string().describe("The element ref from the digest, e.g. 'e12'. Must be one that exists."),
  persona: z.string().describe("strategist, copy or trust — which lens found this"),
  severity: z.string().describe("high, medium or low"),
  category: z.string().describe("trust, clarity, accessibility, form or performance"),
  title: z.string().describe("Plain, specific. What a shopper loses, not a rule name."),
  description: z.string().describe("Why this costs conversions on THIS page, in concrete terms."),
  evidence: z
    .string()
    .describe("Quote the exact wording or number you saw on the page, in double quotes."),
  recommendation: z.string().describe("The specific change to make on this page."),
  impact: z.string().describe("material, meaningful or minor"),
  rewrite_before: z.string().describe("Copy findings only: the current wording, verbatim. Otherwise empty."),
  rewrite_after: z.string().describe("Copy findings only: your replacement wording. Otherwise empty."),
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
  const persona = String(finding?.persona || "").toLowerCase();
  const impact = String(finding?.impact || "").toLowerCase();
  return {
    ref: String(finding?.ref || "").trim(),
    persona: PERSONAS.find((p) => persona.includes(p)) || "strategist",
    severity: SEVERITIES.find((s) => severity.includes(s)) || "medium",
    category: CATEGORIES.find((c) => category.includes(c)) || "clarity",
    impact: IMPACTS.find((i) => impact.includes(i)) || "meaningful",
    title: clamp(finding?.title, 90),
    description: clamp(finding?.description, 340),
    evidence: clamp(finding?.evidence, 220),
    recommendation: clamp(finding?.recommendation, 260),
    rewrite_before: clamp(finding?.rewrite_before, 180),
    rewrite_after: clamp(finding?.rewrite_after, 180),
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

const squash = (text) => String(text || "").toLowerCase().replace(/[\u2018\u2019\u201c\u201d]/g, "'").replace(/\s+/g, " ").trim();

/**
 * Evidence binding. Anything the model puts in quotes has to exist on the page.
 * Unquoted evidence (an observation like "no cancellation policy anywhere in
 * the page copy") is allowed through — you cannot quote an absence.
 */
function evidenceHolds(evidence, pageText) {
  const haystack = squash(pageText);
  if (!haystack) return true;
  const quotes = String(evidence || "").match(/["'\u201c\u2018]([^"'\u201d\u2019]{6,80})["'\u201d\u2019]/g) || [];
  if (quotes.length === 0) return true;
  return quotes.every((raw) => {
    const needle = squash(raw.replace(/^["'\u201c\u2018]|["'\u201d\u2019]$/g, ""));
    if (needle.length < 6) return true;
    if (haystack.includes(needle)) return true;
    // Allow light paraphrase of casing/punctuation by matching on words.
    const words = needle.split(" ").filter((w) => w.length > 3);
    if (words.length === 0) return true;
    const hits = words.filter((w) => haystack.includes(w)).length;
    return hits / words.length >= 0.8;
  });
}

const SYSTEM = (brief, device) => `You are a three-person conversion consultancy reviewing one step of a real purchase or booking journey for a Fortune-100 client. Between you there are decades of e-commerce CRO, direct-response copywriting and WCAG work, and the engagement is judged on precision, not volume.

${brief}

You are reviewing a ${device} session. Report findings from these three lenses, and tag each with the lens that found it:

STRATEGIST (persona: "strategist") — funnel logic and decision-making. Is the next step unambiguous? Is the price complete and honest at this point, or does cost appear later? Is the information needed to decide present at the decision point, or does it require leaving the page? Does anything visually compete with or outrank the primary action? Is the state of a choice (selected option, step N of M) legible? Does the page ask for effort or personal data before delivering value? Are error, empty and disabled states explained rather than silent?

COPY (persona: "copy") — the words. Is the headline about the buyer's outcome or the brand's self-image? Does the CTA name what happens next, or is it a generic verb? Is the value proposition stated where the decision is made? Is jargon standing in for meaning? Is an objection left unanswered in the copy? EVERY copy finding MUST include rewrite_before (the current wording, verbatim from the page) and rewrite_after (your replacement, in this brand's register). A copy finding without a concrete rewrite is worthless — do not submit one.

TRUST (persona: "trust") — risk and reassurance, using THIS business model's vocabulary as set out in the brief above. Reassurance this category's buyer actually looks for, credibility, and honesty of claims (countdowns, "from" pricing, urgency that is not real).

DO NOT REPORT any of the following. They are correct design, already measured elsewhere, or category-inappropriate, and reporting them destroys the client's trust in the audit:
- Anything the brief lists under "DO NOT ask this business for". This is the most common and most damaging error.
- A buy/reserve button that is absent or disabled because a size, colour, date or cabin has not been chosen yet. That gating is intentional. Only flag it if choosing an option is itself unclear.
- A category, listing or search-results page having no add-to-cart. That is expected.
- Small link or tap sizes, missing alt text, missing form labels, page-speed and layout-shift numbers, console errors. All measured separately.
- Images that are blank, grey or missing in the lower part of a long screenshot. Catalogues lazy-load below the fold and the capture precedes decode. NEVER report this. Only report an image problem inside the first viewport height, or a visible error placeholder.
- Anything you cannot see evidence for in the screenshot or the digest. Never speculate about behaviour behind a click.
- Generic advice that would apply to any website ("add social proof", "improve the design", "use clearer CTAs").

EVERY finding must:
- name a ref that exists in the digest, and that ref must be the element the finding is actually about — if you are writing about the hero CTA, name the hero CTA's ref, not a nearby image;
- quote real page wording in "evidence", copied exactly, or state plainly what is absent;
- carry a recommendation that a designer could act on tomorrow;
- carry an impact of material, meaningful or minor, judged on revenue.

WHAT THE SCROLL PASS SAW: before this capture the page was scrolled from top to bottom in viewport steps, so lazy content has loaded and the whole page is real. Where a "Scroll pass" line and a "During-scroll observations" block are given, treat them as measured fact and judge the READING EXPERIENCE they describe: whether the information a buyer needs arrives in the order they need it, whether the page pads the distance to the decision with repetition, whether something important is stranded far below the point of intent, and whether anything a shopper needs is simply absent from the full page copy. Do not restate the raw numbers as findings — layout shift, stalled images and CTA depth are already reported separately.

POP-UPS: if a "Pop-up shown to the shopper" block is given, one of you must judge it (persona "copy" if it is about wording, "trust" if it is about pressure or consent, "strategist" if it is about timing or interruption). Ask: does its message connect to what the shopper came here for, or is it generic? Does it interrupt before the page has given any value? Is declining as easy and as visible as accepting, or is "no thanks" hidden in small grey text next to a filled button? Does it ask for an email before showing a single product? Use ref "o1" (or "o2") for a finding about a pop-up, and quote its actual wording. If a copy finding, rewrite the pop-up's headline or CTA concretely.

Return AT MOST 4 findings, ideally spread across the lenses, and return an empty list if the page is genuinely sound — an empty list is a valid, respected answer.`;

/**
 * @param {(modelId: string) => any} provider  AI SDK provider factory
 * @param {{ vertical?: object }} options
 */
export function createReviewer(provider, { vertical } = {}) {
  const modelId =
    process.env.UX_REVIEW_MODEL || process.env.REVIEW_MODEL || process.env.STAGEHAND_MODEL || "gpt-4.1";
  if (process.env.UX_REVIEW_DISABLED === "1") return null;
  const brief = verticalBrief(vertical);
  const device = process.env.AGENT_DEVICE || "desktop";
  const system = SYSTEM(brief, device);

  return async function review(
    _page,
    { kind, label, screenshot, digest, scroll_profile, scroll_brief, interstitials = [], timeoutMs = 60000 },
  ) {
    if (!digest) return [];
    const geometry = { ...(digest.geometry || {}) };

    // Pop-ups get their own refs. Their geometry is viewport-relative at the
    // moment of capture, which is the top of the page, so it converts cleanly
    // into the full-page percentage space the pins live in.
    const docHeight = Math.max(digest.viewport.document_height || 1, 1);
    const vw = Math.max(digest.viewport.width || 1, 1);
    interstitials.slice(0, 2).forEach((overlay, index) => {
      const r = overlay.rect || {};
      geometry[`o${index + 1}`] = {
        x_percentage: Math.min(100, ((r.x + r.width / 2) / vw) * 100),
        y_percentage: Math.min(100, ((r.y + r.height / 2) / docHeight) * 100),
        w_percentage: Math.min(100, (r.width / vw) * 100),
        h_percentage: Math.min(100, (r.height / docHeight) * 100),
        selector: "overlay",
      };
    });

    const prompt = [
      `Journey step: ${label} (stage type: ${kind}).`,
      `URL: ${digest.url}`,
      `Viewport ${digest.viewport.width}×${digest.viewport.height}, full page height ${digest.viewport.document_height}px.`,
      ``,
      `Headings (ref, text, position as % of page): ${JSON.stringify(digest.headings)}`,
      ``,
      `Interactive controls (ref, text, disabled, position as % of page): ${JSON.stringify(digest.controls)}`,
      ``,
      `Page copy: ${digest.above_fold_text}`,
      ...(scroll_brief ? ["", scroll_brief] : []),
      ...(scroll_profile
        ? [
            `During-scroll observations: ${JSON.stringify({
              viewports: scroll_profile.viewports,
              primary_cta: scroll_profile.primary_cta,
              pinned_while_scrolling: scroll_profile.sticky,
              infinite_scroll: scroll_profile.infinite_scroll,
            })}`,
            "",
            `Full page copy after scrolling (this is everything the page says): ${scroll_profile.page_text}`,
          ]
        : []),
      ...interstitials.slice(0, 2).flatMap((overlay, index) => [
        "",
        `Pop-up shown to the shopper (ref o${index + 1}, appeared ${(overlay.elapsed_ms / 1000).toFixed(1)}s after landing, covering ${overlay.coverage_percentage}% of the screen${overlay.repeat_count > 1 ? `, shown ${overlay.repeat_count} times during the journey` : ""}):`,
        JSON.stringify({
          heading: overlay.heading,
          text: overlay.text,
          buttons: overlay.ctas,
          accept_label: overlay.accept_label,
          decline_label: overlay.decline_label,
          decline_is_visually_weaker: overlay.decline_is_weaker,
          has_close_control: overlay.has_close_control,
          asks_for_input_fields: overlay.asks_for_input,
        }),
      ]),
    ].join("\n");

    // Viewport frames from the scroll sweep. The full-page capture flattens
    // the page; these show what was actually on screen at each depth, which is
    // what lets the council judge below-fold content at all.
    const frames = Array.isArray(scroll_profile?.frames) ? scroll_profile.frames.slice(0, 3) : [];

    const content = [
      { type: "text", text: prompt },
      { type: "image", image: screenshot },
      ...(frames.length
        ? [
            {
              type: "text",
              text: `The next ${frames.length} image${frames.length === 1 ? " is a viewport frame" : "s are viewport frames"} captured during the scroll, in order, covering ${frames
                .map((f) => `${Math.round(f.top_percentage)}–${Math.round(f.bottom_percentage)}%`)
                .join(", ")} of the page. Judge below-fold content from these.`,
            },
            ...frames.map((frame) => ({ type: "image", image: frame.src })),
          ]
        : []),
      ...interstitials
        .slice(0, 2)
        .filter((overlay) => overlay.image)
        .map((overlay) => ({ type: "image", image: overlay.image })),
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
          system,
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
          system: `${system}\n\nReply with JSON only, no prose: {"findings":[{"ref":"e12","persona":"strategist","severity":"high","category":"clarity","title":"...","description":"...","evidence":"...","recommendation":"...","impact":"material","rewrite_before":"","rewrite_after":""}]}`,
          messages: [{ role: "user", content }],
        }),
      );
      raw = parseLoose(retry.text)?.findings;
    }

    if (!Array.isArray(raw)) return [];

    const findings = [];
    const seenTitles = new Set();

    for (const candidate of raw.slice(0, 5)) {
      const f = normalise(candidate);
      if (!f.ref || !f.title) continue;

      // Guard 1 — geometry frozen at capture time. No live-page lookups.
      const box = geometry[f.ref] || geometry[f.ref.replace(/[^0-9]/g, "") ? `e${f.ref.replace(/[^0-9]/g, "")}` : ""];
      if (!box) continue;

      // Guard 2 — quoted evidence must exist on the page we captured.
      const haystack = [
        digest.page_text || digest.above_fold_text,
        scroll_profile?.page_text,
        ...interstitials.map((overlay) => `${overlay.heading} ${overlay.text}`),
      ]
        .filter(Boolean)
        .join(" ");
      if (!evidenceHolds(f.evidence, haystack)) continue;

      // A copy finding with no rewrite is exactly the generic advice we told
      // the model not to send.
      if (f.persona === "copy" && !f.rewrite_after) continue;

      const key = squash(f.title);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);

      findings.push({
        x_percentage: box.x_percentage,
        y_percentage: box.y_percentage,
        rect: {
          x_percentage: Math.max(0, box.x_percentage - box.w_percentage / 2),
          y_percentage: Math.max(0, box.y_percentage - box.h_percentage / 2),
          w_percentage: Math.max(1, box.w_percentage),
          h_percentage: Math.max(0.5, box.h_percentage),
        },
        persona: f.persona,
        severity: f.severity,
        category: f.category,
        impact: f.impact,
        title: f.title,
        description: f.description,
        evidence: f.evidence,
        recommendation: f.recommendation,
        ...(f.rewrite_after ? { rewrite_before: f.rewrite_before, rewrite_after: f.rewrite_after } : {}),
        selector: box.selector,
      });
    }
    return findings.slice(0, 4);
  };
}
