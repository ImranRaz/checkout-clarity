import type {
  AuditStage,
  ForensicAuditReport,
  FrictionPoint,
  StageKind,
  TechnicalMetrics,
} from "./audit-schema";

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

export function scoreStage(stage: AuditStage): ScoreBreakdown {
  return computeScore(stage.technical_metrics, stage.friction_points);
}

/**
 * Stage weights for the roll-up. The cart is where money is lost, the product
 * page is where the decision is made; browse steps matter least.
 */
const STAGE_WEIGHT: Record<StageKind, number> = {
  cart: 1,
  checkout: 1,
  summary: 0.95,
  product: 0.9,
  detail: 0.9,
  form: 0.7,
  "mini-cart": 0.6,
  variant: 0.5,
  options: 0.5,
  category: 0.4,
  listing: 0.4,
  other: 0.5,
};

function gradeFor(total: number): ScoreBreakdown["grade"] {
  return total >= 80 ? "Strong" : total >= 60 ? "Workable" : total >= 40 ? "Leaking" : "Critical";
}

/** Weighted roll-up across every stage the run reached. */
export function scoreReport(report: ForensicAuditReport): ScoreBreakdown {
  const scored = report.stages.map((stage) => ({
    stage,
    weight: STAGE_WEIGHT[stage.kind] ?? 0.5,
    score: scoreStage(stage),
  }));
  const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0) || 1;

  const total = Math.round(
    scored.reduce((sum, s) => sum + s.score.total * s.weight, 0) / totalWeight,
  );

  const keys = scored[0]!.score.components.map((c) => c.key);
  const components: ScoreComponent[] = keys.map((key, index) => {
    const base = scored[0]!.score.components[index]!;
    const earned = Math.round(
      scored.reduce(
        (sum, s) => sum + (s.score.components.find((c) => c.key === key)?.earned ?? 0) * s.weight,
        0,
      ) / totalWeight,
    );
    return {
      key,
      label: base.label,
      weight: base.weight,
      earned,
      detail: `averaged across ${scored.length} stage${scored.length === 1 ? "" : "s"}`,
    };
  });

  return { total, grade: gradeFor(total), components };
}
