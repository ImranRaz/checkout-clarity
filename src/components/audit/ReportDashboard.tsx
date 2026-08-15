import { motion } from "motion/react";
import { AlertTriangle, ArrowUpRight, Clock, Maximize2, ShieldAlert, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ExecutiveSummary } from "./ExecutiveSummary";
import { Explain } from "./Explain";
import type { GlossaryKey } from "@/lib/glossary";
import { Interstitials, ScrollPass } from "./ScrollEvidence";
import { SeverityChip } from "./SeverityChip";

import {
  categoryLabel,
  formatBytes,
  impactLabel,
  personaLabel,
  formatMs,
  reachedStep,
  type AuditStage,
  type ForensicAuditReport,
  type FrictionPoint,
} from "@/lib/audit-schema";
import { scoreReport, scoreStage } from "@/lib/scoring";
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

const sevDot = {
  high: "bg-sev-high",
  medium: "bg-sev-medium",
  low: "bg-sev-low",
} as const;

/** One entry per finding, flattened across stages, for keyboard traversal. */
interface Cursor {
  stageIndex: number;
  pointId: number;
}

export function ReportDashboard({ report }: { report: ForensicAuditReport }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(true);

  const stage = report.stages[stageIndex]!;
  const score = scoreReport(report);
  const partial = report.status === "partial";

  const flat: Cursor[] = useMemo(
    () =>
      report.stages.flatMap((s, i) => s.friction_points.map((p) => ({ stageIndex: i, pointId: p.id }))),
    [report.stages],
  );

  const select = useCallback((nextStage: number, pointId: number | null) => {
    setStageIndex(nextStage);
    setActiveId(pointId);
    if (pointId !== null) setZoomed(true);
  }, []);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (flat.length === 0) return;
      const current = flat.findIndex((c) => c.stageIndex === stageIndex && c.pointId === activeId);
      const next = current === -1 ? 0 : (current + direction + flat.length) % flat.length;
      const target = flat[next]!;
      select(target.stageIndex, target.pointId);
    },
    [activeId, flat, select, stageIndex],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        step(1);
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "Escape") {
        setActiveId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const activePoint = stage.friction_points.find((p) => p.id === activeId) ?? null;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      transition={{ staggerChildren: 0.07, delayChildren: 0.05 }}
      className="space-y-4"
    >
      {partial && (
        <motion.div
          variants={tileMotion}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="tile flex flex-col gap-2 border-sev-medium/40 bg-sev-medium-soft p-4 sm:flex-row sm:items-start sm:gap-3"
        >
          <ShieldAlert className="size-4 shrink-0 text-sev-medium sm:mt-0.5" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              Partial audit — the agent was stopped at {reachedStep(report)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{report.blocked_reason}</p>
          </div>
        </motion.div>
      )}

      {/* Verdict bar — the number and the export live where an executive lands first. */}
      <motion.section
        variants={tileMotion}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="tile flex flex-wrap items-center justify-between gap-4 p-4"
        aria-label="Verdict"
      >
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="font-display text-4xl leading-none tracking-tight tabular-nums">
            {partial ? "n/a" : score.total}
          </span>
          {!partial && (
            <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
              /100
              <Explain term="score" />
            </span>
          )}
          <span className="min-w-0">
            <span
              className={cn(
                "block text-sm font-medium",
                partial ? "text-sev-medium" : grade[score.grade],
              )}
            >
              {partial ? "Not scored" : score.grade}
            </span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">
              {report.domain} · {report.stages.length} stages ·{" "}
              {report.stages.reduce((n, s) => n + s.friction_points.length, 0)} findings ·{" "}
              {formatMs(report.run_duration_ms)}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowUpRight className="size-3.5" aria-hidden />
          Export PDF
        </button>
      </motion.section>


      {/* Journey strip */}

      <motion.section
        variants={tileMotion}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="tile p-4"
        aria-label="Journey stages"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="label-caps">Journey · {report.stages.length} stages</h2>
          <p className="hidden font-mono text-[11px] text-muted-foreground sm:block">
            J / K to walk findings
          </p>
        </div>
        <ol data-print-wrap className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {report.stages.map((s, i) => (
            <li key={s.id} className="flex shrink-0 items-center gap-3">
              {i > 0 && (
                <span className="hidden w-24 shrink-0 text-center font-mono text-[10px] leading-tight text-muted-foreground sm:block">
                  {s.transition_in ? formatMs(s.transition_in.duration_ms) : ""}
                  <span className="mt-0.5 block border-t border-dashed border-border pt-1">→</span>
                </span>
              )}
              <StageCard
                stage={s}
                index={i}
                selected={i === stageIndex}
                partial={partial}
                onSelect={() => select(i, null)}
              />
            </li>
          ))}
        </ol>
      </motion.section>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Findings rail */}
        <motion.section
          variants={tileMotion}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="tile flex flex-col overflow-hidden lg:col-span-5"
          aria-label="Findings"
        >
          <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="label-caps flex items-center gap-1">
              Findings · {report.stages.reduce((n, s) => n + s.friction_points.length, 0)}
              <Explain term="severity" />
              <Explain term="impact" />
            </h2>
            <p className="font-mono text-[11px] text-muted-foreground">select to locate</p>
          </header>
          <div data-print-expand className="max-h-[40rem] overflow-y-auto p-3">
            {report.stages.map((s, i) => (
              <div key={s.id} className="mb-4 last:mb-0">
                <button
                  type="button"
                  onClick={() => select(i, null)}
                  className={cn(
                    "flex w-full items-baseline justify-between gap-2 rounded px-2 py-1.5 text-left transition-colors",
                    i === stageIndex ? "bg-accent" : "hover:bg-secondary",
                  )}
                >
                  <span className="label-caps">
                    {i + 1}. {s.label}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {partial ? "n/a" : `${scoreStage(s).total}/100`} · {s.friction_points.length}
                  </span>
                </button>
                <ul className="mt-1.5 space-y-1.5">
                  {s.friction_points.map((point) => {
                    const isActive = i === stageIndex && point.id === activeId;
                    return (
                      <li key={point.id}>
                        <button
                          type="button"
                          onClick={() => select(i, point.id)}
                          className={cn(
                            "w-full rounded-md border border-transparent px-2.5 py-2 text-left transition-colors",
                            isActive
                              ? "border-primary/50 bg-accent"
                              : "hover:border-border hover:bg-secondary",
                          )}
                        >
                          <span className="flex items-start gap-2.5">
                            <span
                              className={cn(
                                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold text-card",
                                sevDot[point.severity],
                              )}
                            >
                              {point.id}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-foreground">
                                {point.title}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-2">
                                <SeverityChip severity={point.severity} />
                                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                  {categoryLabel[point.category]}
                                </span>
                                {point.persona && (
                                  <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                    {personaLabel[point.persona]}
                                  </span>
                                )}
                                {point.impact && (
                                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                                    {impactLabel[point.impact]}
                                  </span>
                                )}
                              </span>
                              {isActive && (
                                <>
                                  <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                                    {point.description}
                                  </span>
                                  {point.recommendation && (
                                    <span className="mt-2 block rounded-md bg-secondary px-2.5 py-2 text-sm leading-relaxed text-foreground">
                                      <span className="label-caps block">Recommendation</span>
                                      <span className="mt-1 block">{point.recommendation}</span>
                                    </span>
                                  )}
                                  {point.rewrite_after && (
                                    <span className="mt-2 block rounded-md border border-border px-2.5 py-2">
                                      <span className="label-caps block">Suggested copy</span>
                                      {point.rewrite_before && (
                                        <span className="mt-1 block font-mono text-[11px] leading-relaxed text-muted-foreground line-through">
                                          {point.rewrite_before}
                                        </span>
                                      )}
                                      <span className="mt-1 block font-mono text-[11px] leading-relaxed text-foreground">
                                        {point.rewrite_after}
                                      </span>
                                    </span>
                                  )}
                                  <span className="mt-2 block font-mono text-[11px] text-muted-foreground">
                                    {point.selector} — {point.evidence}
                                  </span>
                                </>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Evidence viewer */}
        <motion.section
          variants={tileMotion}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="tile flex flex-col overflow-hidden lg:col-span-7"
          aria-label="Evidence"
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="label-caps">Evidence · {stage.label}</h2>
              <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                {activePoint ? activePoint.selector : stage.screenshot.caption}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <ViewToggle active={zoomed} onClick={() => setZoomed(true)} icon={<ZoomIn className="size-3.5" />}>
                Focus
              </ViewToggle>
              <ViewToggle
                active={!zoomed}
                onClick={() => setZoomed(false)}
                icon={<Maximize2 className="size-3.5" />}
              >
                Full page
              </ViewToggle>
            </div>
          </header>

          <EvidenceViewer
            stage={stage}
            activeId={activeId}
            zoomed={zoomed && activePoint !== null}
            onSelect={(id) => select(stageIndex, id)}
          />

          <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
            <p className="font-mono text-[11px] text-muted-foreground">
              {activePoint
                ? `finding ${activePoint.id} of ${stage.friction_points.length} on this stage`
                : `${stage.friction_points.length} pins on this stage`}
            </p>
            <div className="flex gap-1">
              <NavButton onClick={() => step(-1)}>← prev</NavButton>
              <NavButton onClick={() => step(1)}>next →</NavButton>
            </div>
          </footer>
        </motion.section>
      </div>

      <ExecutiveSummary report={report} onLocate={(s, id) => select(s, id)} />



      <div className="grid gap-4 lg:grid-cols-12">
        {/* Score */}
        <motion.section
          variants={tileMotion}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="tile p-5 lg:col-span-5"
          aria-label="Overall score"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="label-caps flex items-center gap-1">
                Score breakdown
                <Explain term="score" />
              </h2>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-4xl leading-none tracking-tight tabular-nums">
                  {partial ? "n/a" : score.total}
                </span>
                {!partial && <span className="font-mono text-sm text-muted-foreground">/100</span>}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm font-medium",
                  partial ? "text-sev-medium" : grade[score.grade],
                )}
              >
                {partial ? "Not scored" : score.grade}
              </p>
            </div>

            <div className="text-right">
              <p className="label-caps">Run</p>
              <p className="mt-2 flex items-center justify-end gap-1.5 font-mono text-sm tabular-nums">
                <Clock className="size-3.5 text-muted-foreground" aria-hidden />
                {formatMs(report.run_duration_ms)}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                reached {reachedStep(report)}
              </p>
            </div>
          </div>


          {partial ? (
            <p className="mt-5 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
              The agent never reached a product page or a cart, so the signals a score depends on
              were never measured. Scoring the interlock page instead would produce a flattering,
              meaningless number.
            </p>
          ) : (
            <>
              <ul className="mt-5 space-y-3 border-t border-border pt-4">
                {report.stages.map((s) => {
                  const stageScore = scoreStage(s);
                  return (
                    <li key={s.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-foreground">{s.label}</span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {stageScore.total}/100
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                        <motion.div
                          className="h-full rounded-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${stageScore.total}%` }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
                Roll-up weights the cart heaviest, then the product page. Same pages in, same number
                out.
              </p>
            </>
          )}
        </motion.section>

        {/* Stage metrics */}
        <motion.section
          variants={tileMotion}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="tile p-5 lg:col-span-7"
          aria-label="Technical metrics for the selected stage"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="label-caps">Browser metrics · {stage.label}</h2>
            {stage.transition_in && (
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {stage.transition_in.action}
              </p>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Metric
              label="LCP"
              term="lcp"
              value={formatMs(stage.technical_metrics.largest_contentful_paint_ms)}
            />
            <Metric
              label="CLS"
              term="cls"
              value={stage.technical_metrics.cumulative_layout_shift.toFixed(3)}
            />
            <Metric
              label="Blocking"
              term="tbt"
              value={formatMs(stage.technical_metrics.total_blocking_time_ms)}
            />
            <Metric
              label="DOM ready"
              term="domReady"
              value={formatMs(stage.technical_metrics.dom_content_loaded_ms)}
            />
            <Metric
              label="Transferred"
              term="transferred"
              value={formatBytes(stage.technical_metrics.transfer_bytes)}
            />
            <Metric
              label="Requests"
              term="requests"
              value={String(stage.technical_metrics.request_count)}
            />
          </dl>

          {stage.scroll_profile && <ScrollPass profile={stage.scroll_profile} />}
          {stage.interstitials && stage.interstitials.length > 0 && (
            <Interstitials items={stage.interstitials} />
          )}

          <div className="mt-5 border-t border-border pt-4">
            <p className="label-caps flex items-center gap-1">
              Console · {stage.technical_metrics.console_errors.length}
              <Explain term="consoleErrors" />
            </p>
            {stage.technical_metrics.console_errors.length === 0 ? (
              <p className="mt-2 font-mono text-xs text-primary">no errors captured</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {stage.technical_metrics.console_errors.map((err) => (
                  <li key={err} className="flex gap-2 font-mono text-[11px] leading-relaxed">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0 text-sev-high" aria-hidden />
                    <span className="min-w-0 break-words text-muted-foreground">{err}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {stage.technical_metrics.slow_resources.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="label-caps flex items-center gap-1">
                Slowest resources
                <Explain term="slowResources" />
              </p>
              <ul className="mt-2 space-y-1.5">
                {stage.technical_metrics.slow_resources.map((r) => (
                  <li
                    key={r.label}
                    className="flex items-baseline justify-between gap-3 font-mono text-[11px]"
                  >
                    <span className="min-w-0 truncate text-muted-foreground">{r.label}</span>
                    <span className="shrink-0 tabular-nums text-foreground">{r.duration_ms} ms</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <a
            href={stage.url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs text-primary underline-offset-4 hover:underline"
          >
            {stage.url}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </motion.section>
      </div>
    </motion.div>
  );
}

function StageCard({
  stage,
  index,
  selected,
  partial,
  onSelect,
}: {
  stage: AuditStage;
  index: number;
  selected: boolean;
  partial: boolean;
  onSelect: () => void;
}) {
  const highs = stage.friction_points.filter((p) => p.severity === "high").length;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={cn(
        "flex w-52 shrink-0 items-center gap-3 rounded-md border p-2 text-left transition-all duration-200",
        selected
          ? "border-primary/60 bg-accent shadow-tile"
          : "border-border bg-background hover:border-primary/30",
      )}
    >
      <img
        src={stage.screenshot.src}
        alt=""
        loading="lazy"
        width={stage.screenshot.width}
        height={stage.screenshot.height}
        className="h-14 w-11 shrink-0 rounded-sm border border-border object-cover object-top"
      />
      <span className="min-w-0">
        <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Stage {index + 1}
        </span>
        <span className="block truncate text-sm font-medium text-foreground">{stage.label}</span>
        <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-muted-foreground">
          {partial ? "n/a" : `${scoreStage(stage).total}/100`} · {stage.friction_points.length}
          {highs > 0 && <span className="text-sev-high"> · {highs} high</span>}
        </span>
      </span>
    </button>
  );
}

/**
 * Every finding has a centre; the newer ones also carry the offending
 * element's real box. Older stored reports fall back to a small box around
 * the centre so the viewer behaves identically either way.
 */
function pointRect(point: FrictionPoint) {
  if (point.rect) {
    return {
      x: point.rect.x_percentage,
      y: point.rect.y_percentage,
      w: Math.max(point.rect.w_percentage, 2),
      h: Math.max(point.rect.h_percentage, 0.8),
    };
  }
  return {
    x: Math.max(0, point.x_percentage - 12),
    y: Math.max(0, point.y_percentage - 3),
    w: 24,
    h: 6,
  };
}

const clampNum = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function EvidenceViewer({
  stage,
  activeId,
  zoomed,
  onSelect,
}: {
  stage: AuditStage;
  activeId: number | null;
  zoomed: boolean;
  onSelect: (id: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });


  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const point = stage.friction_points.find((p) => p.id === activeId) ?? null;
  const ratio = stage.screenshot.height / stage.screenshot.width;
  const rect = point ? pointRect(point) : null;

  // In full-page mode, bring the selected pin into view instead of leaving the
  // reader at the top of a very tall composite.
  const rectY = rect?.y ?? null;
  useEffect(() => {
    if (zoomed || rectY === null) return;
    const el = fullRef.current;
    if (!el) return;
    const img = el.querySelector("img");
    const height = img?.clientHeight ?? el.scrollHeight;
    el.scrollTo({ top: Math.max(0, (rectY / 100) * height - el.clientHeight / 3), behavior: "smooth" });
  }, [rectY, zoomed, activeId]);



  // Scale so the offending element fills roughly half the frame in each axis,
  // rather than applying one blunt zoom to a full-page capture.
  const zoomFor = () => {
    if (!rect || box.w === 0) return 2.4;
    const byWidth = 55 / rect.w;
    const byHeight = box.h === 0 ? byWidth : (55 / rect.h) * (box.h / box.w) / ratio;
    return clampNum(Math.min(byWidth, byHeight), 1.4, 6);
  };
  const zoom = zoomFor();

  const imgW = box.w * zoom;
  const imgH = imgW * ratio;
  // Centre on the element's box, not on a bare point.
  const cx = rect ? ((rect.x + rect.w / 2) / 100) * imgW : 0;
  const cy = rect ? ((rect.y + rect.h / 2) / 100) * imgH : 0;
  const tx = rect ? clampNum(box.w / 2 - cx, Math.min(box.w - imgW, 0), 0) : 0;
  const ty = rect ? clampNum(box.h / 2 - cy, Math.min(box.h - imgH, 0), 0) : 0;

  // A finding below the fold is proved by the screen the shopper was on, not
  // by a pin on a full-page composite nobody ever sees at once.
  if (zoomed && point?.evidence_image) {
    const frame = stage.scroll_profile?.frames?.find((f) => f.src === point.evidence_image) ?? null;
    // Re-express the element's page-level box inside this viewport frame.
    const span = frame ? Math.max(0.1, frame.bottom_percentage - frame.top_percentage) : 0;
    const local =
      frame && rect
        ? {
            x: rect.x,
            y: ((rect.y - frame.top_percentage) / span) * 100,
            w: rect.w,
            h: (rect.h / span) * 100,
          }
        : null;
    const inFrame = local !== null && local.y > -10 && local.y < 105;
    return (
      <div className="flex max-h-[40rem] flex-col overflow-y-auto bg-secondary p-4">
        <div className="relative mx-auto w-full max-w-[44rem]">
          <img
            src={point.evidence_image}
            alt={point.evidence_caption ?? `Viewport evidence for: ${point.title}`}
            className="w-full rounded border border-border bg-card"
          />
          {inFrame && local && (
            <>
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute rounded-sm border-2",
                  point.severity === "high" && "border-sev-high",
                  point.severity === "medium" && "border-sev-medium",
                  point.severity === "low" && "border-sev-low",
                )}
                style={{
                  left: `${clampNum(local.x, 0, 98)}%`,
                  top: `${clampNum(local.y, 0, 98)}%`,
                  width: `${Math.min(local.w, 100 - clampNum(local.x, 0, 98))}%`,
                  height: `${Math.max(1.5, Math.min(local.h, 100 - clampNum(local.y, 0, 98)))}%`,
                }}
              />
              <span
                aria-hidden
                style={{
                  left: `${clampNum(local.x, 0, 96)}%`,
                  top: `${clampNum(local.y, 0, 96)}%`,
                  transform: `translate(${local.x < 6 ? "8%" : "-108%"}, ${local.y < 6 ? "8%" : "-108%"})`,
                }}
                className={cn(
                  "absolute flex size-7 items-center justify-center rounded-full border-2 border-card font-mono text-xs font-semibold ring-2",
                  point.severity === "high" && "bg-sev-high text-card ring-sev-high/35",
                  point.severity === "medium" && "bg-sev-medium text-card ring-sev-medium/35",
                  point.severity === "low" && "bg-sev-low text-card ring-sev-low/35",
                )}
              >
                {point.id}
              </span>
            </>
          )}
        </div>
        <p className="mx-auto mt-2 max-w-[44rem] text-xs leading-relaxed text-muted-foreground">
          {point.evidence_caption ?? "The viewport captured during the scroll pass."}
          {frame ? ` · ${Math.round(frame.depth_percentage)}% down the page` : ""}
          {!inFrame && " · exact element sits outside this frame"}
        </p>
      </div>
    );
  }

  if (!zoomed) {

    return (
      <div ref={fullRef} className="relative max-h-[40rem] overflow-y-auto bg-secondary p-4">
        <div className="relative mx-auto w-full max-w-[44rem]">
          <img
            src={stage.screenshot.src}
            alt={`Captured ${stage.label.toLowerCase()} for the audited store`}
            width={stage.screenshot.width}
            height={stage.screenshot.height}
            className="w-full rounded border border-border bg-card"
          />
          {stage.friction_points.map((p) => (
            <Pin
              key={p.id}
              point={p}
              active={p.id === activeId}
              dim={activeId !== null && p.id !== activeId}
              onSelect={() => onSelect(p.id)}
            />
          ))}
        </div>
      </div>
    );
  }


  return (
    <div ref={containerRef} className="relative h-[26rem] overflow-hidden bg-secondary sm:h-[32rem]">
      <motion.div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: imgW || "100%" }}
        animate={{ x: tx, y: ty }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <img
          src={stage.screenshot.src}
          alt={`Captured ${stage.label.toLowerCase()} for the audited store`}
          width={stage.screenshot.width}
          height={stage.screenshot.height}
          className="w-full bg-card"
        />
        {point && rect && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute rounded-sm border-2 shadow-[0_0_0_9999px_rgba(20,20,20,0.45)]",
              point.severity === "high" && "border-sev-high",
              point.severity === "medium" && "border-sev-medium",
              point.severity === "low" && "border-sev-low",
            )}
            style={{
              left: `${rect.x}%`,
              top: `${rect.y}%`,
              width: `${rect.w}%`,
              height: `${rect.h}%`,
            }}
          />
        )}
        {stage.friction_points.map((p) => (
          <Pin
            key={p.id}
            point={p}
            active={p.id === activeId}
            dim={activeId !== null && p.id !== activeId}
            onSelect={() => onSelect(p.id)}
          />
        ))}
      </motion.div>
    </div>
  );
}

/**
 * The badge sits just outside the element it points at — above-left by
 * default, flipping to whichever side has room — so it never covers the very
 * thing the finding is describing.
 */
function Pin({
  point,
  active,
  dim,
  onSelect,
}: {
  point: FrictionPoint;
  active: boolean;
  dim: boolean;
  onSelect: () => void;
}) {
  const rect = pointRect(point);
  const flipRight = rect.x < 6;
  const flipDown = rect.y < 3;
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        left: `${flipRight ? rect.x + rect.w : rect.x}%`,
        top: `${flipDown ? rect.y + rect.h : rect.y}%`,
        transform: `translate(${flipRight ? "8%" : "-108%"}, ${flipDown ? "8%" : "-108%"})`,
      }}
      className={cn(
        "absolute rounded-full font-mono text-xs font-semibold transition-all duration-200",
        "size-7 border-2 border-card ring-2",
        point.severity === "high" && "bg-sev-high text-card ring-sev-high/35",
        point.severity === "medium" && "bg-sev-medium text-card ring-sev-medium/35",
        point.severity === "low" && "bg-sev-low text-card ring-sev-low/35",
        active && "scale-125 ring-8",
        dim && "opacity-40",
      )}
      aria-label={`Finding ${point.id}: ${point.title}`}
    >
      {point.id}
    </button>
  );
}


function ViewToggle({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
        active
          ? "border-primary/50 bg-accent text-foreground"
          : "border-border text-muted-foreground hover:bg-secondary",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function NavButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Metric({
  label,
  value,
  term,
  metric,
  raw,
}: {
  label: string;
  value: string;
  term?: GlossaryKey;
  metric?: BenchmarkKey;
  raw?: number;
}) {
  return (
    <div>
      <dt className="label-caps flex items-center gap-1">
        {label}
        {term && <Explain term={term} />}
      </dt>
      <dd className="mt-0.5 font-mono text-lg tabular-nums text-foreground">{value}</dd>
      {metric && raw !== undefined && <Gauge metric={metric} value={raw} />}
    </div>
  );
}
