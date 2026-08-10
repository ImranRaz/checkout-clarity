import type {
  AuditStage,
  ForensicAuditReport,
  FrictionCategory,
  FrictionPoint,
  Severity,
  TechnicalMetrics,
} from "./audit-schema";

/**
 * The "so what" layer above the raw findings.
 *
 * Findings are evidence. An owner acts on a weakest-link statement, not on a
 * list, so we roll every finding into four pillars scored per stage. Same
 * inputs in, same numbers out — nothing here is model-generated.
 */

export const PILLARS = ["clarity", "trust", "effort", "speed"] as const;
export type Pillar = (typeof PILLARS)[number];

export const pillarLabel: Record<Pillar, string> = {
  clarity: "Clarity",
  trust: "Trust",
  effort: "Effort",
  speed: "Speed & stability",
};

export const pillarQuestion: Record<Pillar, string> = {
  clarity: "Can a shopper tell what to do next?",
  trust: "Are cost, terms and safety honest at this point?",
  effort: "How much work does this step demand?",
  speed: "Does the page load and hold still?",
};

/**
 * Accessibility is not its own silo. Owners don't ship an "accessibility
 * sprint" off a scan — they fix things that are hard to read or hard to
 * operate, which is Clarity and Effort respectively.
 */
const CATEGORY_PILLAR: Record<FrictionCategory, Pillar> = {
  clarity: "clarity",
  trust: "trust",
  form: "effort",
  accessibility: "effort",
  performance: "speed",
};

const SEVERITY_COST: Record<Severity, number> = { high: 24, medium: 12, low: 5 };

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export interface PillarCell {
  pillar: Pillar;
  score: number;
  findings: number;
  worstSeverity: Severity | null;
}

export interface PillarRow {
  stageId: string;
  stageLabel: string;
  cells: Record<Pillar, PillarCell>;
}

export interface PillarMatrix {
  rows: PillarRow[];
  /** Column averages, weighted by stage importance. */
  overall: Record<Pillar, number>;
  weakest: { pillar: Pillar; stageLabel: string; score: number } | null;
}

/** Speed is measured, not judged, so it starts from the vitals. */
function speedScore(metrics: TechnicalMetrics, findings: FrictionPoint[]): number {
  const lcp = Math.min(1, Math.max(0, (4000 - metrics.largest_contentful_paint_ms) / 2800));
  const cls = Math.min(1, Math.max(0, (0.25 - metrics.cumulative_layout_shift) / 0.25));
  const tbt = Math.min(1, Math.max(0, (900 - metrics.total_blocking_time_ms) / 900));
  const base = lcp * 50 + cls * 25 + tbt * 25;
  const errors = metrics.console_errors.length * 4;
  const flagged = findings.reduce((n, f) => n + SEVERITY_COST[f.severity], 0);
  return clamp(base - errors - flagged);
}

const STAGE_WEIGHT: Record<string, number> = {
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

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

function cellsForStage(stage: AuditStage): Record<Pillar, PillarCell> {
  const grouped: Record<Pillar, FrictionPoint[]> = {
    clarity: [],
    trust: [],
    effort: [],
    speed: [],
  };
  for (const point of stage.friction_points) grouped[CATEGORY_PILLAR[point.category]].push(point);

  const build = (pillar: Pillar): PillarCell => {
    const points = grouped[pillar];
    const score =
      pillar === "speed"
        ? speedScore(stage.technical_metrics, points)
        : clamp(100 - points.reduce((n, f) => n + SEVERITY_COST[f.severity], 0));
    const worst = points.reduce<Severity | null>(
      (acc, f) => (acc === null || SEVERITY_RANK[f.severity] > SEVERITY_RANK[acc] ? f.severity : acc),
      null,
    );
    return { pillar, score, findings: points.length, worstSeverity: worst };
  };

  return {
    clarity: build("clarity"),
    trust: build("trust"),
    effort: build("effort"),
    speed: build("speed"),
  };
}

export function buildPillarMatrix(report: ForensicAuditReport): PillarMatrix {
  const rows: PillarRow[] = report.stages.map((stage) => ({
    stageId: stage.id,
    stageLabel: stage.label,
    cells: cellsForStage(stage),
  }));

  const weights = report.stages.map((s) => STAGE_WEIGHT[s.kind] ?? 0.5);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  const overall = Object.fromEntries(
    PILLARS.map((pillar) => [
      pillar,
      Math.round(
        rows.reduce((sum, row, i) => sum + row.cells[pillar].score * weights[i]!, 0) / totalWeight,
      ),
    ]),
  ) as Record<Pillar, number>;

  let weakest: PillarMatrix["weakest"] = null;
  for (const row of rows) {
    for (const pillar of PILLARS) {
      const cell = row.cells[pillar];
      if (!weakest || cell.score < weakest.score) {
        weakest = { pillar, stageLabel: row.stageLabel, score: cell.score };
      }
    }
  }

  return { rows, overall, weakest };
}

/**
 * Effort to remediate, by finding category. Copy and layout changes ship in an
 * afternoon; performance work is a project. Used to rank impact per unit work
 * rather than raw severity, so the recommendation is actually actionable.
 */
const EFFORT: Record<FrictionCategory, { weight: number; label: string }> = {
  trust: { weight: 1, label: "copy change" },
  clarity: { weight: 1.2, label: "copy or layout change" },
  accessibility: { weight: 1.5, label: "markup change" },
  form: { weight: 2, label: "form change" },
  performance: { weight: 3.5, label: "engineering work" },
};

const IMPACT: Record<Severity, number> = { high: 9, medium: 5, low: 2 };

export interface TopFix {
  point: FrictionPoint;
  stageIndex: number;
  stageLabel: string;
  effortLabel: string;
  /** Pillar score points recovered on that stage if this one finding is resolved. */
  pointsRecovered: number;
}

/** The single highest impact-per-effort finding across the whole journey. */
export function topFix(report: ForensicAuditReport): TopFix | null {
  let best: (TopFix & { ratio: number }) | null = null;

  report.stages.forEach((stage, stageIndex) => {
    const stageWeight = STAGE_WEIGHT[stage.kind] ?? 0.5;
    for (const point of stage.friction_points) {
      const effort = EFFORT[point.category];
      const ratio = (IMPACT[point.severity] * stageWeight) / effort.weight;
      if (!best || ratio > best.ratio) {
        best = {
          ratio,
          point,
          stageIndex,
          stageLabel: stage.label,
          effortLabel: effort.label,
          pointsRecovered: SEVERITY_COST[point.severity],
        };
      }
    }
  });

  if (!best) return null;
  const { ratio: _ratio, ...fix } = best as TopFix & { ratio: number };
  return fix;
}
