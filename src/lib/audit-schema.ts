import { z } from "zod";

/**
 * The contract shared by fixtures, the UI, and (later) the live browser run.
 * Whatever produces a report must satisfy this schema.
 */

export const severitySchema = z.enum(["high", "medium", "low"]);
export type Severity = z.infer<typeof severitySchema>;

export const frictionCategorySchema = z.enum([
  "trust",
  "clarity",
  "accessibility",
  "form",
  "performance",
]);
export type FrictionCategory = z.infer<typeof frictionCategorySchema>;

/**
 * Pin coordinates are percentages of the captured screenshot. In the live
 * path they are derived from the offending element's bounding box, not
 * guessed by the model.
 */
/** Which lens of the review council produced a finding. */
export const personaSchema = z.enum(["strategist", "copy", "trust", "accessibility", "measured"]);
export type Persona = z.infer<typeof personaSchema>;

export const impactSchema = z.enum(["material", "meaningful", "minor"]);
export type Impact = z.infer<typeof impactSchema>;

export const frictionPointSchema = z.object({
  id: z.number().int(),
  x_percentage: z.number().min(0).max(100),
  y_percentage: z.number().min(0).max(100),
  /**
   * The offending element's box, as percentages of the screenshot. Frozen at
   * capture time so a review that finishes after the agent has navigated on
   * still highlights the right pixels. Absent on older stored reports.
   */
  rect: z
    .object({
      x_percentage: z.number(),
      y_percentage: z.number(),
      w_percentage: z.number(),
      h_percentage: z.number(),
    })
    .optional(),
  severity: severitySchema,
  category: frictionCategorySchema,
  persona: personaSchema.optional(),
  impact: impactSchema.optional(),
  title: z.string(),
  description: z.string(),
  evidence: z.string(),
  recommendation: z.string().optional(),
  rewrite_before: z.string().optional(),
  rewrite_after: z.string().optional(),
  selector: z.string(),
});
export type FrictionPoint = z.infer<typeof frictionPointSchema>;

/**
 * Navigation Timing L2 / PerformanceObserver fields. `window.performance.timing`
 * is deprecated and cannot produce a real TTI, so we do not claim one.
 */
export const technicalMetricsSchema = z.object({
  largest_contentful_paint_ms: z.number(),
  cumulative_layout_shift: z.number(),
  total_blocking_time_ms: z.number(),
  dom_content_loaded_ms: z.number(),
  transfer_bytes: z.number(),
  request_count: z.number(),
  console_errors: z.array(z.string()),
  slow_resources: z.array(z.object({ label: z.string(), duration_ms: z.number() })),
});
export type TechnicalMetrics = z.infer<typeof technicalMetricsSchema>;

export const logActorSchema = z.enum(["system", "browser", "vision"]);
export type LogActor = z.infer<typeof logActorSchema>;

export const logLineSchema = z.object({
  actor: logActorSchema,
  text: z.string(),
  /** Milliseconds to wait before this line appears, replayed in the terminal UI. */
  delay_ms: z.number(),
  tone: z.enum(["normal", "warn", "error", "success"]).default("normal"),
});
export type LogLine = z.infer<typeof logLineSchema>;

/**
 * Deliberately generic: a shoe store runs listing → product → cart, a cruise
 * line runs listing → detail → options → form → summary → cart. The agent is
 * not tied to a retail script, so neither is the vocabulary.
 */
export const stageKindSchema = z.enum([
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
export type StageKind = z.infer<typeof stageKindSchema>;

/**
 * The result of scrolling a page from top to bottom before capturing it.
 * Everything here is measured during the sweep, not inferred from the DOM at
 * rest, which is why it can say things a static capture never could: what
 * never loaded, what stayed pinned, how far down the decision lives.
 */
export const scrollProfileSchema = z.object({
  /** Page height in viewports. 1.0 means everything fits on one screen. */
  viewports: z.number().default(1),
  document_height: z.number().default(0),
  viewport_height: z.number().default(0),
  steps: z.number().default(0),
  swept: z.boolean().default(false),
  /** Layout shift accumulated *after* load, during the scroll. */
  shift_after_load: z.number().default(0),
  long_tasks: z.number().default(0),
  longest_task_ms: z.number().default(0),
  /** Large images still blank after being scrolled into view. */
  stalled_media_count: z.number().default(0),
  media_count: z.number().default(0),
  infinite_scroll: z.boolean().default(false),
  sticky: z
    .array(
      z.object({
        text: z.string().default(""),
        coverage_percentage: z.number().default(0),
        edge: z.string().default("middle"),
      }),
    )
    .default([]),
  primary_cta: z
    .object({
      text: z.string().default(""),
      /** How far down the page the buying action sits, as a percentage. */
      depth_percentage: z.number().default(0),
      sticky: z.boolean().default(false),
    })
    .nullable()
    .default(null),
});
export type ScrollProfile = z.infer<typeof scrollProfileSchema>;

/**
 * A pop-up the shopper had to get past. Recorded before dismissal, because
 * the first thing a site says to a visitor is part of the experience being
 * audited — not noise to be clicked away silently.
 */
export const interstitialSchema = z.object({
  heading: z.string().default(""),
  text: z.string().default(""),
  /** Milliseconds after landing before it appeared. */
  elapsed_ms: z.number().default(0),
  coverage_percentage: z.number().default(0),
  accept_label: z.string().default(""),
  decline_label: z.string().default(""),
  /** True when declining is visually de-emphasised next to accepting. */
  decline_is_weaker: z.boolean().default(false),
  has_close_control: z.boolean().default(false),
  asks_for_input: z.number().default(0),
  repeat_count: z.number().default(1),
  /** Cropped screenshot of the overlay itself, as a data URL. */
  image: z.string().nullable().default(null),
});
export type Interstitial = z.infer<typeof interstitialSchema>;


/**
 * A stage is one page the agent actually landed on. A run records only the
 * stages it reached, so a two-step site has two stages and a four-step site
 * has four.
 */
export const stageSchema = z.object({
  id: z.string(),
  kind: stageKindSchema,
  label: z.string(),
  url: z.string(),
  /** How the agent got here from the previous stage. Null for the entry stage. */
  transition_in: z.object({ action: z.string(), duration_ms: z.number() }).nullable().default(null),
  screenshot: z.object({
    src: z.string(),
    width: z.number(),
    height: z.number(),
    caption: z.string(),
  }),
  technical_metrics: technicalMetricsSchema,
  /**
   * What the agent learned by scrolling the page top to bottom before
   * capturing it. Null when the page was too short to sweep, or when the
   * sweep failed — the report degrades to what it showed before.
   */
  scroll_profile: scrollProfileSchema.nullable().default(null),
  /** Pop-ups that interrupted the shopper on the way to this stage. */
  interstitials: z.array(interstitialSchema).default([]),
  friction_points: z.array(frictionPointSchema),
});

export type AuditStage = z.infer<typeof stageSchema>;

export const auditReportSchema = z.object({
  id: z.string(),
  url: z.string(),
  domain: z.string(),
  /** "complete" reached the cart; "partial" was stopped before it. */
  status: z.enum(["complete", "partial"]),
  blocked_reason: z.string().nullable(),
  captured_at: z.string(),
  run_duration_ms: z.number(),
  steps: z.array(logLineSchema),
  stages: z.array(stageSchema).min(1),
  /**
   * The run-level judgement: the shape of the funnel and the three changes
   * worth doing first. Optional so reports captured before it existed parse.
   */
  journey_diagnosis: z
    .object({
      headline: z.string(),
      diagnosis: z.string(),
      steps_to_commit: z.number(),
      drop_off_stage: z.string(),
      vertical: z.string(),
      moves: z.array(
        z.object({
          title: z.string(),
          rationale: z.string(),
          impact: impactSchema,
          stage: z.string(),
        }),
      ),
    })
    .optional(),
});
export type ForensicAuditReport = z.infer<typeof auditReportSchema>;

export const stageKindLabel: Record<StageKind, string> = {
  category: "Category",
  listing: "Listing",
  product: "Product page",
  detail: "Detail page",
  variant: "Variant picker",
  options: "Options",
  form: "Details form",
  "mini-cart": "Mini-cart",
  summary: "Summary",
  cart: "Cart",
  checkout: "Checkout",
  other: "Step",
};

/** The last stage the run actually reached. */
export function reachedStep(report: ForensicAuditReport): string {
  return report.stages[report.stages.length - 1]!.label;
}

export function allFrictionPoints(report: ForensicAuditReport): FrictionPoint[] {
  return report.stages.flatMap((s) => s.friction_points);
}

export function totalConsoleErrors(report: ForensicAuditReport): number {
  return report.stages.reduce((n, s) => n + s.technical_metrics.console_errors.length, 0);
}

export const severityLabel: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const categoryLabel: Record<FrictionCategory, string> = {
  trust: "Trust",
  clarity: "Clarity",
  accessibility: "Accessibility",
  form: "Form design",
  performance: "Performance",
};

export const personaLabel: Record<Persona, string> = {
  strategist: "Conversion strategy",
  copy: "Copy & messaging",
  trust: "Trust & risk",
  accessibility: "Accessibility",
  measured: "Measured",
};

export const impactLabel: Record<Impact, string> = {
  material: "Material impact",
  meaningful: "Meaningful impact",
  minor: "Minor impact",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}
