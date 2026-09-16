import { Link, createFileRoute } from "@tanstack/react-router";

import { getUsageOverview, type RunUsage } from "@/lib/usage.functions";

export const Route = createFileRoute("/_authenticated/app/usage")({
  loader: async () => ({ usage: await getUsageOverview() }),
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
      { title: "Run usage | CoherentX console" },
      {
        name: "description",
        content:
          "Browser minutes, model tokens and execution time for every CoherentX audit run, grouped by run and agent.",
      },
      { property: "og:title", content: "Run usage | CoherentX console" },
      {
        property: "og:description",
        content: "What each audit run consumed: browser minutes, tokens and execution time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsagePage,
});

function minutes(value: number) {
  return `${value.toFixed(1)} min`;
}

function tokens(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value));
}

function duration(ms: number) {
  if (ms <= 0) return "0s";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const completionTone: Record<RunUsage["completion"], string> = {
  complete: "border-sev-low/40 text-sev-low",
  partial: "border-sev-med/40 text-sev-med",
  failed: "border-sev-high/40 text-sev-high",
};

function UsagePage() {
  const { usage } = Route.useLoaderData();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <span className="label-caps">console</span>
        <h1 className="mt-2 font-display text-2xl tracking-tight">Run usage</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          What each audit consumed. Browser minutes come from the funnel agent, tokens from the
          models, and execution time is wall clock per run. Provider keys are never shown here.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <SummaryTile label="runs tracked" value={String(usage.totals.runs)} />
        <SummaryTile label="browser minutes" value={minutes(usage.totals.browserMinutes)} />
        <SummaryTile label="model tokens" value={tokens(usage.totals.tokens)} />
        <SummaryTile label="execution time" value={duration(usage.totals.executionMs)} />
      </section>

      <section className="mt-8 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <Th>run</Th>
              <Th>state</Th>
              <Th>browser</Th>
              <Th>tokens</Th>
              <Th>time</Th>
              <Th>agents and models</Th>
            </tr>
          </thead>
          <tbody>
            {usage.runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">
                  No runs on file yet.
                </td>
              </tr>
            ) : (
              usage.runs.map((run) => (
                <tr key={run.runId} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to="/app/report/$reportId"
                      params={{ reportId: run.runId }}
                      className="font-mono text-xs hover:underline"
                    >
                      {run.domain}
                    </Link>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] ${completionTone[run.completion]}`}
                    >
                      {run.completion}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{minutes(run.browserMinutes)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{tokens(run.tokens)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{duration(run.executionMs)}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                    {run.lines.length === 0
                      ? "not metered"
                      : [...new Set(run.lines.map((l) => l.agentType))].join(", ")}
                    {run.models.length > 0 ? ` | ${run.models.join(", ")}` : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <span className="label-caps">{label}</span>
      <div className="mt-1 font-display text-xl tracking-tight">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{children}</th>;
}
