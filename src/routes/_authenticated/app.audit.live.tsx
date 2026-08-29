import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LiveTerminal } from "@/components/audit/LiveTerminal";
import { ReportDashboard } from "@/components/audit/ReportDashboard";
import { ReputationPanel } from "@/components/audit/ReputationPanel";
import { useReputationRun } from "@/components/audit/useReputationRun";
import { pollLiveAudit, startLiveAudit, type LiveStep } from "@/lib/audit.functions";
import { normalizeUrl } from "@/lib/audit-runner";
import type { ForensicAuditReport } from "@/lib/audit-schema";
import { saveLiveReport } from "@/lib/live-store";
import { saveAuditRun } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/app/audit/live")({
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search["url"] === "string" ? search["url"] : "",
    // Both tracks default on: a bare link to this page runs the full thing.
    funnel: search["funnel"] === false || search["funnel"] === "false" ? false : true,
    rep: search["rep"] === false || search["rep"] === "false" ? false : true,
  }),
  head: () => ({
    meta: [
      { title: "Live agent run — CoherentX" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LiveRun,
});

function hostOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return url || "target";
  }
}

function LiveRun() {
  const { url, funnel: funnelEnabled, rep: repEnabled } = Route.useSearch();
  const router = useRouter();
  const startLive = useServerFn(startLiveAudit);
  const pollLive = useServerFn(pollLiveAudit);
  const persistRun = useServerFn(saveAuditRun);

  const [status, setStatus] = useState<"starting" | "running" | "done" | "error">(
    funnelEnabled ? "starting" : "done",
  );
  const [steps, setSteps] = useState<LiveStep[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The browser agent's raw output, before the reputation agent's synthesis.
  const [rawReport, setRawReport] = useState<ForensicAuditReport | null>(null);
  const [report, setReport] = useState<ForensicAuditReport | null>(null);

  const reputation = useReputationRun(normalizeUrl(url || "example.com"), repEnabled && !!url);

  const startedRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);
  const cancelled = useRef(false);

  // Server-function wrappers get a fresh identity on every render, so they must
  // stay out of the effect deps — otherwise the effect tears down and its
  // cleanup cancels the poll loop that the guarded re-run never restarts.
  const fns = useRef({ startLive, pollLive, persistRun });
  fns.current = { startLive, pollLive, persistRun };

  useEffect(() => {
    if (!url || !funnelEnabled) return;
    // Always clear the cancel flag on (re)mount. React's dev double-invoke
    // tears the first effect down immediately; without this the loop below
    // would see a stale `true` and abandon a job that is happily running.
    cancelled.current = false;

    void (async () => {
      if (!jobIdRef.current) {
        if (startedRef.current) return; // a start is already in flight
        startedRef.current = true;
        const started = await fns.current.startLive({ data: { url: normalizeUrl(url) } });
        if (!started.ok) {
          setStatus("error");
          setError(started.error);
          return;
        }
        jobIdRef.current = started.jobId;
      }
      const jobId = jobIdRef.current;
      if (!jobId || cancelled.current) return;
      setStatus("running");

      const deadline = Date.now() + 8 * 60 * 1000;
      let consecutiveFailures = 0;

      while (!cancelled.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (cancelled.current) return;

        const poll = await fns.current.pollLive({ data: { jobId } });
        if (cancelled.current) return;
        if (!poll.ok) {
          // A single flaky poll shouldn't kill a run that's still going.
          consecutiveFailures += 1;
          if (consecutiveFailures >= 4) {
            setStatus("error");
            setError(poll.error);
            return;
          }
          continue;
        }
        consecutiveFailures = 0;

        setSteps(poll.steps);
        setElapsed(poll.elapsed_ms);

        if (poll.status === "error") {
          setStatus("error");
          setError(poll.error ?? "The agent run failed.");
          return;
        }
        if (poll.status === "done" && poll.report) {
          setRawReport(poll.report);
          setStatus("done");
          return;
        }
      }

      if (!cancelled.current) {
        setStatus("error");
        setError("The run exceeded eight minutes and was abandoned.");
      }
    })();

    return () => {
      cancelled.current = true;
    };
  }, [url, funnelEnabled]);

  /**
   * Finalisation waits for both agents: the funnel report is only published
   * once the reputation agent has had its chance to cross-reference it, so the
   * saved report and the shared link carry the same corroboration links.
   */
  const finalizedRef = useRef(false);
  useEffect(() => {
    if (!rawReport || finalizedRef.current) return;
    const repSettled =
      !repEnabled || reputation.status === "done" || reputation.status === "error";
    if (!repSettled) return;
    finalizedRef.current = true;

    void (async () => {
      const merged =
        repEnabled && reputation.report ? await reputation.synthesize(rawReport) : rawReport;

      saveLiveReport(merged);
      // Persist it so the run shows up under "Recent audits" and its permalink
      // keeps working in another browser or after a reload.
      void fns.current
        .persistRun({ data: { url: normalizeUrl(url), report: merged } })
        .then((res) => {
          if (!res?.ok) {
            setSaveError(res?.error ?? "Could not save this run.");
            return;
          }
          void router.invalidate();
        })
        .catch((err: unknown) => {
          setSaveError(err instanceof Error ? err.message : "Could not save this run.");
        });

      setReport(merged);
    })();
  }, [rawReport, repEnabled, reputation, router, url]);

  // Keep the clock moving between two-second polls.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setElapsed((ms) => ms + 1000), 1000);
    return () => clearInterval(id);
  }, [status]);

  // A finished run keeps its terminal on screen for a beat, then hands over to
  // the dashboard — the same reveal the recorded runs use.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!report) return;
    const id = setTimeout(() => setRevealed(true), 900);
    return () => clearTimeout(id);
  }, [report]);

  const domain = hostOf(url);
  const bothTracks = funnelEnabled && repEnabled;
  // Reputation-only runs have no funnel report to attach to, so they render
  // their own panel once the second agent finishes.
  const repOnlyDone = !funnelEnabled && repEnabled && reputation.status === "done";

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/app"
              className="label-caps inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3" aria-hidden />
              New audit
            </Link>
            <h1 className="mt-3 truncate font-display text-3xl tracking-tight sm:text-4xl">
              {domain}
            </h1>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
              {url || "No target supplied"}
            </p>
          </div>
          {report && revealed ? (
            <Link
              to="/app/audit/$runId"
              params={{ runId: report.id }}
              className="font-mono text-xs text-primary underline-offset-4 hover:underline"
            >
              permalink →
            </Link>
          ) : null}
        </div>

        {saveError ? (
          <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            Not saved to Recent audits — {saveError}
          </p>
        ) : null}

        <div className="mt-8">
          <AnimatePresence mode="wait">
            {report && revealed ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <ReportDashboard report={report} />
              </motion.div>
            ) : (
              <div key="terminal" className="space-y-4">
                {bothTracks ? (
                  <p className="label-caps">Two agents working in parallel</p>
                ) : null}

                <div className={bothTracks ? "grid gap-4 lg:grid-cols-2" : ""}>
                  {funnelEnabled ? (
                    <LiveTerminal
                      title={bothTracks ? "Funnel agent · real browser" : undefined}
                      label="funnel-agent"
                      domain={domain}
                      steps={steps}
                      elapsedMs={elapsed}
                      status={status}
                      error={error}
                      compact={bothTracks}
                    />
                  ) : null}

                  {repEnabled ? (
                    <LiveTerminal
                      title={bothTracks ? "Reputation agent · public reviews" : undefined}
                      label="reputation-agent"
                      domain={domain}
                      steps={reputation.steps}
                      elapsedMs={reputation.elapsed}
                      status={reputation.status === "idle" ? "starting" : reputation.status}
                      error={reputation.error}
                      idleMessage="Looking for where this brand is reviewed…"
                      compact={bothTracks}
                    />
                  ) : null}
                </div>

                {bothTracks && reputation.synthStatus !== "idle" ? (
                  <LiveTerminal
                    title="Synthesis · matching reviews to findings"
                    label="synthesis"
                    domain={domain}
                    steps={reputation.synthSteps}
                    elapsedMs={0}
                    status={reputation.synthStatus === "running" ? "running" : "done"}
                    error={null}
                    compact
                  />
                ) : null}

                {repOnlyDone && reputation.report ? (
                  <div className="pt-4">
                    <ReputationPanel reputation={reputation.report} />
                  </div>
                ) : null}

                {status === "error" && !repOnlyDone ? (
                  <Link
                    to="/app"
                    className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Try another URL
                  </Link>
                ) : null}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
