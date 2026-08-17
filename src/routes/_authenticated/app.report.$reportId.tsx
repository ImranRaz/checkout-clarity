import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ReportDashboard } from "@/components/audit/ReportDashboard";
import { allFrictionPoints, reachedStep, totalConsoleErrors } from "@/lib/audit-schema";
import { getReportById } from "@/lib/audit-runner";
import { isLiveId, loadLiveReport } from "@/lib/live-store";
import { getSavedAuditRun } from "@/lib/reports.functions";
import type { ForensicAuditReport } from "@/lib/audit-schema";
import { scoreReport } from "@/lib/scoring";


export const Route = createFileRoute("/_authenticated/app/report/$reportId")({
  loader: ({ params }) => {
    const report = getReportById(params.reportId);
    if (!report) {
      if (isLiveId(params.reportId)) return { report: null };
      throw notFound();
    }
    return { report };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.report) {
      return {
        meta: [
          { title: "Report unavailable — Checkout Forensic" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { report } = loaderData;
    const score = scoreReport(report);
    const title = `${report.domain} scored ${score.total}/100 — Checkout Forensic`;
    const description = `${allFrictionPoints(report).length} conversion friction points and ${totalConsoleErrors(report)} console errors found across ${report.stages.length} stages of the ${report.domain} purchase journey.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ReportPage,
});

function ReportPage() {
  const { reportId } = Route.useParams();
  const { report: fixtureReport } = Route.useLoaderData();
  const loadSaved = useServerFn(getSavedAuditRun);
  const [liveReport, setLiveReport] = useState<ForensicAuditReport | null>(null);
  const [restored, setRestored] = useState(false);

  const loadSavedRef = useRef(loadSaved);
  loadSavedRef.current = loadSaved;

  useEffect(() => {
    if (fixtureReport) return;
    let active = true;
    const cached = loadLiveReport(reportId);
    if (cached) {
      setLiveReport(cached);
      setRestored(true);
      return;
    }
    void (async () => {
      const saved = await loadSavedRef.current({ data: { id: reportId } });
      if (!active) return;
      setLiveReport(saved);
      setRestored(true);
    })();
    return () => {
      active = false;
    };
  }, [fixtureReport, reportId]);

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
              ? "This live report is no longer in this browser session. Run the audit again."
              : "Restoring report…"}
          </p>
        </div>
      </main>
    );
  }

  const captured = new Date(report.captured_at);

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
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
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          captured {captured.toISOString().replace("T", " ").slice(0, 16)} UTC · reached{" "}
          {reachedStep(report)}
        </p>

        <div className="mt-8">
          <ReportDashboard report={report} />
        </div>
      </div>
    </main>
  );
}
