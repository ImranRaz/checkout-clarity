import {
  BENCHMARKS,
  position,
  rate,
  ratingLabel,
  type BenchmarkKey,
  type Rating,
} from "@/lib/benchmarks";
import { cn } from "@/lib/utils";

const tone: Record<Rating, string> = {
  good: "text-primary",
  fair: "text-sev-medium",
  poor: "text-sev-high",
};

const dot: Record<Rating, string> = {
  good: "bg-primary",
  fair: "bg-sev-medium",
  poor: "bg-sev-high",
};

/**
 * A number on its own teaches nothing. This puts the measurement on a track
 * whose zones are coloured by the published thresholds, so "2.7s" reads as
 * amber-in-the-middle before anyone hovers anything.
 */
export function Gauge({ metric, value }: { metric: BenchmarkKey; value: number }) {
  const b = BENCHMARKS[metric];
  const r = rate(metric, value);
  const left = position(metric, value) * 100;
  // Zone widths along the track, expressed as percentages of the max.
  const goodStop = b.higherIsBetter ? 100 - (b.good / b.max) * 100 : (b.good / b.max) * 100;
  const fairStop = b.higherIsBetter ? 100 - (b.fair / b.max) * 100 : (b.fair / b.max) * 100;

  return (
    <div className="mt-1.5">
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="absolute inset-y-0 left-0 bg-primary/45"
          style={{ width: `${Math.max(2, Math.min(goodStop, 100))}%` }}
        />
        <div
          className="absolute inset-y-0 bg-sev-medium/45"
          style={{
            left: `${Math.min(goodStop, 100)}%`,
            width: `${Math.max(0, Math.min(fairStop, 100) - Math.min(goodStop, 100))}%`,
          }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-sev-high/40"
          style={{ width: `${Math.max(0, 100 - Math.min(fairStop, 100))}%` }}
        />
      </div>
      <div className="relative h-0">
        <span
          aria-hidden
          className={cn("absolute -top-[7px] size-2 rounded-full ring-2 ring-card", dot[r])}
          style={{ left: `calc(${left}% - 4px)` }}
        />
      </div>
      <p className="mt-2 font-mono text-[10px] leading-tight">
        <span className={cn("uppercase tracking-[0.1em]", tone[r])}>{ratingLabel[r]}</span>
        <span className="ml-1.5 text-muted-foreground">{b.scale}</span>
      </p>
    </div>
  );
}
