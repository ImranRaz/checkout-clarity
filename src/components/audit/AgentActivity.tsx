import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronDown,
  Loader2,
  MousePointerClick,
  PackageSearch,
  Radar,
  ShoppingCart,
  Store,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { LiveStep } from "@/lib/audit.functions";
import { cn } from "@/lib/utils";

/**
 * A human-readable view of what the agent is doing right now. Phases light up
 * as matching lines arrive from the worker's real job log — nothing is faked,
 * but the raw log itself stays tucked away behind a toggle.
 */

type Phase = {
  key: string;
  label: string;
  running: string;
  icon: typeof Radar;
  done: RegExp;
};

const PHASES: Phase[] = [
  {
    key: "boot",
    label: "Starting a cloud browser",
    running: "Waking a real browser in the cloud…",
    icon: Zap,
    done: /opening https?:/i,
  },
  {
    key: "land",
    label: "Opening the store page",
    running: "Loading the page and recording how fast it paints…",
    icon: Store,
    done: /landed on/i,
  },
  {
    key: "read",
    label: "Reading the page",
    running: "Looking for the buy box, price and quantity controls…",
    icon: Radar,
    done: /captured in|click|select|choose/i,
  },
  {
    key: "product",
    label: "Walking to the product",
    running: "Following links toward a product it can buy…",
    icon: PackageSearch,
    done: /product|variant|size|colou?r/i,
  },
  {
    key: "cart",
    label: "Adding to cart",
    running: "Trying to put an item in the cart…",
    icon: MousePointerClick,
    done: /add to cart|add-to-cart|added/i,
  },
  {
    key: "checkout",
    label: "Inspecting the cart",
    running: "Measuring the cart page and pinning friction…",
    icon: ShoppingCart,
    done: /cart captured|cart reached|cart page/i,
  },
];

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Turns a worker log line into something a non-engineer can read. */
function humanize(step: LiveStep): string {
  const text = step.text;
  const click = /^click (?:the )?(.+?) (?:link|button)$/i.exec(text);
  if (click) return `Clicking “${click[1]}”`;
  const captured = /^(.+?) captured in (\d+)ms$/i.exec(text);
  if (captured) return `Captured the ${captured[1]!.toLowerCase()} screen`;
  const landed = /^landed on (\w[\w-]*)/i.exec(text);
  if (landed) return `Landed on the ${landed[1]} page`;
  if (/^opening https?:/i.test(text)) return "Opening the store in a cloud browser";
  return text;
}

export function AgentActivity({
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
  const [open, setOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const active = status === "starting" || status === "running";

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [steps.length, open]);

  const haystack = steps.map((s) => s.text).join(" \n ");
  const doneFlags = PHASES.map((p) => p.done.test(haystack));
  const currentIndex = status === "done" ? PHASES.length : doneFlags.findIndex((d) => !d);
  const latest = steps[steps.length - 1];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="tile mt-6 overflow-hidden"
      aria-label="Agent activity"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-3">
        <p className="label-caps flex items-center gap-2">
          <span
            className={cn(
              "inline-block size-2 rounded-full",
              active ? "animate-pulse bg-primary" : status === "error" ? "bg-sev-high" : "bg-muted-foreground/40",
            )}
            aria-hidden
          />
          {active ? "Agent is working" : status === "error" ? "Agent stopped" : "Agent finished"}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {formatElapsed(elapsedMs)}
        </p>
      </div>

      <ol className="px-5 py-4" aria-live="polite" aria-busy={active}>
        {PHASES.map((phase, index) => {
          const complete = index < currentIndex;
          const isCurrent = index === currentIndex && active;
          const Icon = phase.icon;
          return (
            <li
              key={phase.key}
              className={cn(
                "flex items-start gap-3 py-1.5 transition-opacity duration-300",
                !complete && !isCurrent && "opacity-40",
              )}
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                {complete ? (
                  <Check className="size-4 text-primary" aria-hidden />
                ) : isCurrent ? (
                  <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                ) : (
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm",
                    isCurrent ? "font-medium text-foreground" : "text-foreground",
                  )}
                >
                  {phase.label}
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  {isCurrent ? (
                    <motion.span
                      key={latest ? latest.at : "boot"}
                      initial={{ opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="block text-[13px] text-muted-foreground"
                    >
                      {latest ? humanize(latest) : phase.running}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border px-5 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn("size-3 transition-transform", open && "rotate-180")}
            aria-hidden
          />
          {open ? "Hide" : "Show"} technical log ({steps.length})
        </button>

        {open ? (
          <ol className="mt-2 max-h-48 space-y-1 overflow-y-auto pb-1">
            {steps.map((step, index) => (
              <li
                key={`${index}-${step.at}`}
                className={cn(
                  "flex gap-2.5 font-mono text-[11px] leading-relaxed",
                  step.tone === "error" ? "text-sev-high" : "text-muted-foreground",
                )}
              >
                <span className="w-9 shrink-0 tabular-nums">{formatElapsed(step.at)}</span>
                <span className="min-w-0">{step.text}</span>
              </li>
            ))}
            <div ref={endRef} />
          </ol>
        ) : null}
      </div>

      {error ? (
        <p className="border-t border-border px-5 py-3 text-[13px] text-sev-high">{error}</p>
      ) : null}
    </motion.section>
  );
}
