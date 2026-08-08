import type { ForensicAuditReport, FrictionPoint, TechnicalMetrics } from "./audit-schema";

/**
 * The score is computed here, in code, from measured signals — never invented
 * by the model. Same page in, same number out.
 */

export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  earned: number;
  detail: string;
}

export interface ScoreBreakdown {
  total: number;
  grade: "Strong" | "Workable" | "Leaking" | "Critical";
  components: ScoreComponent[];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const SEVERITY_PENALTY = { high: 9, medium: 5, low: 2 } as const;

export function computeScore(
  metrics: TechnicalMetrics,
  friction: FrictionPoint[],
): ScoreBreakdown {
  // Loading — LCP scaled between 1.2 s (full marks) and 4.0 s (zero).
  const lcpWeight = 30;
  const lcpRatio = clamp01((4000 - metrics.largest_contentful_paint_ms) / (4000 - 1200));
  const lcpEarned = Math.round(lcpWeight * lcpRatio);

  // Stability — CLS scaled between 0 (full marks) and 0.25 (zero).
  const clsWeight = 15;
  const clsRatio = clamp01((0.25 - metrics.cumulative_layout_shift) / 0.25);
  const clsEarned = Math.round(clsWeight * clsRatio);

  // Runtime integrity — console errors and blocking scripts.
  const errWeight = 15;
  const errPenalty = metrics.console_errors.length * 4 + Math.floor(metrics.total_blocking_time_ms / 300);
  const errEarned = Math.max(0, errWeight - errPenalty);

  // Conversion friction — weighted by severity of each observed friction point.
  const uxWeight = 40;
  const uxPenalty = friction.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);
  const uxEarned = Math.max(0, uxWeight - uxPenalty);

  const total = lcpEarned + clsEarned + errEarned + uxEarned;

  return {
    total,
    grade: total >= 80 ? "Strong" : total >= 60 ? "Workable" : total >= 40 ? "Leaking" : "Critical",
    components: [
      {
        key: "loading",
        label: "Loading",
        weight: lcpWeight,
        earned: lcpEarned,
        detail: `LCP ${(metrics.largest_contentful_paint_ms / 1000).toFixed(2)} s`,
      },
      {
        key: "stability",
        label: "Stability",
        weight: clsWeight,
        earned: clsEarned,
        detail: `CLS ${metrics.cumulative_layout_shift.toFixed(3)}`,
      },
      {
        key: "integrity",
        label: "Runtime integrity",
        weight: errWeight,
        earned: errEarned,
        detail: `${metrics.console_errors.length} console error${
          metrics.console_errors.length === 1 ? "" : "s"
        }, ${metrics.total_blocking_time_ms} ms blocking`,
      },
      {
        key: "friction",
        label: "Conversion friction",
        weight: uxWeight,
        earned: uxEarned,
        detail: `${friction.length} friction point${friction.length === 1 ? "" : "s"} observed`,
      },
    ],
  };
}

export function scoreReport(report: ForensicAuditReport): ScoreBreakdown {
  return computeScore(report.technical_metrics, report.ux_friction_points);
}
