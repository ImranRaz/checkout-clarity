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
export const frictionPointSchema = z.object({
  id: z.number().int(),
  x_percentage: z.number().min(0).max(100),
  y_percentage: z.number().min(0).max(100),
  severity: severitySchema,
  category: frictionCategorySchema,
  title: z.string(),
  description: z.string(),
  evidence: z.string(),
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

export const stageKindSchema = z.enum(["category", "product", "variant", "mini-cart", "cart"]);
export type StageKind = z.infer<typeof stageKindSchema>;

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
  transition_in: z
    .object({ action: z.string(), duration_ms: z.number() })
    .nullable()
    .default(null),
  screenshot: z.object({
    src: z.string(),
    width: z.number(),
    height: z.number(),
    caption: z.string(),
  }),
  technical_metrics: technicalMetricsSchema,
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
});
export type ForensicAuditReport = z.infer<typeof auditReportSchema>;

export const stageKindLabel: Record<StageKind, string> = {
  category: "Category",
  product: "Product page",
  variant: "Variant picker",
  "mini-cart": "Mini-cart",
  cart: "Cart",
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}
