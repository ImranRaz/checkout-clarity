import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { ReportDashboard } from "@/components/audit/ReportDashboard";
import { getReportById } from "@/lib/audit-runner";
import { scoreReport } from "@/lib/scoring";

export const Route = createFileRoute("/report/$reportId")({
  loader: ({ params }) => {
    const report = getReportById(params.reportId);
    if (!report) throw notFound();
    return { report };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
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
    const description = `${report.ux_friction_points.length} conversion friction points and ${report.technical_metrics.console_errors.length} console errors found on the ${report.reached_step.toLowerCase()} flow of ${report.domain}.`;
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
  const { report } = Route.useLoaderData();
  const captured = new Date(report.captured_at);

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <Link
          to="/"
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
          {report.reached_step}
        </p>

        <div className="mt-8">
          <ReportDashboard report={report} />
        </div>
      </div>
    </main>
  );
}
