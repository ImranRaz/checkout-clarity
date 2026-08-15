/**
 * Published-ish thresholds for every number the report shows, so a reader can
 * tell at a glance whether 2.7s is fine or embarrassing without hovering a
 * help icon. One source of truth, shared by the browser metrics grid and the
 * scroll-pass panel.
 */

export type Rating = "good" | "fair" | "poor";

export interface Benchmark {
  /** At or better than this is healthy. */
  good: number;
  /** Between good and this is "needs work"; worse is poor. */
  fair: number;
  /** Right edge of the gauge track. */
  max: number;
  /** When true a bigger number is the better one (e.g. images painted). */
  higherIsBetter?: boolean;
  /** Short human scale, e.g. "good < 2.5s · poor > 4s". */
  scale: string;
}

export const BENCHMARKS = {
  lcp: { good: 2500, fair: 4000, max: 6000, scale: "good < 2.5s · poor > 4s" },
  cls: { good: 0.1, fair: 0.25, max: 0.5, scale: "good < 0.1 · poor > 0.25" },
  tbt: { good: 200, fair: 600, max: 1500, scale: "good < 200ms · poor > 600ms" },
  domReady: { good: 1500, fair: 3000, max: 5000, scale: "good < 1.5s · poor > 3s" },
  transferred: { good: 2_000_000, fair: 5_000_000, max: 8_000_000, scale: "good < 2MB · poor > 5MB" },
  requests: { good: 80, fair: 150, max: 250, scale: "lean < 80 · bloated > 150" },
  pageLength: { good: 4, fair: 8, max: 14, scale: "tight < 4 screens · long > 8" },
  actionDepth: { good: 25, fair: 60, max: 100, scale: "good < 25% down · poor > 60%" },
  scrollShift: { good: 0.1, fair: 0.25, max: 0.5, scale: "good < 0.1 · poor > 0.25" },
  imagesLoaded: { good: 100, fair: 95, max: 100, higherIsBetter: true, scale: "all images should paint" },
  stutter: { good: 2, fair: 6, max: 14, scale: "smooth < 2 tasks · janky > 6" },
  sticky: { good: 1, fair: 2, max: 5, scale: "1 pinned bar is fine · 3+ crowds the screen" },
} satisfies Record<string, Benchmark>;

export type BenchmarkKey = keyof typeof BENCHMARKS;

export function rate(key: BenchmarkKey, value: number): Rating {
  const b = BENCHMARKS[key] as Benchmark;
  if (b.higherIsBetter) {
    if (value >= b.good) return "good";
    if (value >= b.fair) return "fair";
    return "poor";
  }
  if (value <= b.good) return "good";
  if (value <= b.fair) return "fair";
  return "poor";
}

/** 0-1 marker position along the gauge track. */
export function position(key: BenchmarkKey, value: number): number {
  const b = BENCHMARKS[key] as Benchmark;
  const raw = b.higherIsBetter ? 1 - value / b.max : value / b.max;
  return Math.min(1, Math.max(0, raw));
}

export const ratingLabel: Record<Rating, string> = {
  good: "good",
  fair: "needs work",
  poor: "poor",
};
