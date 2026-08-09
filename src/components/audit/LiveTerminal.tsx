import { motion } from "motion/react";
import { useEffect, useRef } from "react";

import type { LiveStep } from "@/lib/audit.functions";
import type { LogActor } from "@/lib/audit-schema";
import { cn } from "@/lib/utils";

/**
 * The live twin of TerminalPanel: identical chrome, but lines arrive from the
 * worker's real job log instead of a scripted replay. Text is humanised so a
 * non-engineer can follow the journey.
 */

const actorLabel: Record<LogActor, string> = {
  system: "system",
  browser: "browser",
  vision: "agent",
};

const actorColor: Record<LogActor, string> = {
  system: "text-term-system",
  browser: "text-term-browser",
  vision: "text-term-vision",
};

const toneColor: Record<LiveStep["tone"], string> = {
  normal: "text-foreground/85",
  warn: "text-sev-medium",
  error: "text-sev-high",
  success: "text-primary",
};

function formatClock(ms: number): string {
  return `${(Math.floor(Math.max(0, ms) / 100) / 10).toFixed(1)}s`;
}

/** Turns a worker log line into something a non-engineer can read. */
export function humanizeStep(text: string): string {
  const click = /^click (?:the )?(.+?) (?:link|button)$/i.exec(text);
  if (click) return `Clicking “${click[1]}”`;
  const select = /^(?:select|choose) (?:the )?(.+)$/i.exec(text);
  if (select) return `Choosing ${select[1]}`;
  const captured = /^(.+?) captured in (\d+)ms$/i.exec(text);
  if (captured) return `Captured the ${captured[1]!.toLowerCase()} screen`;
  const landed = /^landed on (\w[\w-]*)/i.exec(text);
  if (landed) return `Landed on the ${landed[1]} page`;
  if (/^opening https?:/i.test(text)) return "Opening the store in a cloud browser";
  return text;
}

export function LiveTerminal({
  domain,
  steps,
  elapsedMs,
  status,
  error,
}: {
  domain: string;
  steps: LiveStep[];
  elapsedMs: number;
  status: "starting" | "running" | "done" | "error";
  error: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = status === "starting" || status === "running";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [steps.length, status]);

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
          forensic-agent — {domain}
        </p>
        <p className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {formatClock(elapsedMs)} · {steps.length} steps
        </p>
      </div>

      <div className="h-0.5 w-full overflow-hidden bg-border">
        {active ? (
          <motion.div
            className="h-full w-1/3 bg-primary"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : (
          <div className={cn("h-full w-full", status === "error" ? "bg-sev-high" : "bg-primary")} />
        )}
      </div>

      <div
        ref={scrollRef}
        className="max-h-[26rem] min-h-[20rem] overflow-y-auto bg-card px-4 py-4"
        aria-live="polite"
      >
        <ul className="space-y-1.5 font-mono text-[13px] leading-relaxed">
          {steps.length === 0 && active ? (
            <li className="flex gap-3">
              <span className={cn("w-[4.5rem] shrink-0 select-none", actorColor.system)}>
                [system]
              </span>
              <span className="text-foreground/85">Waking a real browser in the cloud…</span>
            </li>
          ) : null}

          {steps.map((step, index) => (
            <motion.li
              key={`${index}-${step.at}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22 }}
              className="flex gap-3"
            >
              <span className={cn("w-[4.5rem] shrink-0 select-none", actorColor[step.actor])}>
                [{actorLabel[step.actor]}]
              </span>
              <span className={cn("min-w-0 flex-1", toneColor[step.tone])}>
                {humanizeStep(step.text)}
              </span>
            </motion.li>
          ))}

          {error ? (
            <li className="flex gap-3">
              <span className={cn("w-[4.5rem] shrink-0 select-none", actorColor.system)}>
                [system]
              </span>
              <span className="min-w-0 flex-1 text-sev-high">{error}</span>
            </li>
          ) : null}

          {active && (
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
