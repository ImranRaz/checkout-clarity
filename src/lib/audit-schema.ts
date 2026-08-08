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

export const auditReportSchema = z.object({
  id: z.string(),
  url: z.string(),
  domain: z.string(),
  /** "complete" reached the cart; "partial" was stopped before it. */
  status: z.enum(["complete", "partial"]),
  blocked_reason: z.string().nullable(),
  captured_at: z.string(),
  run_duration_ms: z.number(),
  reached_step: z.string(),
  screenshot: z.object({
    src: z.string(),
    width: z.number(),
    height: z.number(),
    caption: z.string(),
  }),
  steps: z.array(logLineSchema),
  technical_metrics: technicalMetricsSchema,
  ux_friction_points: z.array(frictionPointSchema),
});
export type ForensicAuditReport = z.infer<typeof auditReportSchema>;

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
