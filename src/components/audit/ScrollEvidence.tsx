import { ArrowDownToLine, MousePointerClick, PanelTop, X } from "lucide-react";

import { Explain } from "./Explain";
import { Gauge } from "./Gauge";
import type { GlossaryKey } from "@/lib/glossary";
import type { BenchmarkKey } from "@/lib/benchmarks";
import type { Interstitial, ScrollProfile } from "@/lib/audit-schema";

/** One measured field of the sweep: what it is, what it means, how it rates. */
function Field({
  label,
  term,
  metric,
  raw,
  children,
}: {
  label: string;
  term: GlossaryKey;
  metric: BenchmarkKey;
  raw: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
        <Explain term={term} />
      </dt>
      <dd className="mt-0.5 font-mono text-sm tabular-nums text-foreground">{children}</dd>
      <Gauge metric={metric} value={raw} />
    </div>
  );
}

/**
 * What the scroll pass found, stated as a reading experience rather than a
 * metrics dump. The numbers that deserve to be findings are already in the
 * findings rail; this panel exists so the reader can see the shape of the page
 * the agent actually walked through.
 */
export function ScrollPass({ profile }: { profile: ScrollProfile }) {
  const depth = profile.primary_cta?.depth_percentage ?? null;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="label-caps flex items-center gap-1.5">
        <ArrowDownToLine className="size-3" aria-hidden />
        Scroll pass
        <Explain term="aboveFold" />
        <Explain term="layoutShift" />
      </p>

      <div className="mt-3 flex items-start gap-4">
        {/* A page-shape gauge: total height, and where the decision sits in it. */}
        <div
          className="relative h-20 w-3 shrink-0 overflow-hidden rounded-full bg-muted"
          aria-hidden
        >
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-border" />
          {depth !== null && (
            <div
              className="absolute inset-x-0 h-1.5 rounded-full bg-primary"
              style={{ top: `calc(${Math.min(96, depth)}% - 3px)` }}
            />
          )}
        </div>

        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Page length
            </dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
              {profile.viewports.toFixed(1)} screens
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Action depth
            </dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
              {depth === null ? "none found" : `${depth}%`}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Shift while scrolling
            </dt>
            <dd
              className={`mt-0.5 font-mono text-sm tabular-nums ${
                profile.shift_after_load >= 0.1 ? "text-sev-high" : "text-foreground"
              }`}
            >
              {profile.shift_after_load.toFixed(3)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Images loaded
            </dt>
            <dd
              className={`mt-0.5 font-mono text-sm tabular-nums ${
                profile.stalled_media_count > 0 ? "text-sev-medium" : "text-foreground"
              }`}
            >
              {profile.media_count - profile.stalled_media_count}/{profile.media_count}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Stutter
            </dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
              {profile.long_tasks} task{profile.long_tasks === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Pinned furniture
            </dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
              {profile.sticky.length || "none"}
            </dd>
          </div>
        </dl>
      </div>

      {profile.primary_cta && (
        <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <MousePointerClick className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
          <span>
            The way forward is “{profile.primary_cta.text}”, {depth}% down a{" "}
            {profile.viewports.toFixed(1)}-screen page
            {profile.primary_cta.sticky ? ", and it follows you as you scroll" : ""}.
            {profile.infinite_scroll ? " The listing keeps loading, so the footer is never reached." : ""}
          </span>
        </p>
      )}

      {/* The sweep itself, screen by screen: what was actually in front of the
          shopper at each depth, rather than a flattened full-page composite. */}
      {profile.frames?.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            What the shopper saw on the way down
          </p>
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {profile.frames.map((frame, index) => (
              <li key={`${frame.scroll_y}-${index}`} className="shrink-0">
                <img
                  src={frame.src}
                  alt={`Viewport captured ${Math.round(frame.top_percentage)}% down the page`}
                  loading="lazy"
                  className="h-28 w-40 rounded-sm border border-border object-cover object-top"
                />
                <p className="mt-1 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
                  {Math.round(frame.top_percentage)}–{Math.round(frame.bottom_percentage)}%
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


/**
 * The pop-up, judged rather than silently clicked away. Whatever a site says
 * before it says anything else is part of the experience being audited.
 */
export function Interstitials({ items }: { items: Interstitial[] }) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="label-caps flex items-center gap-1.5">
        <PanelTop className="size-3" aria-hidden />
        Interrupted by {items.length} pop-up{items.length === 1 ? "" : "s"}
        <Explain term="interstitial" />
      </p>

      <ul className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={`${item.heading}-${index}`} className="flex gap-3">
            {item.image && (
              <img
                src={item.image}
                alt={item.heading ? `Pop-up: ${item.heading}` : "Pop-up shown to the shopper"}
                loading="lazy"
                className="h-16 w-24 shrink-0 rounded-sm border border-border object-cover object-top"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {item.heading || item.text.slice(0, 60) || "Untitled overlay"}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                after {(item.elapsed_ms / 1000).toFixed(1)}s · covers {item.coverage_percentage}% of the
                screen
                {item.repeat_count > 1 ? ` · shown ${item.repeat_count}×` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.accept_label && (
                  <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    {item.accept_label}
                  </span>
                )}
                {item.decline_label && (
                  <span
                    className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${
                      item.decline_is_weaker
                        ? "bg-sev-medium/15 text-sev-medium"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.decline_label}
                    {item.decline_is_weaker ? " · de-emphasised" : ""}
                  </span>
                )}
                {!item.has_close_control && (
                  <span className="flex items-center gap-1 rounded-sm bg-sev-high/15 px-1.5 py-0.5 font-mono text-[10px] text-sev-high">
                    <X className="size-2.5" aria-hidden />
                    no close control
                  </span>
                )}
                {item.asks_for_input > 0 && (
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    asks for {item.asks_for_input} field{item.asks_for_input === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
