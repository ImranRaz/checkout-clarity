import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, ScanSearch, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import { fixtureReports, isPlausibleUrl, resolveReportForUrl } from "@/lib/audit-runner";
import { scoreReport } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Checkout Forensic — Audit any store's cart flow" },
      {
        name: "description",
        content:
          "An agent walks a real product page into the cart, measures load behaviour and console errors, then maps every conversion friction point onto the capture.",
      },
      { property: "og:title", content: "Checkout Forensic — Audit any store's cart flow" },
      {
        property: "og:description",
        content:
          "Technical friction and UX friction, measured in the same run and pinned to the same screenshot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);

  const valid = isPlausibleUrl(url);

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;
    const report = resolveReportForUrl(url);
    void navigate({ to: "/audit/$runId", params: { runId: report.id } });
  }

  return (
    <main className="min-h-screen">
      <div className="rule-grid border-b border-border">
        <div className="mx-auto w-full max-w-5xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="label-caps flex items-center gap-2"
          >
            <ScanSearch className="size-3.5" aria-hidden />
            Checkout Forensic
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-6 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl"
          >
            Bad conversion isn't just UX, and it isn't just slow APIs.
            <span className="text-muted-foreground"> It's the intersection.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Point the agent at a product page. It walks the page into the cart, records what the
            browser actually did, and pins every friction point it finds onto the capture.
          </motion.p>

          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            onSubmit={submit}
            className="mt-10"
          >
            <label htmlFor="target-url" className="label-caps">
              Product page URL
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="target-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="wayfarer-outdoor.com/p/atmos-ag-65-backpack"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  "min-w-0 flex-1 rounded-md border border-input bg-card px-4 py-3.5 font-mono text-sm text-foreground shadow-tile outline-none transition-colors",
                  "placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/25",
                  touched && !valid && url.length > 0 && "border-sev-high",
                )}
              />
              <button
                type="submit"
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground",
                  "shadow-tile transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                )}
              >
                <Sparkles className="size-4" aria-hidden />
                Run forensic audit
              </button>
            </div>
            <p
              className={cn(
                "mt-2 font-mono text-[11px]",
                touched && !valid && url.length > 0 ? "text-sev-high" : "text-muted-foreground",
              )}
            >
              {touched && !valid && url.length > 0
                ? "That doesn't parse as a URL — include the domain, e.g. store.com/p/item"
                : "Demo build — runs replay recorded audits. Live browsing arrives with a hosted browser session."}
            </p>
          </motion.form>
        </div>
      </div>

      <section className="mx-auto w-full max-w-5xl px-6 py-14" aria-label="Recent audits">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="label-caps">Recent audits</h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            {fixtureReports.length} runs on file
          </p>
        </div>

        <ul className="mt-4 flex snap-x gap-4 overflow-x-auto pb-3">
          {fixtureReports.map((report) => {
            const score = scoreReport(report);
            return (
              <li key={report.id} className="w-72 shrink-0 snap-start">
                <Link
                  to="/report/$reportId"
                  params={{ reportId: report.id }}
                  className="tile group flex h-full flex-col p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {report.domain}
                    </p>
                    <span
                      className={cn(
                        "font-mono text-[10px] uppercase tracking-[0.12em]",
                        report.status === "partial" ? "text-sev-medium" : "text-primary",
                      )}
                    >
                      {report.status}
                    </span>
                  </div>
                  {report.status === "partial" ? (
                    <>
                      <p className="mt-4 font-display text-4xl leading-none text-muted-foreground">
                        —
                      </p>
                      <p className="mt-1 text-sm text-foreground">Not scored</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-4 flex items-baseline gap-1.5">
                        <span className="font-display text-4xl leading-none tabular-nums">
                          {score.total}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">/100</span>
                      </p>
                      <p className="mt-1 text-sm text-foreground">{score.grade}</p>
                    </>
                  )}

                  <p className="mt-4 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    {report.ux_friction_points.length} friction ·{" "}
                    {report.technical_metrics.console_errors.length} console
                    <ArrowRight
                      className="size-3 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <p className="font-mono text-[11px] text-muted-foreground">
            Scores are computed by a fixed rubric, not generated. Pins are derived from element
            bounding boxes.
          </p>
        </div>
      </footer>
    </main>
  );
}
