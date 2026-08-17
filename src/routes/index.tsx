import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowRight,
  Banknote,
  Gauge as GaugeIcon,
  MousePointerClick,
  ScanSearch,
  Type as TypeIcon,
} from "lucide-react";

import { allFrictionPoints, totalConsoleErrors } from "@/lib/audit-schema";
import type { ForensicAuditReport, FrictionPoint } from "@/lib/audit-schema";
import { fixtureReports } from "@/lib/audit-runner";
import { scoreReport } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Checkout Forensic — Find the revenue your checkout leaks" },
      {
        name: "description",
        content:
          "An agent shops your store like a customer — category to guest checkout — and reports the copy, cost surprises, effort and speed problems costing you orders, pinned to the exact pixels.",
      },
      {
        property: "og:title",
        content: "Checkout Forensic — Find the revenue your checkout leaks",
      },
      {
        property: "og:description",
        content:
          "An agent shops your store like a customer and shows you exactly where buyers give up — pinned to the pixels.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://checkout-specter.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://checkout-specter.lovable.app/" }],
  }),
  component: Marketing,
});

const PILLAR_CARDS = [
  {
    icon: TypeIcon,
    title: "Copy & clarity",
    body: "Vague buttons, missing sizing help, delivery promises buried three scrolls down. We read the page the way a first-time buyer does.",
    pillar: "clarity" as const,
  },
  {
    icon: Banknote,
    title: "Cost & surprise",
    body: "Shipping revealed at the last step, pre-ticked add-ons, taxes that appear after the card form. The classic late-cost abandon.",
    pillar: "trust" as const,
  },
  {
    icon: MousePointerClick,
    title: "Effort",
    body: "Variant traps, dead add-to-cart states, forced accounts, forms that ask for more than an order needs.",
    pillar: "effort" as const,
  },
  {
    icon: GaugeIcon,
    title: "Speed & stability",
    body: "Largest paint, layout shift, console errors on the pages that actually take money — not on your homepage.",
    pillar: "speed" as const,
  },
];

function exampleFinding(pillar: string): FrictionPoint | null {
  for (const report of fixtureReports) {
    const hit = allFrictionPoints(report).find(
      (p) => (p as { pillar?: string }).pillar === pillar && p.severity !== "low",
    );
    if (hit) return hit;
  }
  return null;
}

function Marketing() {
  const complete = fixtureReports.filter((r) => r.status === "complete");
  const hero = complete[0] ?? fixtureReports[0]!;
  const heroStage = hero.stages[0]!;
  const heroPins = heroStage.friction_points.slice(0, 3);

  const stages = fixtureReports.reduce((n, r) => n + r.stages.length, 0);
  const findings = fixtureReports.reduce((n, r) => n + allFrictionPoints(r).length, 0);
  const errors = fixtureReports.reduce((n, r) => n + totalConsoleErrors(r), 0);

  return (
    <main className="min-h-screen">
      <nav className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <span className="label-caps flex items-center gap-2">
            <ScanSearch className="size-3.5" aria-hidden />
            Checkout Forensic
          </span>
          <div className="flex items-center gap-4">
            <a
              href="#samples"
              className="hidden font-mono text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              sample reports
            </a>
            <Link
              to="/auth"
              className="rounded-md border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="rule-grid border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-28 lg:pt-24">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="label-caps"
            >
              Conversion forensics for online stores
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="mt-5 max-w-xl font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl"
            >
              Your checkout is leaking revenue. We show you where.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground"
            >
              An agent shops your store the way a customer does — category, product, cart, guest
              checkout — then hands back every hesitation it hit, pinned to the exact pixels that
              caused it.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                to="/report/$reportId"
                params={{ reportId: hero.id }}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-tile transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover"
              >
                See a full sample report
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
              <a
                href="mailto:hello@checkoutforensic.com?subject=Audit%20my%20store"
                className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                Request an audit
              </a>
            </motion.div>

            <p className="mt-5 font-mono text-[11px] text-muted-foreground">
              No tag to install. No code. No access to your site.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="tile relative overflow-hidden p-0"
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="size-2 rounded-full bg-sev-high/70" />
              <span className="size-2 rounded-full bg-sev-medium/70" />
              <span className="size-2 rounded-full bg-primary/60" />
              <span className="ml-2 truncate font-mono text-[11px] text-muted-foreground">
                {hero.domain}
              </span>
            </div>
            <div className="relative">
              <img
                src={heroStage.screenshot.src}
                alt={`Audited capture of the ${hero.domain} storefront with numbered findings`}
                className="block w-full"
                loading="eager"
                decoding="async"
              />
              {heroPins.map((point, i) => (
                <motion.span
                  key={point.id}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, delay: 0.5 + i * 0.18 }}
                  style={{
                    left: `${Math.min(92, Math.max(4, point.x_percentage))}%`,
                    top: `${Math.min(92, Math.max(4, point.y_percentage))}%`,
                  }}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold text-background shadow-tile",
                    point.severity === "high"
                      ? "bg-sev-high"
                      : point.severity === "medium"
                        ? "bg-sev-medium"
                        : "bg-sev-low",
                  )}
                >
                  {i + 1}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Proof strip */}
      <section className="border-b border-border" aria-label="What the agent has found so far">
        <div className="mx-auto grid w-full max-w-6xl gap-px bg-border px-6 py-0 sm:grid-cols-3">
          <Stat value={stages} label="journey stages walked" />
          <Stat value={findings} label="conversion findings surfaced" />
          <Stat value={errors} label="console errors caught mid-purchase" />
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
          Four reasons carts die. We check all four, on every page.
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Every finding is measured on the page, then judged against what your business actually
          sells — a cruise line isn't graded on free shipping.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {PILLAR_CARDS.map((card) => {
            const example = exampleFinding(card.pillar);
            const Icon = card.icon;
            return (
              <div key={card.title} className="tile flex flex-col p-6">
                <Icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-4 font-display text-lg tracking-tight">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
                {example ? (
                  <p className="mt-5 border-l-2 border-border pl-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    seen in a real run — “{example.title}”
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
            One URL in. A prioritised teardown out.
          </h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                n: "01",
                t: "Point us at any page",
                b: "A product link, a category, your homepage. Anything on the store works.",
              },
              {
                n: "02",
                t: "The agent shops it",
                b: "It picks a variant, adds to cart, and pushes into guest checkout — stopping at any login wall, like a real shopper would.",
              },
              {
                n: "03",
                t: "You get the evidence",
                b: "A scored report where every finding is anchored to the element in the screenshot, ordered by what to fix first.",
              },
            ].map((step) => (
              <li key={step.n}>
                <p className="font-mono text-xs text-primary">{step.n}</p>
                <h3 className="mt-3 font-display text-lg tracking-tight">{step.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Samples */}
      <section id="samples" className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
            Read a real report, end to end.
          </h2>
          <p className="font-mono text-[11px] text-muted-foreground">no sign-in needed</p>
        </div>

        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {fixtureReports.map((report) => (
            <li key={report.id}>
              <SampleCard report={report} />
            </li>
          ))}
        </ul>
      </section>

      {/* Difference */}
      <section className="border-y border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
              Speed tools grade a URL. We walk the purchase.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A perfect performance score on a product page tells you nothing about the size picker
              that traps people, the shipping cost that appears at step four, or the pre-ticked
              insurance box that erodes trust. Those only show up if something actually tries to
              buy.
            </p>
          </div>
          <ul className="space-y-4 self-center">
            {[
              "Findings anchored to the exact element in the exact screenshot — no guesswork.",
              "Scores from a fixed rubric, not a model's mood.",
              "Judged against your business model, so the advice fits what you sell.",
              "Nothing to install, and nothing touching your production code.",
            ].map((line) => (
              <li key={line} className="flex gap-3 text-sm text-foreground">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20 text-center">
        <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
          Want this run on your store?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Send us a link. We'll run the full journey and send back a report you can hand straight to
          your team.
        </p>
        <a
          href="mailto:hello@checkoutforensic.com?subject=Audit%20my%20store"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-tile transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover"
        >
          Request an audit
          <ArrowRight className="size-3.5" aria-hidden />
        </a>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <p className="font-mono text-[11px] text-muted-foreground">
            Scores are computed by a fixed rubric, not generated. Pins are derived from element
            bounding boxes.
          </p>
          <Link to="/auth" className="font-mono text-[11px] text-primary hover:underline">
            client sign-in →
          </Link>
        </div>
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-background px-2 py-10 text-center sm:px-6">
      <p className="font-display text-4xl leading-none tabular-nums">{value}</p>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function SampleCard({ report }: { report: ForensicAuditReport }) {
  const score = report.status === "partial" ? null : scoreReport(report).total;
  const thumb = report.stages[0]?.screenshot.src;

  return (
    <Link
      to="/report/$reportId"
      params={{ reportId: report.id }}
      className="tile group flex h-full flex-col overflow-hidden p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover"
    >
      {thumb ? (
        <span className="relative block h-36 overflow-hidden border-b border-border bg-secondary">
          <img
            src={thumb}
            alt={`Capture from the ${report.domain} audit`}
            loading="lazy"
            decoding="async"
            className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </span>
      ) : null}
      <span className="flex flex-1 flex-col p-5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-mono text-xs text-muted-foreground">{report.domain}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {report.stages.length} stages
          </span>
        </span>
        <span className="mt-4 flex items-baseline gap-1.5">
          <span className="font-display text-4xl leading-none tabular-nums">{score ?? "n/a"}</span>
          {score !== null ? (
            <span className="font-mono text-xs text-muted-foreground">/100</span>
          ) : null}
        </span>
        <span className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          {allFrictionPoints(report).length} findings
          <ArrowRight
            className="size-3 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </span>
    </Link>
  );
}
