import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
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
import { listFeaturedReports, type FeaturedSummary } from "@/lib/featured.functions";
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
  loader: async () => ({ featured: await listFeaturedReports() }),
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

function HeroEvidence({
  report,
  stage,
  pins,
}: {
  report: ForensicAuditReport;
  stage: ForensicAuditReport["stages"][number];
  pins: FrictionPoint[];
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [imgH, setImgH] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (paused || pins.length < 2) return;
    const t = setInterval(() => setActive((i) => (i + 1) % pins.length), 3800);
    return () => clearInterval(t);
  }, [paused, pins.length]);

  useEffect(() => {
    const measure = () => setImgH(imgRef.current?.clientHeight ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const current = pins[active];
  const windowH = typeof window !== "undefined" && window.innerWidth < 640 ? 380 : 440;
  const offset =
    imgH > windowH && current
      ? Math.max(
          -(imgH - windowH),
          Math.min(0, -((current.y_percentage / 100) * imgH - windowH / 2)),
        )
      : 0;


  return (
    <div
      className="tile relative overflow-hidden p-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="size-2 rounded-full bg-sev-high/70" />
        <span className="size-2 rounded-full bg-sev-medium/70" />
        <span className="size-2 rounded-full bg-primary/60" />
        <span className="ml-2 truncate font-mono text-[11px] text-muted-foreground">
          {report.domain}
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          live capture
        </span>
      </div>

      <div className="relative h-[380px] overflow-hidden sm:h-[440px]">
        <motion.div
          className="absolute inset-x-0 top-0"
          animate={{ y: offset }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
        >
          <img
            ref={imgRef}
            src={stage.screenshot.src}
            alt={`Audited capture of the ${report.domain} storefront with numbered findings`}
            className="block w-full"
            loading="eager"
            decoding="async"
            onLoad={(e) => setImgH(e.currentTarget.clientHeight)}
          />

          {pins.map((point, i) => {
            const isActive = i === active;
            return (
              <button
                key={point.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={point.title}
                style={{
                  left: `${Math.min(94, Math.max(4, point.x_percentage))}%`,
                  top: `${point.y_percentage}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                {isActive ? (
                  <motion.span
                    layoutId="hero-pin-halo"
                    className={cn(
                      "absolute -inset-2 rounded-full opacity-35",
                      point.severity === "high"
                        ? "bg-sev-high"
                        : point.severity === "medium"
                          ? "bg-sev-medium"
                          : "bg-sev-low",
                    )}
                  />
                ) : null}
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: isActive ? 1 : 0.5, scale: isActive ? 1.1 : 1 }}
                  transition={{ duration: 0.3, delay: 0.4 + i * 0.15 }}
                  className={cn(
                    "relative flex size-5 items-center justify-center rounded-full font-mono text-[10px] font-semibold text-background shadow-tile",
                    point.severity === "high"
                      ? "bg-sev-high"
                      : point.severity === "medium"
                        ? "bg-sev-medium"
                        : "bg-sev-low",
                  )}
                >
                  {i + 1}
                </motion.span>
              </button>
            );
          })}
        </motion.div>

        {/* Cycling finding card */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3">
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28 }}
                className="rounded-lg border border-border bg-background/95 p-3.5 shadow-tile-hover backdrop-blur"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full font-mono text-[9px] font-semibold text-background",
                      current.severity === "high"
                        ? "bg-sev-high"
                        : current.severity === "medium"
                          ? "bg-sev-medium"
                          : "bg-sev-low",
                    )}
                  >
                    {active + 1}
                  </span>
                  <span className="label-caps">{current.severity} friction</span>
                </div>
                <p className="mt-2 text-sm font-medium leading-snug">{current.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {current.evidence}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-2 flex gap-1.5">
            {pins.map((p, i) => (
              <span
                key={p.id}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  i === active ? "bg-foreground/70" : "bg-foreground/20",
                )}
              />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

function Marketing() {
  const { featured } = Route.useLoaderData();
  const complete = fixtureReports.filter((r) => r.status === "complete");
  const hero = complete[0] ?? fixtureReports[0]!;
  const heroStage = hero.stages[0]!;
  const heroPins = heroStage.friction_points.slice(0, 3);




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
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pb-14 pt-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:pb-16 lg:pt-14">
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
              className="mt-4 max-w-lg font-display text-[2.1rem] leading-[1.04] tracking-tight sm:text-[2.75rem]"
            >
              Your checkout is leaking revenue. We show you where.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground"
            >
              An agent shops your store like a customer — category to guest checkout — and hands
              back every hesitation it hit, pinned to the exact pixels that caused it.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <Link
                to="/report/$reportId"
                params={{ reportId: featured[0]?.id ?? hero.id }}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-tile transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover"
              >
                See a full sample report
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
              <a
                href="mailto:hello@checkoutforensic.com?subject=Audit%20my%20store"
                className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
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
          >
            <HeroEvidence report={hero} stage={heroStage} pins={heroPins} />
          </motion.div>
        </div>

      </section>

      {/* Value prop + interactive rubric */}
      <ValueProp />


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
          {featured.length > 0
            ? featured.map((run) => (
                <li key={run.id}>
                  <RealSampleCard run={run} />
                </li>
              ))
            : complete.map((report) => (
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

const VALUE_PROPS = [
  {
    k: "01",
    t: "Find the money you're already losing",
    b: "Every hesitation between landing and paying — surfaced, ranked, and tied to the revenue step it blocks.",
  },
  {
    k: "02",
    t: "Get proof, not opinions",
    b: "Each finding is anchored to the exact element in the exact capture, so nobody argues about whether it's real.",
  },
  {
    k: "03",
    t: "Know what to fix on Monday",
    b: "A fixed rubric ranks everything high to low, so your team ships the three changes that move orders first.",
  },
];

const SEVERITIES = [
  {
    key: "high" as const,
    label: "High",
    dot: "bg-sev-high",
    text: "text-sev-high",
    headline: "Blocks the purchase",
    body: "A dead add-to-cart, a forced account, a cost that appears after the card form. People leave here.",
  },
  {
    key: "medium" as const,
    label: "Medium",
    dot: "bg-sev-medium",
    text: "text-sev-medium",
    headline: "Adds doubt or effort",
    body: "Vague buttons, missing sizing help, delivery promises buried below three scrolls. Fixable in a sprint.",
  },
  {
    key: "low" as const,
    label: "Low",
    dot: "bg-sev-low",
    text: "text-sev-low",
    headline: "Polish worth doing",
    body: "Small clarity and layout wins that compound once the bigger blockers are gone.",
  },
];

/**
 * Replaces the old raw-count strip. Counts from our own fixtures meant nothing
 * to a visitor; this says what they get, then lets them feel the grading
 * system by dragging a real metric through the same thresholds the report uses.
 */
function ValueProp() {
  const [sev, setSev] = useState<"high" | "medium" | "low">("high");
  const [lcp, setLcp] = useState(3200);
  const active = SEVERITIES.find((s) => s.key === sev)!;
  const example = fixtureReports
    .flatMap((r) => allFrictionPoints(r))
    .find((p) => p.severity === sev);

  return (
    <section className="border-b border-border bg-card" aria-label="What you get">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div>
          <p className="label-caps">What you actually get</p>
          <h2 className="mt-4 max-w-md font-display text-2xl tracking-tight sm:text-[1.75rem]">
            A shopper's-eye teardown of your funnel, with the receipts.
          </h2>
          <ul className="mt-8 space-y-6">
            {VALUE_PROPS.map((v) => (
              <li key={v.k} className="flex gap-4">
                <span className="mt-0.5 font-mono text-xs text-primary">{v.k}</span>
                <span>
                  <span className="block font-display text-base tracking-tight">{v.t}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    {v.b}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="tile p-6">
          <p className="label-caps">How we grade it — try it</p>

          <div className="mt-4 flex gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSev(s.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors",
                  sev === s.key
                    ? "border-foreground/25 bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/60",
                )}
              >
                <span className={cn("size-2 rounded-full", s.dot)} aria-hidden />
                {s.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={sev}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              className="mt-5"
            >
              <p className={cn("font-display text-lg tracking-tight", active.text)}>
                {active.headline}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{active.body}</p>
              {example ? (
                <p className="mt-4 border-l-2 border-border pl-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  from a real run — “{example.title}”
                </p>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <div className="mt-7 border-t border-border pt-5">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                largest paint
              </p>
              <p className="font-display text-xl tabular-nums">{(lcp / 1000).toFixed(1)}s</p>
            </div>
            <Gauge metric="lcp" value={lcp} />
            <input
              type="range"
              min={500}
              max={6000}
              step={100}
              value={lcp}
              onChange={(e) => setLcp(Number(e.target.value))}
              aria-label="Try a page load time to see how it is graded"
              className="mt-4 w-full accent-primary"
            />
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              drag it — every number in your report is scored against thresholds like these, never a
              model's opinion.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


/** A published audit of a real, named store — the strongest proof we have. */
function RealSampleCard({ run }: { run: FeaturedSummary }) {
  return (
    <Link
      to="/report/$reportId"
      params={{ reportId: run.id }}
      className="tile group flex h-full flex-col overflow-hidden p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover"
    >
      <span className="relative block h-36 overflow-hidden border-b border-border bg-secondary">
        <img
          src={`/api/public/thumb/${run.id}`}
          alt={`Capture from the ${run.domain} audit`}
          loading="lazy"
          decoding="async"
          className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </span>
      <span className="flex flex-1 flex-col p-5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-mono text-xs text-muted-foreground">{run.domain}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {run.stages} stages
          </span>
        </span>
        <span className="mt-4 flex items-baseline gap-1.5">
          <span className="font-display text-4xl leading-none tabular-nums">{run.score ?? "—"}</span>
          {run.score !== null ? (
            <span className="font-mono text-xs text-muted-foreground">/100</span>
          ) : null}
        </span>
        <span className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          {run.findings} findings
          <ArrowRight
            className="size-3 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </span>
    </Link>
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
