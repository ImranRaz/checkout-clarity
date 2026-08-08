import { motion } from "motion/react";
import { AlertTriangle, ArrowUpRight, Clock, Gauge, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { SeverityChip } from "./SeverityChip";
import {
  categoryLabel,
  formatBytes,
  formatMs,
  type ForensicAuditReport,
} from "@/lib/audit-schema";
import { scoreReport } from "@/lib/scoring";
import { cn } from "@/lib/utils";

const tileMotion = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

const grade = {
  Strong: "text-primary",
  Workable: "text-sev-medium",
  Leaking: "text-sev-medium",
  Critical: "text-sev-high",
} as const;

export function ReportDashboard({ report }: { report: ForensicAuditReport }) {
  const [active, setActive] = useState<number | null>(null);
  const score = scoreReport(report);
  // A run that never reached the cart has not measured enough to be scored.
  const partial = report.status === "partial";


  return (
    <motion.div
      initial="hidden"
      animate="show"
      transition={{ staggerChildren: 0.08, delayChildren: 0.05 }}
      className="grid gap-4 lg:grid-cols-12"
    >
      {report.status === "partial" && (
        <motion.div
          variants={tileMotion}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="tile flex flex-col gap-2 border-sev-medium/40 bg-sev-medium-soft p-4 lg:col-span-12 sm:flex-row sm:items-start sm:gap-3"
        >
          <ShieldAlert className="size-4 shrink-0 text-sev-medium sm:mt-0.5" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              Partial audit — the agent was stopped at {report.reached_step}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{report.blocked_reason}</p>
          </div>
        </motion.div>
      )}

      {/* Capture with friction pins */}
      <motion.section
        variants={tileMotion}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="tile flex flex-col overflow-hidden lg:col-span-7 lg:row-span-2"
        aria-label="Captured page with friction pins"
      >
        <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="label-caps">Capture</h2>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {report.screenshot.caption}
          </p>
        </header>
        <div className="max-h-[38rem] overflow-y-auto bg-secondary p-4">
          <div className="relative mx-auto w-full max-w-[46rem]">
            <img
              src={report.screenshot.src}
              alt={`Captured ${report.reached_step.toLowerCase()} page for ${report.domain}`}
              width={report.screenshot.width}
              height={report.screenshot.height}
              className="w-full rounded border border-border bg-card"
            />
            {report.ux_friction_points.map((point) => (
              <button
                key={point.id}
                type="button"
                onMouseEnter={() => setActive(point.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(point.id)}
                onBlur={() => setActive(null)}
                style={{
                  left: `${point.x_percentage}%`,
                  top: `${point.y_percentage}%`,
                }}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 rounded-full font-mono text-xs font-semibold transition-all duration-200",
                  "size-7 border-2 border-card ring-2",
                  point.severity === "high" && "bg-sev-high text-card ring-sev-high/35",
                  point.severity === "medium" && "bg-sev-medium text-card ring-sev-medium/35",
                  point.severity === "low" && "bg-sev-low text-card ring-sev-low/35",
                  active === point.id && "scale-125 ring-8",
                  active !== null && active !== point.id && "opacity-40",
                )}
                aria-label={`Friction point ${point.id}: ${point.title}`}
              >
                {point.id}
              </button>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Score */}
      <motion.section
        variants={tileMotion}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="tile p-5 lg:col-span-5"
        aria-label="Overall score"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="label-caps">Forensic score</h2>
            {partial ? (
              <>
                <p className="mt-3 font-mono text-3xl leading-none tracking-tight text-muted-foreground">
                  n/a
                </p>
                <p className="mt-1 text-sm font-medium text-sev-medium">Not scored</p>
              </>
            ) : (
              <>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-6xl leading-none tracking-tight tabular-nums">
                    {score.total}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">/100</span>
                </p>
                <p className={cn("mt-1 text-sm font-medium", grade[score.grade])}>{score.grade}</p>
              </>
            )}
          </div>

          <div className="text-right">
            <p className="label-caps">Run</p>
            <p className="mt-2 flex items-center justify-end gap-1.5 font-mono text-sm tabular-nums">
              <Clock className="size-3.5 text-muted-foreground" aria-hidden />
              {formatMs(report.run_duration_ms)}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              reached {report.reached_step}
            </p>
          </div>
        </div>

        {partial ? (
          <p className="mt-5 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
            The agent never reached a cart, so the signals a score depends on were never measured.
            Scoring the interlock page instead would produce a flattering, meaningless number.
          </p>
        ) : (
          <>
            <ul className="mt-5 space-y-3 border-t border-border pt-4">
              {score.components.map((c) => (
                <li key={c.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-foreground">{c.label}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {c.earned}/{c.weight}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${(c.earned / c.weight) * 100}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{c.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              Computed from measured signals by a fixed rubric — the same page always scores the
              same.
            </p>
          </>
        )}

      </motion.section>

      {/* Technical health */}
      <motion.section
        variants={tileMotion}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="tile p-5 lg:col-span-5"
        aria-label="Technical health"
      >
        <div className="flex items-center gap-2">
          <Gauge className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="label-caps">Technical health</h2>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <Metric label="LCP" value={formatMs(report.technical_metrics.largest_contentful_paint_ms)} />
          <Metric label="CLS" value={report.technical_metrics.cumulative_layout_shift.toFixed(3)} />
          <Metric label="Blocking" value={formatMs(report.technical_metrics.total_blocking_time_ms)} />
          <Metric label="DOM ready" value={formatMs(report.technical_metrics.dom_content_loaded_ms)} />
          <Metric label="Transferred" value={formatBytes(report.technical_metrics.transfer_bytes)} />
          <Metric label="Requests" value={String(report.technical_metrics.request_count)} />
        </dl>

        <div className="mt-5 border-t border-border pt-4">
          <p className="label-caps">
            Console · {report.technical_metrics.console_errors.length}
          </p>
          {report.technical_metrics.console_errors.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-primary">no errors captured</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {report.technical_metrics.console_errors.map((err) => (
                <li key={err} className="flex gap-2 font-mono text-[11px] leading-relaxed">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-sev-high" aria-hidden />
                  <span className="min-w-0 break-words text-muted-foreground">{err}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {report.technical_metrics.slow_resources.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="label-caps">Slowest resources</p>
            <ul className="mt-2 space-y-1.5">
              {report.technical_metrics.slow_resources.map((r) => (
                <li key={r.label} className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
                  <span className="min-w-0 truncate text-muted-foreground">{r.label}</span>
                  <span className="shrink-0 tabular-nums text-foreground">{r.duration_ms} ms</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.section>

      {/* Friction points */}
      <motion.section
        variants={tileMotion}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="tile p-5 lg:col-span-12"
        aria-label="Conversion friction points"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="label-caps">Conversion friction · {report.ux_friction_points.length}</h2>
          <p className="hidden font-mono text-[11px] text-muted-foreground sm:block">
            hover a row to locate it on the capture
          </p>
        </div>

        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {report.ux_friction_points.map((point) => (
            <li
              key={point.id}
              onMouseEnter={() => setActive(point.id)}
              onMouseLeave={() => setActive(null)}
              className={cn(
                "rounded-md border border-border bg-background p-4 transition-colors duration-200",
                active === point.id && "border-primary/50 bg-accent",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold text-card",
                    point.severity === "high" && "bg-sev-high",
                    point.severity === "medium" && "bg-sev-medium",
                    point.severity === "low" && "bg-sev-low",
                  )}
                >
                  {point.id}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground">{point.title}</h3>
                    <SeverityChip severity={point.severity} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {categoryLabel[point.category]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {point.description}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {point.selector} — {point.evidence}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <a
          href={report.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs text-primary underline-offset-4 hover:underline"
        >
          {report.url}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
      </motion.section>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-0.5 font-mono text-lg tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
