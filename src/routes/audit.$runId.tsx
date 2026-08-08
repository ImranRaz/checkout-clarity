import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useCallback, useState } from "react";

import { ReportDashboard } from "@/components/audit/ReportDashboard";
import { TerminalPanel } from "@/components/audit/TerminalPanel";
import { getReportById } from "@/lib/audit-runner";

export const Route = createFileRoute("/audit/$runId")({
  loader: ({ params }) => {
    const report = getReportById(params.runId);
    if (!report) throw notFound();
    return { report };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Run unavailable — Checkout Forensic" }, { name: "robots", content: "noindex" }],
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
  const { report } = Route.useLoaderData();
  const [phase, setPhase] = useState<"running" | "done">("running");
  const finish = useCallback(() => setPhase("done"), []);

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
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
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{report.url}</p>
          </div>
          {phase === "done" && (
            <Link
              to="/report/$reportId"
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
