import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ReportDashboard } from "@/components/audit/ReportDashboard";
import { TerminalPanel } from "@/components/audit/TerminalPanel";
import { getReportById } from "@/lib/audit-runner";
import { isLiveId, loadLiveReport } from "@/lib/live-store";
import type { ForensicAuditReport } from "@/lib/audit-schema";

export const Route = createFileRoute("/_authenticated/app/audit/$runId")({
  loader: ({ params }) => {
    const report = getReportById(params.runId);
    if (!report) {
      if (isLiveId(params.runId)) return { report: null };
      throw notFound();
    }
    return { report };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.report) {
      return {
        meta: [{ title: "Live run — Checkout Forensic — Checkout Forensic" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `Auditing ${loaderData.report.domain} — Checkout Forensic`;
    const description = `Live forensic run against ${loaderData.report.domain}: cart traversal, browser metrics, and mapped conversion friction.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: AuditRun,
});

function AuditRun() {
  const { runId } = Route.useParams();
  const { report: fixtureReport } = Route.useLoaderData();
  const [liveReport, setLiveReport] = useState<ForensicAuditReport | null>(null);
  const [restored, setRestored] = useState(false);
  // A live run already streamed its log on the home page, so it opens straight
  // on the dashboard; fixture runs replay their terminal first.
  const [phase, setPhase] = useState<"running" | "done">(fixtureReport ? "running" : "done");

  const finish = useCallback(() => setPhase("done"), []);

  useEffect(() => {
    if (fixtureReport) return;
    setLiveReport(loadLiveReport(runId));
    setRestored(true);
  }, [fixtureReport, runId]);

  const report = fixtureReport ?? liveReport;

  if (!report) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <Link to="/app" className="label-caps inline-flex items-center gap-1.5">
            <ArrowLeft className="size-3" aria-hidden />
            New audit
          </Link>
          <p className="mt-6 font-mono text-sm text-muted-foreground">
            {restored
              ? "This live run is no longer in this browser session. Run the audit again."
              : "Restoring run…"}
          </p>
        </div>
      </main>
    );
  }

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
              {report.domain}
            </h1>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{report.url}</p>
          </div>
          {phase === "done" && (
            <Link
              to="/app/report/$reportId"
              params={{ reportId: report.id }}
              className="font-mono text-xs text-primary underline-offset-4 hover:underline"
            >
              permalink →
            </Link>
          )}
        </div>

        <div className="mt-8">
          <AnimatePresence mode="wait">
            {phase === "running" ? (
              <div key="terminal">
                <TerminalPanel report={report} onComplete={finish} />
              </div>
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <ReportDashboard report={report} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
