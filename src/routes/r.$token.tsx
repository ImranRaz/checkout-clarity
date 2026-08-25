import { createFileRoute } from "@tanstack/react-router";

import { SharedReportView } from "@/components/audit/SharedReportView";
import { getSharedReport } from "@/lib/share.functions";

export const Route = createFileRoute("/r/$token")({
  loader: async ({ params }) => ({
    report: await getSharedReport({ data: { token: params.token } }),
  }),
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
    const title = `${report.domain} checkout audit — CoherentX`;
    const description = `A walkthrough of the ${report.domain} purchase path: where shoppers hesitate, what it costs, and what to fix first.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: () => <Unavailable />,
  notFoundComponent: () => <Unavailable />,
  component: SharedReport,
});

function Unavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl tracking-tight">This link isn't active</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have expired or been turned off. Ask whoever sent it for a fresh one.
        </p>
      </div>
    </main>
  );
}

function SharedReport() {
  const { report } = Route.useLoaderData();
  if (!report) return <Unavailable />;
  return <SharedReportView report={report} />;
}
