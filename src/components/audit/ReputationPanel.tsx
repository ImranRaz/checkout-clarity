import { ExternalLink, MessageSquareQuote, Star, ThumbsUp, TrendingUp } from "lucide-react";
import { motion } from "motion/react";

import {
  categoryLabel,
  severityLabel,
  type ReputationReport,
  type ReputationTheme,
} from "@/lib/audit-schema";
import { cn } from "@/lib/utils";

/**
 * What customers say, next to what the browser agent saw. The value is in the
 * overlap: a complaint theme that lines up with an on-site finding is no longer
 * an opinion, it's a confirmed leak.
 */

const severityTone: Record<ReputationTheme["severity"], string> = {
  high: "border-sev-high/40 text-sev-high",
  medium: "border-sev-medium/40 text-sev-medium",
  low: "border-border text-muted-foreground",
};

const trendLabel: Record<ReputationTheme["trend"], string> = {
  rising: "Rising",
  steady: "Steady",
  fading: "Fading",
};

function scoreTone(score: number): string {
  if (score >= 75) return "text-primary";
  if (score >= 50) return "text-sev-medium";
  return "text-sev-high";
}

export function ReputationPanel({
  reputation,
  onSelectFinding,
}: {
  reputation: ReputationReport;
  onSelectFinding?: ((findingId: number) => void) | undefined;
}) {
  const complaints = reputation.themes.filter((t) => t.kind === "complaint");
  const praise = reputation.themes.filter((t) => t.kind === "praise");

  return (
    <div className="space-y-6">
      <div className="tile grid gap-4 p-5 sm:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-5">
          <div>
            <p className="label-caps">Reputation</p>
            <p className={cn("font-display text-4xl tabular-nums", scoreTone(reputation.score))}>
              {reputation.score}
              <span className="text-lg text-muted-foreground">/100</span>
            </p>
          </div>
          <div className="space-y-1 border-l border-border pl-5 text-sm">
            <p className="flex items-center gap-1.5 tabular-nums">
              <Star className="size-3.5 text-sev-medium" aria-hidden />
              {reputation.average_rating ? `${reputation.average_rating.toFixed(1)} avg` : "No rating"}
            </p>
            <p className="text-muted-foreground tabular-nums">
              {reputation.review_count} reviews read
            </p>
          </div>
        </div>
        <p className="min-w-0 self-center text-sm leading-relaxed text-muted-foreground">
          {reputation.summary}
          {reputation.note ? <span className="block mt-2 text-sev-medium">{reputation.note}</span> : null}
        </p>
      </div>

      {reputation.sources.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caps">Sources</span>
          {reputation.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {source.name}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          ))}
        </div>
      ) : null}

      {complaints.length > 0 ? (
        <section className="space-y-3">
          <h3 className="label-caps">What customers complain about</h3>
          {complaints.map((theme, index) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              index={index}
              onSelectFinding={onSelectFinding}
            />
          ))}
        </section>
      ) : null}

      {praise.length > 0 ? (
        <section className="space-y-3">
          <h3 className="label-caps flex items-center gap-1.5">
            <ThumbsUp className="size-3.5" aria-hidden />
            What they love. Protect this.
          </h3>
          {praise.map((theme, index) => (
            <ThemeCard key={theme.id} theme={theme} index={index} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ThemeCard({
  theme,
  index,
  onSelectFinding,
}: {
  theme: ReputationTheme;
  index: number;
  onSelectFinding?: ((findingId: number) => void) | undefined;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.2) }}
      className="tile min-w-0 space-y-3 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="min-w-0 flex-1 text-sm font-medium text-foreground">{theme.title}</h4>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
            severityTone[theme.severity],
          )}
        >
          {severityLabel[theme.severity]}
        </span>
        <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="size-3" aria-hidden />
          {trendLabel[theme.trend]} · {theme.mention_count} mentions
        </span>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{theme.summary}</p>

      {theme.quotes.length > 0 ? (
        <ul className="space-y-2">
          {theme.quotes.map((quote, i) => (
            <li
              key={i}
              className="min-w-0 border-l-2 border-border pl-3 text-[13px] italic leading-relaxed text-foreground/80"
            >
              <MessageSquareQuote className="mr-1 inline size-3 text-muted-foreground" aria-hidden />
              “{quote.text}”
              <span className="ml-1.5 not-italic font-mono text-[11px] text-muted-foreground">
                {quote.url ? (
                  <a
                    href={quote.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline-offset-4 hover:underline"
                  >
                    {quote.source}
                  </a>
                ) : (
                  quote.source
                )}
                {quote.rating ? ` · ${quote.rating}★` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {theme.category ? (
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {categoryLabel[theme.category]}
          </span>
        ) : null}
        {theme.corroborates.map((id) =>
          onSelectFinding ? (
            <button
              key={id}
              type="button"
              onClick={() => onSelectFinding(id)}
              className="rounded-full border border-primary/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
            >
              Seen on site, finding {id} →
            </button>
          ) : (
            <span
              key={id}
              className="rounded-full border border-primary/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary"
            >
              Seen on site, finding {id}
            </span>
          ),
        )}
      </div>
    </motion.article>
  );
}
