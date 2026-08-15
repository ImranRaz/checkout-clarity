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
            <Explain term="cro" />
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

      <div data-print-wrap className="overflow-x-auto p-4">
        <table data-print-table className="w-full min-w-[34rem] border-separate border-spacing-1 text-left">

          <caption className="sr-only">
            Experience pillars scored for each stage of the journey
          </caption>
          <thead>
            <tr>
              <th scope="col" className="label-caps pb-1 pl-1 font-normal">
                Pillar
              </th>
              {matrix.rows.map((row) => (
                <th
                  key={row.stageId}
                  scope="col"
                  className="pb-1 text-center font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-muted-foreground"
                >
                  <span className="mx-auto block max-w-[7rem] truncate">{row.stageLabel}</span>
                </th>
              ))}
              <th
                scope="col"
                className="pb-1 text-center font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-muted-foreground"
              >
                Overall
              </th>
            </tr>
          </thead>
          <tbody>
            {PILLARS.map((pillar) => (
              <tr key={pillar}>
                <th scope="row" className="max-w-[12rem] py-1 pl-1 align-middle font-normal">
                  <span className="block text-sm font-medium text-foreground">
                    {pillarLabel[pillar]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {pillarQuestion[pillar]}
                  </span>
                </th>
                {matrix.rows.map((row) => {
                  const cell = row.cells[pillar];
                  return (
                    <td key={row.stageId} className="p-0.5 text-center align-middle">
                      <span
                        className={cn(
                          "flex h-9 items-center justify-center rounded-md font-mono text-sm tabular-nums",
                          cellTone(cell.score),
                        )}
                        title={`${cell.findings} finding${cell.findings === 1 ? "" : "s"}`}
                      >
                        {cell.score}
                      </span>
                    </td>
                  );
                })}
                <td className="p-0.5 text-center align-middle">
                  <span className="flex h-9 items-center justify-center rounded-md border border-border font-mono text-sm font-semibold tabular-nums">
                    {matrix.overall[pillar]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                  {fix.effortLabel} · +{fix.pointsRecovered} pts
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
