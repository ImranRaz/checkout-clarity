import { AnimatePresence, motion } from "motion/react";
import { Bot, Chrome, Eye, Loader2, Terminal } from "lucide-react";
import { useEffect, useRef } from "react";

import type { LiveStep } from "@/lib/audit.functions";
import { cn } from "@/lib/utils";

/**
 * The live feed of what the agent is doing right now. Lines arrive from the
 * worker's job log as the run progresses, so nothing here is simulated.
 */

const ACTOR_META = {
  system: { icon: Terminal, label: "agent", className: "text-muted-foreground" },
  browser: { icon: Chrome, label: "browser", className: "text-primary" },
  vision: { icon: Eye, label: "action", className: "text-sev-medium" },
} as const;

/** Pulls the interesting nouns out of a step so they can be highlighted. */
const HIGHLIGHT =
  /\b(add to cart|added to cart|add-to-cart|cart page|mini-cart|cart|checkout|quantity|variant|size|colou?r|price|product page|category|shipping)\b/gi;

function Highlighted({ text }: { text: string }) {
  const parts = text.split(HIGHLIGHT);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="rounded-sm bg-primary/12 px-1 py-px font-medium text-primary"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function LiveConsole({
  steps,
  elapsedMs,
  status,
  error,
}: {
  steps: LiveStep[];
  elapsedMs: number;
  status: "starting" | "running" | "done" | "error";
  error: string | null;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [steps.length, status]);

  const active = status === "starting" || status === "running";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="tile mt-6 overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-3">
        <p className="label-caps flex items-center gap-2">
          <Bot className="size-3.5 text-primary" aria-hidden />
          Agent session
        </p>
        <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          {active ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
          {active ? "live" : status} · {formatElapsed(elapsedMs)}
        </p>
      </div>

      <ol
        className="max-h-72 space-y-1.5 overflow-y-auto px-5 py-4"
        aria-live="polite"
        aria-busy={active}
      >
        <AnimatePresence initial={false}>
          {steps.map((step, index) => {
            const meta = ACTOR_META[step.actor] ?? ACTOR_META.system;
            const Icon = meta.icon;
            return (
              <motion.li
                key={`${index}-${step.at}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22 }}
                className="flex items-start gap-2.5 font-mono text-[12px] leading-relaxed"
              >
                <span className="w-9 shrink-0 pt-px text-[10px] text-muted-foreground tabular-nums">
                  {formatElapsed(step.at)}
                </span>
                <Icon className={cn("mt-0.5 size-3 shrink-0", meta.className)} aria-hidden />
                <span
                  className={cn(
                    "min-w-0",
                    step.tone === "error" && "text-sev-high",
                    step.tone === "success" && "text-foreground",
                    step.tone === "normal" && "text-muted-foreground",
                  )}
                >
                  <Highlighted text={step.text} />
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>

        {active ? (
          <li className="flex items-center gap-2.5 pl-[46px] font-mono text-[12px] text-muted-foreground">
            <span className="inline-block h-3 w-1.5 animate-pulse bg-primary" aria-hidden />
            {steps.length === 0 ? "Waking the cloud browser…" : "Thinking…"}
          </li>
        ) : null}
        <div ref={endRef} />
      </ol>

      {error ? (
        <p className="border-t border-border px-5 py-3 font-mono text-[11px] text-sev-high">
          {error}
        </p>
      ) : null}
    </motion.div>
  );
}
