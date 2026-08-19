import { BrandLockup } from "@/components/BrandMark";

import { ReportDashboard } from "@/components/audit/ReportDashboard";
import { allFrictionPoints, reachedStep } from "@/lib/audit-schema";
import type { ForensicAuditReport } from "@/lib/audit-schema";

/**
 * The read-only surface a prospect sees. Same dashboard, none of the console:
 * no run form, no rerun, no delete, no links back into the app.
 */
export function SharedReportView({
  report,
  note,
}: {
  report: ForensicAuditReport;
  note?: string;
}) {
  const captured = new Date(report.captured_at);

  return (
    <main className="min-h-screen">
      <header className="rule-grid border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <p className="flex items-center gap-2.5">
            <BrandLockup />
            <span className="label-caps">shared report</span>
          </p>
          <h1 className="mt-4 truncate font-display text-3xl tracking-tight sm:text-4xl">
            {report.domain}
          </h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            captured {captured.toISOString().replace("T", " ").slice(0, 16)} UTC · reached{" "}
            {reachedStep(report)} · {allFrictionPoints(report).length} findings
          </p>
          {note ? <p className="mt-4 max-w-2xl text-sm text-muted-foreground">{note}</p> : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <ReportDashboard report={report} />
      </div>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg tracking-tight">
              Want the same walkthrough on your full funnel?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              We audit the real purchase path — category to guest checkout — and hand you the fixes
              in priority order.
            </p>
          </div>
          <a
            href="mailto:hello@checkoutforensic.com?subject=Checkout%20audit"
            className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-tile transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover"
          >
            Talk to us
          </a>
        </div>
        <div className="mx-auto w-full max-w-6xl px-6 pb-8">
          <p className="font-mono text-[11px] text-muted-foreground">
            Scores are computed by a fixed rubric, not generated. Pins are derived from element
            bounding boxes.
          </p>
        </div>
      </footer>
    </main>
  );
}
