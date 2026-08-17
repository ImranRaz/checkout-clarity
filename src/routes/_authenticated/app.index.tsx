import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { ArrowRight, Check, Loader2, ScanSearch, ShieldAlert, Sparkles, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { allFrictionPoints, totalConsoleErrors } from "@/lib/audit-schema";
import { fixtureReports, isPlausibleUrl, normalizeUrl, resolveReportForUrl } from "@/lib/audit-runner";
import { deleteAuditRun, listRecentAudits, type RecentAudit } from "@/lib/reports.functions";
import { preflightTarget } from "@/lib/browserbase.functions";
import { saveLiveReport } from "@/lib/live-store";
import type { PreflightResult } from "@/lib/preflight-types";
import { scoreReport } from "@/lib/scoring";
import { cn } from "@/lib/utils";



export const Route = createFileRoute("/_authenticated/app/")({
  loader: async () => ({ recent: await listRecentAudits() }),
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p role="alert" className="font-mono text-sm text-sev-high">
        {error.message}
      </p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="font-mono text-sm text-muted-foreground">Nothing here.</p>
    </main>
  ),
  head: () => ({
    meta: [
      { title: "Checkout Forensic — Why shoppers leave, page by page" },
      {
        name: "description",
        content:
          "Point an agent at any store page. It finds its own way to cart and guest checkout, then reports the copy, cost, effort and speed problems costing you orders — pinned to the pixels.",
      },
      { property: "og:title", content: "Checkout Forensic — Why shoppers leave, page by page" },
      {
        property: "og:description",
        content:
          "Copy, trust, effort and speed audited in one real browser run, pinned to the exact screenshot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const router = useRouter();
  const { recent } = Route.useLoaderData() as { recent: RecentAudit[] };
  const runPreflight = useServerFn(preflightTarget);
  const removeRun = useServerFn(deleteAuditRun);
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [checking, setChecking] = useState(false);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [removing, setRemoving] = useState<string[]>([]);
  const busy = checking;

  const valid = isPlausibleUrl(url);

  async function handleDelete(id: string) {
    setRemoving((ids) => [...ids, id]);
    try {
      await removeRun({ data: { id } });
      await router.invalidate();
    } finally {
      setRemoving((ids) => ids.filter((x) => x !== id));
    }
  }


  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid || busy) return;

    setChecking(true);
    setPreflight(null);
    try {
      const result = await runPreflight({ data: { url: normalizeUrl(url) } });
      setPreflight(result);
    } catch (error) {
      setPreflight({
        url: normalizeUrl(url),
        ok: false,
        statusCode: null,
        blocked: false,
        title: null,
        platform: null,
        contentChars: 0,
        elapsedMs: 0,
        signals: [],
        error: error instanceof Error ? error.message : "Preflight failed.",
      });
    } finally {
      setChecking(false);
    }
  }

  /**
   * The live run gets its own page, so the agent's activity streams in the same
   * terminal the recorded runs replay in.
   */
  function runRealAgent() {
    void navigate({ to: "/app/audit/live", search: { url: normalizeUrl(url) } });
  }



  function continueToAudit() {
    const report = resolveReportForUrl(url);
    void navigate({ to: "/app/audit/$runId", params: { runId: report.id } });
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
            className="mt-6 max-w-2xl font-display text-3xl leading-[1.1] tracking-tight sm:text-5xl"
          >
            See exactly where shoppers give up.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground"
          >
            Point the agent at any page. It finds its own way to cart and checkout, then reports the
            copy, costs, and friction costing you orders — pinned to the exact pixels.
          </motion.p>

          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            onSubmit={(event) => void submit(event)}
            className="mt-10"
          >
            <label htmlFor="target-url" className="label-caps">
              Any page on the store — the agent finds the rest
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="target-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy}
                placeholder="wayfarer-outdoor.com/p/atmos-ag-65-backpack"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  "min-w-0 flex-1 rounded-md border border-input bg-card px-4 py-3.5 font-mono text-sm text-foreground shadow-tile outline-none transition-colors",
                  "placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/25",
                  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
                  touched && !valid && url.length > 0 && "border-sev-high",
                )}
              />
              <button
                type="submit"
                disabled={busy}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground",
                  "shadow-tile transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:translate-y-0",
                )}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                {checking ? "Checking the page…" : "Run forensic audit"}
              </button>
            </div>

            <p
              className={cn(
                "mt-2 text-[13px]",
                touched && !valid && url.length > 0 ? "text-sev-high" : "text-muted-foreground",
              )}
            >
              {touched && !valid && url.length > 0
                ? "That doesn't parse as a URL — include the domain, e.g. store.com/p/item"
                : "We check the page loads and what it sells before sending the agent in."}
            </p>

            {preflight ? (
              <TargetSummary
                result={preflight}
                onContinue={continueToAudit}
                onRunLive={runRealAgent}
              />
            ) : null}



          </motion.form>

        </div>
      </div>

      <section className="mx-auto w-full max-w-5xl px-6 pt-14" aria-label="Recent audits">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="label-caps">Recent audits</h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            {recent.length} live {recent.length === 1 ? "run" : "runs"} on file
          </p>
        </div>

        {recent.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No live runs saved yet. Send in the agent and the finished report lands here.
          </p>
        ) : (
          <ul className="mt-4 flex snap-x gap-4 overflow-x-auto pb-3">
            {recent.map((run) => (
              <li key={run.id} className="w-72 shrink-0 snap-start">
                <RecentCard
                  run={run}
                  live
                  thumb={`/api/public/thumb/${run.id}`}
                  {...(run.score === null || run.status !== "complete"
                    ? { onDelete: () => void handleDelete(run.id), deleting: removing.includes(run.id) }
                    : {})}
                />

              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-14 pt-10" aria-label="Sample reports">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="label-caps">Sample reports</h2>
          <p className="font-mono text-[11px] text-muted-foreground">recorded walkthroughs</p>
        </div>

        <ul className="mt-4 flex snap-x gap-4 overflow-x-auto pb-3">
          {fixtureReports.map((report) => {
            const score = scoreReport(report);
            return (
              <li key={report.id} className="w-72 shrink-0 snap-start">
                <RecentCard
                  run={{
                    id: report.id,
                    domain: report.domain,
                    status: report.status,
                    score: report.status === "partial" ? null : score.total,
                    stages: report.stages.length,
                    friction: allFrictionPoints(report).length,
                    consoleErrors: totalConsoleErrors(report),
                    createdAt: report.captured_at,
                  }}
                  thumb={report.stages[0]?.screenshot.src}
                />
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

/**
 * A compact, plain-language read on the target: is it reachable, what is it
 * built on, and what did we spot on the page. No jargon, no big grey slab.
 */
function TargetSummary({
  result,
  onContinue,
  onRunLive,
}: {
  result: PreflightResult;
  onContinue: () => void;
  onRunLive: () => void;
}) {
  const failed = !result.ok;
  const found = result.signals.filter((s) => s.present);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-6"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {failed ? (
          <ShieldAlert className="size-4 shrink-0 text-sev-high" aria-hidden />
        ) : (
          <Check className="size-4 shrink-0 text-primary" aria-hidden />
        )}
        <span className="font-medium text-foreground">
          {failed
            ? "We couldn't open that page"
            : `Page opens fine${result.platform ? ` — ${result.platform} store` : ""}`}
        </span>
        {result.title && !failed ? (
          <span className="truncate text-muted-foreground">· {result.title}</span>
        ) : null}
      </div>

      {result.error ? (
        <p className="mt-2 text-[13px] text-sev-high">{result.error}</p>
      ) : found.length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {found.map((signal) => (
            <li
              key={signal.key}
              className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[12px] text-muted-foreground"
            >
              {signal.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRunLive}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-tile transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover"
        >
          <Sparkles className="size-3.5" aria-hidden />
          Send in the agent
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Open recorded run
          <ArrowRight className="size-3.5" aria-hidden />
        </button>
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        The agent drives a real browser to the cart — a run takes a couple of minutes.
      </p>
    </motion.div>
  );
}



/** One card in the Recent audits rail — saved live runs and fixtures alike. */
function RecentCard({
  run,
  live = false,
  thumb,
  onDelete,
  deleting = false,
}: {
  run: RecentAudit;
  live?: boolean;
  /** First capture of the run, shown as a visual cue for the site audited. */
  thumb?: string | undefined;
  onDelete?: (() => void) | undefined;
  deleting?: boolean | undefined;
}) {
  return (
    <div className="relative h-full">
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-label={`Delete audit for ${run.domain}`}
          className="absolute right-2 top-2 z-10 inline-flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <X className="size-3" aria-hidden />
          )}
        </button>
      ) : null}
    <Link
      to="/app/report/$reportId"
      params={{ reportId: run.id }}
      className="tile group flex h-full flex-col overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover"
    >
      {thumb ? (
        <span className="relative -mx-4 -mt-4 mb-4 block h-28 overflow-hidden border-b border-border bg-secondary">
          <img
            src={thumb}
            alt={`First capture of the ${run.domain} audit`}
            loading="lazy"
            decoding="async"
            className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
        </span>
      ) : null}

      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate font-mono text-xs text-muted-foreground">{run.domain}</p>
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.12em]",
            run.status === "partial" ? "text-sev-medium" : "text-primary",
          )}
        >
          {live ? "live" : run.status}
        </span>
      </div>

      {run.score === null ? (
        <>
          <p className="mt-5 font-mono text-2xl leading-none text-muted-foreground">n/a</p>
          <p className="mt-1 text-sm text-foreground">Not scored</p>
        </>
      ) : (
        <>
          <p className="mt-4 flex items-baseline gap-1.5">
            <span className="font-display text-4xl leading-none tabular-nums">{run.score}</span>
            <span className="font-mono text-xs text-muted-foreground">/100</span>
          </p>
          <p className="mt-1 text-sm text-foreground">{gradeFor(run.score)}</p>
        </>
      )}

      <p className="mt-4 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        {run.stages} stages · {run.friction} friction · {run.consoleErrors} console
        <ArrowRight
          className="size-3 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      </p>
    </Link>
    </div>
  );
}

function gradeFor(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Workable";
  if (score >= 40) return "Leaking";
  return "Critical";
}
