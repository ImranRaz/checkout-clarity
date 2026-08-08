import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ForensicAuditReport, LogActor, LogLine } from "@/lib/audit-schema";
import { cn } from "@/lib/utils";

const actorLabel: Record<LogActor, string> = {
  system: "system",
  browser: "browser",
  vision: "vision",
};

const actorColor: Record<LogActor, string> = {
  system: "text-term-system",
  browser: "text-term-browser",
  vision: "text-term-vision",
};

const toneColor: Record<NonNullable<LogLine["tone"]>, string> = {
  normal: "text-foreground/85",
  warn: "text-sev-medium",
  error: "text-sev-high",
  success: "text-primary",
};

function formatClock(ms: number): string {
  const total = Math.floor(ms / 100) / 10;
  return `${total.toFixed(1)}s`;
}

export function TerminalPanel({
  report,
  onComplete,
}: {
  report: ForensicAuditReport;
  onComplete: () => void;
}) {
  const [visible, setVisible] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const completed = useRef(false);

  const total = report.steps.length;
  const cumulative = useMemo(() => {
    let acc = 0;
    return report.steps.map((step) => {
      acc += step.delay_ms;
      return acc;
    });
  }, [report.steps]);

  useEffect(() => {
    const timers = cumulative.map((at, index) =>
      setTimeout(() => setVisible(index + 1), at),
    );
    const last = cumulative[cumulative.length - 1] ?? 0;
    const done = setTimeout(() => {
      if (!completed.current) {
        completed.current = true;
        onComplete();
      }
    }, last + 900);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [cumulative, onComplete]);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible]);

  const progress = total === 0 ? 0 : Math.round((visible / total) * 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="tile overflow-hidden"
    >
      <div className="flex items-center gap-3 border-b border-border bg-secondary px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-sev-high/60" />
          <span className="size-2.5 rounded-full bg-sev-medium/60" />
          <span className="size-2.5 rounded-full bg-primary/50" />
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground">
          forensic-agent — {report.domain}
        </p>
        <p className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {formatClock(elapsed)} · {visible}/{total}
        </p>
      </div>

      <div className="h-0.5 w-full bg-border">
        <motion.div
          className="h-full bg-primary"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div
        ref={scrollRef}
        className="max-h-[26rem] min-h-[20rem] overflow-y-auto bg-card px-4 py-4"
        aria-live="polite"
      >
        <ul className="space-y-1.5 font-mono text-[13px] leading-relaxed">
          {report.steps.slice(0, visible).map((step, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22 }}
              className="flex gap-3"
            >
              <span className={cn("w-[4.5rem] shrink-0 select-none", actorColor[step.actor])}>
                [{actorLabel[step.actor]}]
              </span>
              <span className={cn("min-w-0 flex-1", toneColor[step.tone ?? "normal"])}>
                {step.text}
              </span>
            </motion.li>
          ))}
          {visible < total && (
            <li className="flex gap-3">
              <span className="w-[4.5rem] shrink-0" />
              <motion.span
                animate={{ opacity: [1, 0.15, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="inline-block h-4 w-2 bg-foreground/70"
              />
            </li>
          )}
        </ul>
      </div>
    </motion.div>
  );
}
