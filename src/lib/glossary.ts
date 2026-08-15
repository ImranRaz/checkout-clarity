/**
 * Plain-English definitions for every acronym and term of art the report puts
 * in front of an executive. One source of truth so the same words are used in
 * the dashboard, the summary and any future export.
 */

export interface GlossaryEntry {
  /** Expanded name, e.g. "Largest Contentful Paint". */
  term: string;
  /** What it measures, in one sentence a non-engineer can repeat. */
  what: string;
  /** Why a revenue owner should care. */
  why: string;
  /** Optional good / needs-work thresholds. */
  benchmark?: string;
}

export const GLOSSARY = {
  lcp: {
    term: "LCP — Largest Contentful Paint",
    what: "How long until the biggest thing on screen — usually the hero image or product photo — has finished drawing.",
    why: "It is the closest proxy for 'the page felt loaded'. Slow LCP on a product page is the single most reliable predictor of shoppers leaving before they see the price.",
    benchmark: "Good under 2.5s · Needs work 2.5-4s · Poor over 4s",
  },
  cls: {
    term: "CLS — Cumulative Layout Shift",
    what: "A score for how much the page jumps around while it loads, as content, banners and images arrive late.",
    why: "Jumping layouts cause mis-taps: a shopper reaches for Add to Cart and hits a newsletter banner instead. It reads as an unfinished store.",
    benchmark: "Good under 0.1 · Needs work 0.1-0.25 · Poor over 0.25",
  },
  tbt: {
    term: "Blocking time (TBT — Total Blocking Time)",
    what: "How long the page was visually there but frozen, because scripts were hogging the browser's single main thread.",
    why: "This is the 'I tapped and nothing happened' window. Shoppers tap again, double-add items, or abandon. It is usually third-party tags.",
    benchmark: "Good under 200ms · Needs work 200-600ms · Poor over 600ms",
  },
  domReady: {
    term: "DOM ready (DOMContentLoaded)",
    what: "When the page's HTML structure has been parsed — before images and most scripts have finished.",
    why: "An early marker for how fast your own server and markup are, separate from heavy media. A slow DOM ready points at back-end or template problems, not images.",
    benchmark: "Under 1.5s is healthy for a commerce template",
  },
  transferred: {
    term: "Transferred bytes",
    what: "Total weight downloaded to render this step, compressed as it came over the wire.",
    why: "Weight is what mobile shoppers on cellular actually pay in time. Heavy pages are usually heavy because of uncompressed imagery and marketing scripts, both removable.",
    benchmark: "Under 2 MB is healthy · over 5 MB is a mobile problem",
  },
  requests: {
    term: "Requests",
    what: "How many separate files the browser had to fetch to build this step.",
    why: "Each request is a round trip. High counts usually mean a stack of tag-manager scripts rather than product content, and they compete with your own assets.",
    benchmark: "Under 80 is lean · over 150 is bloated",
  },
  consoleErrors: {
    term: "Console errors",
    what: "JavaScript failures the browser recorded while the agent used the page.",
    why: "Errors on a cart or checkout step frequently mean a silently broken control — a promo field or payment button that fails for a slice of shoppers you never hear from.",
  },
  slowResources: {
    term: "Slowest resources",
    what: "The individual files that took longest to arrive on this step.",
    why: "This is the shortlist for a fix. One 4-second video poster or chat widget often accounts for most of a bad load time.",
  },
  cro: {
    term: "CRO — Conversion Rate Optimisation",
    what: "The practice of increasing the share of visitors who complete a purchase, by removing friction rather than buying more traffic.",
    why: "Same traffic, more revenue. It is usually the cheapest growth lever a store has.",
  },
  ux: {
    term: "UX — User Experience",
    what: "How the journey feels to use: whether a shopper can tell what to do, trust what they read, and do it without effort.",
    why: "Technical speed alone does not sell. Most abandoned carts are caused by unclear cost, effort or trust, not milliseconds.",
  },
  aboveFold: {
    term: "Above the fold",
    what: "Everything visible without scrolling on first load.",
    why: "It carries the majority of attention. Price, proof and the primary action belong here.",
  },
  interstitial: {
    term: "Interstitial",
    what: "An overlay that interrupts the page — cookie banners, email pop-ups, region pickers, app prompts.",
    why: "Each one is a decision you force before a shopper has seen anything. Stacked interstitials are a common, invisible cause of bounce on mobile.",
  },
  layoutShift: {
    term: "Layout shift",
    what: "Content moving after it has already been drawn on screen.",
    why: "The mechanic behind CLS. During scroll it is what makes a page feel unstable and causes accidental taps.",
  },
  severity: {
    term: "Severity",
    what: "How much a single finding hurts: high, medium or low.",
    why: "Severity drives the score and the order of work. High findings are the ones costing orders today.",
  },
  effort: {
    term: "Effort",
    what: "A rough estimate of how much work a fix takes — copy change, template change, or engineering project.",
    why: "Paired with impact it tells you what to ship this week versus what to schedule.",
  },
  impact: {
    term: "Impact",
    what: "Expected size of the conversion gain if the finding is fixed.",
    why: "Lets you sequence by return rather than by how loud a finding sounds.",
  },
  score: {
    term: "Forensic score",
    what: "A 0-100 roll-up computed from the findings and measurements, weighted toward the steps closest to purchase.",
    why: "It is deterministic — the same pages always produce the same number — so it is safe to track over time and across competitors.",
  },
  pillars: {
    term: "Experience pillars",
    what: "Every finding is bucketed into Clarity, Trust, Effort or Speed, then scored per stage.",
    why: "It names the weakest link in the journey instead of handing you an undifferentiated list of issues.",
  },
  clarity: {
    term: "Clarity",
    what: "Whether a shopper can tell what this page is and what to do next.",
    why: "Unclear pages do not get slower — they get abandoned silently, which is why clarity rarely shows up in analytics.",
  },
  trust: {
    term: "Trust",
    what: "Whether cost, terms, returns and security are stated honestly at the moment they matter.",
    why: "Surprise cost at the cart is the most-cited reason for abandonment in every published study.",
  },
  effortPillar: {
    term: "Effort",
    what: "How much work the step demands: taps, fields, decisions, scrolling.",
    why: "Each extra required action measurably drops completion, most sharply on mobile.",
  },
  speed: {
    term: "Speed & stability",
    what: "Whether the page loads quickly and holds still once it does.",
    why: "Combines LCP, CLS and blocking time into the one thing shoppers actually notice: does this feel broken?",
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
