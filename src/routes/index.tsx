import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Banknote,
  Gauge as GaugeIcon,
  Linkedin,
  MousePointerClick,
  Type as TypeIcon,
} from "lucide-react";

import { BrandLockup } from "@/components/BrandMark";
import { Gauge } from "@/components/audit/Gauge";
import { allFrictionPoints, categoryLabel } from "@/lib/audit-schema";

import type { ForensicAuditReport, FrictionPoint } from "@/lib/audit-schema";
import { fixtureReports } from "@/lib/audit-runner";
import { listFeaturedReports, type FeaturedSummary } from "@/lib/featured.functions";
import { scoreReport } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CoherentX — Find the revenue your checkout leaks" },
      {
        name: "description",
        content:
          "An agent shops your store like a customer — category to guest checkout — and reports the copy, cost surprises, effort and speed problems costing you orders, pinned to the exact pixels.",
      },
      {
        property: "og:title",
        content: "CoherentX — Find the revenue your checkout leaks",
      },
      {
        property: "og:description",
        content:
          "An agent shops your store like a customer and shows you exactly where buyers give up — pinned to the pixels.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.coherentx.com/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.coherentx.com/" }],
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

/**
 * The hero visual: a browser window being driven by the agent. A scan sweep
 * runs down a real captured page while the agent narrates what it is checking,
 * then the findings it collected stack up. Loops.
 */
const SCAN_PHASES = [
  { label: "opening the store in a real browser", tag: "navigate" },
  { label: "reading headlines, buttons and promises", tag: "copy" },
  { label: "measuring paint, shift and page weight", tag: "speed" },
  { label: "walking category → product → cart", tag: "journey" },
  { label: "checking contrast, labels and tap targets", tag: "a11y" },
  { label: "reaching guest checkout", tag: "checkout" },
];

function AgentScan({
  report,
  stage,
  pins,
}: {
  report: ForensicAuditReport;
  stage: ForensicAuditReport["stages"][number];
  pins: FrictionPoint[];
}) {
  const [phase, setPhase] = useState(0);
  const done = phase >= SCAN_PHASES.length;
  const foundCount = done ? pins.length : Math.min(pins.length, Math.max(0, phase - 1));

  useEffect(() => {
    const t = setTimeout(
      () => setPhase((p) => (p > SCAN_PHASES.length ? 0 : p + 1)),
      phase === 0 ? 900 : done ? 3400 : 1500,
    );
    return () => clearTimeout(t);
  }, [phase, done]);

  return (
    <div className="tile relative overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="size-2 rounded-full bg-sev-high/70" />
        <span className="size-2 rounded-full bg-sev-medium/70" />
        <span className="size-2 rounded-full bg-primary/60" />
        <span className="ml-2 truncate font-mono text-[11px] text-muted-foreground">
          {report.domain}
        </span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <motion.span
            animate={{ opacity: done ? 1 : [1, 0.25, 1] }}
            transition={{ duration: 1.2, repeat: done ? 0 : Infinity }}
            className={cn("size-1.5 rounded-full", done ? "bg-primary" : "bg-sev-medium")}
          />
          {done ? "run complete" : "agent running"}
        </span>
      </div>

      <div className="relative h-[380px] overflow-hidden bg-secondary sm:h-[440px]">
        <motion.img
          src={stage.screenshot.src}
          alt={`The agent scanning the ${report.domain} storefront`}
          className="block w-full opacity-90"
          loading="eager"
          decoding="async"
          animate={{ y: done ? -160 : [0, -80, -160] }}
          transition={{ duration: done ? 0.8 : SCAN_PHASES.length * 1.5, ease: "linear" }}
        />

        {!done ? (
          <>
            <motion.div
              className="pointer-events-none absolute inset-x-0 h-28"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--primary) 18%, transparent))",
              }}
              animate={{ top: ["-10%", "88%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="pointer-events-none absolute inset-x-0 h-px bg-primary"
              animate={{ top: ["4%", "96%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        ) : null}

        {pins.slice(0, foundCount).map((point, i) => (
          <motion.span
            key={point.id}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            style={{
              left: `${Math.min(90, Math.max(6, point.x_percentage))}%`,
              top: `${18 + i * 13}%`,
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          >
            <span
              className={cn(
                "absolute -inset-2 animate-ping rounded-full opacity-30",
                point.severity === "high" ? "bg-sev-high" : "bg-sev-medium",
              )}
            />
            <span
              className={cn(
                "relative block size-4 rounded-full border-2 border-background",
                point.severity === "high" ? "bg-sev-high" : "bg-sev-medium",
              )}
            />
          </motion.span>
        ))}

        <div className="absolute inset-x-3 bottom-3">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-lg border border-border bg-background/95 p-3.5 shadow-tile-hover backdrop-blur"
              >
                <p className="label-caps">{pins.length} friction points found</p>
                <ul className="mt-2.5 space-y-1.5">
                  {pins.map((p, i) => (
                    <motion.li
                      key={p.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.12 * i }}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          p.severity === "high"
                            ? "bg-sev-high"
                            : p.severity === "medium"
                              ? "bg-sev-medium"
                              : "bg-sev-low",
                        )}
                      />
                      <span className="truncate">{p.title}</span>
                      <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                        {categoryLabel[p.category]}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ) : (
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="rounded-lg border border-border bg-background/95 p-3 shadow-tile-hover backdrop-blur"
              >
                <p className="flex items-center gap-2 font-mono text-[11px] text-foreground">
                  <span className="rounded-full border border-border px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                    {SCAN_PHASES[Math.min(phase, SCAN_PHASES.length - 1)]!.tag}
                  </span>
                  {SCAN_PHASES[Math.min(phase, SCAN_PHASES.length - 1)]!.label}
                  <span className="ml-auto text-muted-foreground">{foundCount} found</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-2 flex gap-1.5">
            {SCAN_PHASES.map((p, i) => (
              <span
                key={p.tag}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  done || i <= phase ? "bg-primary/80" : "bg-foreground/20",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5">
        <span className="label-caps">checked</span>
        {(["clarity", "trust", "form", "accessibility"] as const).map((key) => (
          <span key={key} className="font-mono text-[10px] text-muted-foreground">
            {categoryLabel[key]}
          </span>
        ))}
        <span className="font-mono text-[10px] text-foreground">
          Speed
          <span className="ml-1 text-primary">
            {(stage.technical_metrics.largest_contentful_paint_ms / 1000).toFixed(1)}s
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * The pinned-evidence showcase: findings listed on the left, the capture with
 * pins panning on the right.
 */
function EvidenceShowcase({
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
  const [windowH, setWindowH] = useState(440);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (paused || pins.length < 2) return;
    const t = setInterval(() => setActive((i) => (i + 1) % pins.length), 4200);
    return () => clearInterval(t);
  }, [paused, pins.length]);

  useEffect(() => {
    const measure = () => {
      setImgH(imgRef.current?.clientHeight ?? 0);
      setWindowH(window.innerWidth < 640 ? 380 : 440);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const current = pins[active];
  const offset =
    imgH > windowH && current
      ? Math.max(
          -(imgH - windowH),
          Math.min(0, -((current.y_percentage / 100) * imgH - windowH / 2)),
        )
      : 0;

  return (
    <section className="border-b border-border bg-card" aria-label="What the report looks like">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <p className="label-caps">What you actually see</p>
        <h2 className="mt-4 max-w-xl font-display text-2xl tracking-tight sm:text-[1.75rem]">
          Every finding pinned to the pixel that caused it.
        </h2>

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <ul className="flex min-w-0 flex-col gap-2.5">
            {pins.map((point, i) => (
              <li key={point.id}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "w-full rounded-lg border p-4 text-left transition-colors",
                    i === active
                      ? "border-foreground/25 bg-background shadow-tile"
                      : "border-border hover:bg-background/60",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-semibold text-background",
                        point.severity === "high"
                          ? "bg-sev-high"
                          : point.severity === "medium"
                            ? "bg-sev-medium"
                            : "bg-sev-low",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="label-caps">{point.severity} friction</span>
                    <span className="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                      {categoryLabel[point.category]}
                    </span>
                  </span>
                  <span className="mt-2 block text-sm font-medium leading-snug">{point.title}</span>
                  {i === active ? (
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {point.evidence}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>

          <div
            className="tile relative min-w-0 overflow-hidden p-0"
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
                pinned evidence
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
                  loading="lazy"
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
                          layoutId="showcase-pin-halo"
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
                        animate={{ opacity: isActive ? 1 : 0.5, scale: isActive ? 1.1 : 1 }}
                        transition={{ duration: 0.3 }}
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
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5">
              <span className="label-caps">checked</span>
              {(["clarity", "trust", "form", "accessibility"] as const).map((key) => {
                const hits = pins.filter((p) => p.category === key).length;
                return (
                  <span
                    key={key}
                    className={cn(
                      "font-mono text-[10px]",
                      hits ? "text-foreground" : "text-muted-foreground/60",
                    )}
                  >
                    {categoryLabel[key]}
                    <span
                      className={cn("ml-1", hits ? "text-primary" : "text-muted-foreground/50")}
                    >
                      {hits}
                    </span>
                  </span>
                );
              })}
              <span className="font-mono text-[10px] text-foreground">
                Speed
                <span className="ml-1 text-primary">
                  {(stage.technical_metrics.largest_contentful_paint_ms / 1000).toFixed(1)}s
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Marketing() {
  const { featured } = Route.useLoaderData();
  const complete = fixtureReports.filter((r) => r.status === "complete");
  const hero = complete[0] ?? fixtureReports[0]!;
  const heroStage = hero.stages[0]!;
  const heroPins = [...heroStage.friction_points]
    .sort((a, b) => a.y_percentage - b.y_percentage)
    .slice(0, 5);




  return (
    <main className="min-h-screen">
      <nav className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <BrandLockup />
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
              Full-funnel conversion forensics for online stores
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="mt-4 max-w-lg font-display text-[2.1rem] leading-[1.04] tracking-tight sm:text-[2.75rem]"
            >
              Your funnel is leaking revenue. We show you where.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground"
            >
              An agent shops your store like a customer — homepage, category, product, cart, all the
              way to guest checkout — and hands back every hesitation it hit, top of funnel to
              checkout, pinned to the exact pixels that caused it.
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
                href="mailto:hello@coherentx.com?subject=Audit%20my%20store"
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
          href="mailto:hello@coherentx.com?subject=Audit%20my%20store"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-tile transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover"
        >
          Request an audit
          <ArrowRight className="size-3.5" aria-hidden />
        </a>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-3">
            <p className="font-mono text-[11px] text-muted-foreground">
              Built by{" "}
              <a
                href="https://www.linkedin.com/in/imranrazaq/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Imran Razaq
              </a>
            </p>
            <a
              href="https://www.linkedin.com/in/imranrazaq/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Imran Razaq on LinkedIn"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <Linkedin className="size-4" aria-hidden />
            </a>
          </div>
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
const METRICS = [
  {
    key: "lcp" as const,
    tab: "Load",
    label: "largest paint",
    min: 500,
    max: 6000,
    step: 100,
    start: 3200,
    format: (v: number) => `${(v / 1000).toFixed(1)}s`,
    blurb: "How long before the main thing a shopper came for is actually on screen.",
  },
  {
    key: "cls" as const,
    tab: "Stability",
    label: "layout shift",
    min: 0,
    max: 0.5,
    step: 0.01,
    start: 0.18,
    format: (v: number) => v.toFixed(2),
    blurb: "How much the page jumps around while it settles — the cause of mis-taps on mobile.",
  },
  {
    key: "transferred" as const,
    tab: "Weight",
    label: "page weight",
    min: 200_000,
    max: 8_000_000,
    step: 100_000,
    start: 3_400_000,
    format: (v: number) => `${(v / 1_000_000).toFixed(1)}MB`,
    blurb: "How much a phone on a weak connection has to download before it can buy.",
  },
];

function ValueProp() {
  const [sev, setSev] = useState<"high" | "medium" | "low">("high");
  const [metricKey, setMetricKey] = useState<(typeof METRICS)[number]["key"]>("lcp");
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(METRICS.map((m) => [m.key, m.start])),
  );
  const metric = METRICS.find((m) => m.key === metricKey)!;
  const value = values[metric.key]!;
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

          {/* Measured metrics: pick one, drag it, watch the threshold verdict move. */}
          <div className="mt-4 flex gap-2">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetricKey(m.key)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors",
                  metricKey === m.key
                    ? "border-foreground/25 bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/60",
                )}
              >
                {m.tab}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                {metric.label}
              </p>
              <p className="font-display text-xl tabular-nums">{metric.format(value)}</p>
            </div>
            <Gauge metric={metric.key} value={value} />
            <input
              type="range"
              min={metric.min}
              max={metric.max}
              step={metric.step}
              value={value}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [metric.key]: Number(e.target.value) }))
              }
              aria-label={`Try a ${metric.label} value to see how it is graded`}
              className="mt-4 w-full accent-primary"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{metric.blurb}</p>
          </div>

          {/* Severity: how the human findings are ranked, separate from the numbers. */}
          <div className="mt-7 border-t border-border pt-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              and every finding gets a priority
            </p>
            <div className="mt-3 flex gap-2">
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
                className="mt-4"
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
