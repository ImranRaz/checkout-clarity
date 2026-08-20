import { motion } from "motion/react";
import { ArrowRight, Target } from "lucide-react";

import { Explain } from "./Explain";
import { SeverityChip } from "./SeverityChip";
import type { GlossaryKey } from "@/lib/glossary";
import { categoryLabel, impactLabel, type ForensicAuditReport } from "@/lib/audit-schema";
import { buildPillarMatrix, pillarLabel, pillarQuestion, PILLARS, topFix } from "@/lib/pillars";
import { cn } from "@/lib/utils";

/**
 * The header band: four pillars scored per stage, the weakest link named in a
 * sentence, and the single fix worth doing first. Everything here is derived
 * from findings already on the report — no extra measurement, no model call.
 */

const PILLAR_TERM: Record<(typeof PILLARS)[number], GlossaryKey> = {
  clarity: "clarity",
  trust: "trust",
  effort: "effortPillar",
  speed: "speed",
};

function cellTone(score: number) {
  if (score >= 85) return "bg-primary/12 text-primary";
  if (score >= 70) return "bg-secondary text-foreground";
  if (score >= 50) return "bg-sev-medium-soft text-sev-medium";
  return "bg-sev-high-soft text-sev-high";
}

export function ExecutiveSummary({
  report,
  onLocate,
}: {
  report: ForensicAuditReport;
  onLocate: (stageIndex: number, pointId: number) => void;
}) {
  const matrix = buildPillarMatrix(report);
  const fix = topFix(report);
  const diagnosis = report.journey_diagnosis;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="tile overflow-hidden"
      aria-label="Experience summary"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="label-caps flex items-center gap-1">
            Experience summary
            <Explain term="pillars" />
          </h2>
          {diagnosis && (
            <p className="mt-1 text-sm font-medium text-foreground">{diagnosis.headline}</p>
          )}
          {matrix.weakest && (
            <p className="mt-1 text-sm text-foreground">
              Weakest link:{" "}
              <span className="font-medium">{pillarLabel[matrix.weakest.pillar]}</span> at{" "}
              <span className="font-medium">{matrix.weakest.stageLabel}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {" "}
                — {matrix.weakest.score}/100
              </span>
            </p>
          )}
        </div>
      </header>

      {diagnosis && (
        <div className="border-b border-border px-4 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>{diagnosis.vertical}</span>
            <span>{diagnosis.steps_to_commit} steps to commit</span>
            {diagnosis.drop_off_stage && <span>likeliest drop-off · {diagnosis.drop_off_stage}</span>}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{diagnosis.diagnosis}</p>

          {diagnosis.moves.length > 0 && (
            <ol className="mt-4 space-y-2.5">
              {diagnosis.moves.map((move, i) => (
                <li key={move.title} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 font-mono text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{move.title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                      {move.rationale}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {impactLabel[move.impact]} · {move.stage}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div data-print-wrap className="p-4">
        {/* Journey-wide pillar scores: four fixed columns, always readable. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PILLARS.map((pillar) => (
            <div key={pillar} className="rounded-lg border border-border p-3">
              <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                {pillarLabel[pillar]}
                <Explain term={PILLAR_TERM[pillar]} />
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {pillarQuestion[pillar]}
              </span>
              <span
                className={cn(
                  "mt-2 flex h-9 items-center justify-center rounded-md font-mono text-sm font-semibold tabular-nums",
                  cellTone(matrix.overall[pillar]),
                )}
              >
                {matrix.overall[pillar]}
              </span>
            </div>
          ))}
        </div>

        {/* Per-stage breakdown: one readable row per page, scales to any length. */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="label-caps">By page</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {matrix.rows.length} step{matrix.rows.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-2 hidden grid-cols-[minmax(0,1fr)_repeat(4,3.25rem)] gap-x-2 px-2 sm:grid">
            <span />
            {PILLARS.map((pillar) => (
              <span
                key={pillar}
                className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
              >
                {pillar === "speed" ? "Speed" : pillarLabel[pillar]}
              </span>
            ))}
          </div>

          <ul
            data-print-table
            className={cn(
              "mt-1 divide-y divide-border rounded-lg border border-border",
              matrix.rows.length > 8 && "max-h-[26rem] overflow-y-auto",
            )}
          >
            {matrix.rows.map((row, i) => (
              <li
                key={row.stageId}
                className="grid grid-cols-[minmax(0,1fr)_repeat(4,3.25rem)] items-center gap-x-2 px-2 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate text-sm text-foreground" title={row.stageLabel}>
                    {row.stageLabel}
                  </span>
                </span>
                {PILLARS.map((pillar) => {
                  const cell = row.cells[pillar];
                  return (
                    <span
                      key={pillar}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md font-mono text-xs tabular-nums",
                        cellTone(cell.score),
                      )}
                      title={`${pillarLabel[pillar]} · ${cell.score}/100 · ${cell.findings} finding${cell.findings === 1 ? "" : "s"}`}
                    >
                      {cell.score}
                    </span>
                  );
                })}
              </li>
            ))}
          </ul>
        </div>
      </div>


      {fix && (
        <div className="border-t border-border bg-secondary/40 px-4 py-4">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="label-caps">Fix this first</p>
              <p className="mt-1.5 text-sm font-medium text-foreground">{fix.point.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {fix.point.description}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2">
                <SeverityChip severity={fix.point.severity} />
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {categoryLabel[fix.point.category]} · {fix.stageLabel}
                </span>
                <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                  {fix.effortLabel} · +{fix.pointsRecovered} pts
                  <Explain term="effort" />
                </span>
              </p>
              <button
                type="button"
                onClick={() => onLocate(fix.stageIndex, fix.point.id)}
                className="no-print mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-primary hover:underline"
              >
                Show me on the page
                <ArrowRight className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
}
