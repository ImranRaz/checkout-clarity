import { createFileRoute, notFound } from "@tanstack/react-router";

import { SharedReportView } from "@/components/audit/SharedReportView";
import { allFrictionPoints, totalConsoleErrors } from "@/lib/audit-schema";
import { getReportById } from "@/lib/audit-runner";
import { getFeaturedReport } from "@/lib/featured.functions";
import { scoreReport } from "@/lib/scoring";

/**
 * Public sample reports. Only bundled fixture runs resolve here — saved live
 * runs are private and reachable through `/r/$token` or the console.
 */
export const Route = createFileRoute("/report/$reportId")({
  loader: async ({ params }) => {
    // Bundled samples first, then any real run we've explicitly featured.
    const fixture = getReportById(params.reportId);
    const report =
      fixture ??
      (await getFeaturedReport({ data: { id: params.reportId } }).catch(() => null));
    if (!report) throw notFound();
    return { report };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.report) {
      return {
        meta: [
          { title: "Report unavailable — CoherentX" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { report } = loaderData;
    const score = scoreReport(report);
    const title = `${report.domain} scored ${score.total}/100 — CoherentX`;
    const description = `${allFrictionPoints(report).length} conversion friction points and ${totalConsoleErrors(report)} console errors found across ${report.stages.length} stages of the ${report.domain} purchase journey.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `https://coherentx.com/report/${report.id}` },
        { property: "og:image", content: "https://coherentx.com/og-cover.jpg" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: "https://coherentx.com/og-cover.jpg" },
      ],
      links: [{ rel: "canonical", href: `https://coherentx.com/report/${report.id}` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Report",
            headline: title,
            description,
            about: report.domain,
            author: { "@type": "Organization", name: "CoherentX" },
            publisher: { "@type": "Organization", name: "CoherentX" },
            url: `https://coherentx.com/report/${report.id}`,
          }),
        },
      ],
    };
  },
  errorComponent: () => <Missing />,
  notFoundComponent: () => <Missing />,
  pendingComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
        Loading report…
      </p>
    </main>
  ),
  component: SampleReport,
});

function Missing() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl tracking-tight">Report not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This sample isn't available. Head back to the home page for the current set.
        </p>
      </div>
    </main>
  );
}

function SampleReport() {
  const { report } = Route.useLoaderData();
  return (
    <SharedReportView
      report={report}
      note="A sample walkthrough from a real store — the same report you receive for your own funnel."
    />
  );
}
