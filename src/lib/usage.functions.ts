import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Usage accounting for a run: real browser minutes, model tokens and wall
 * clock. Only metered quantities are stored here. Provider credentials never
 * leave the server, and nothing in this module reads or returns a key.
 */

export type UsageAgent = "funnel" | "reputation" | "system";

export type UsageEventInput = {
  provider: string;
  agentType: UsageAgent;
  metricName: string;
  quantity: number;
  unit: string;
  model?: string | null;
  jobId?: string | null;
  status?: string;
  note?: string | null;
};

export type RunUsage = {
  runId: string;
  domain: string;
  createdAt: string;
  status: string;
  completion: "complete" | "partial" | "failed";
  browserMinutes: number;
  tokens: number;
  executionMs: number;
  providers: string[];
  models: string[];
  lines: {
    provider: string;
    agentType: string;
    metricName: string;
    quantity: number;
    unit: string;
    model: string | null;
    occurredAt: string;
  }[];
};

export type UsageOverview = {
  totals: { browserMinutes: number; tokens: number; executionMs: number; runs: number };
  runs: RunUsage[];
};

const KNOWN_PROVIDERS = new Set(["browserbase", "openai", "lovable-ai", "firecrawl", "internal"]);

function safeProvider(value: string) {
  const slug = value.toLowerCase().trim();
  return KNOWN_PROVIDERS.has(slug) ? slug : "other";
}

/** Writes metered quantities for a finished (or abandoned) run. */
export const recordUsageEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string; events: UsageEventInput[] }) => input)
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const rows = (data.events ?? [])
      .filter((event) => Number.isFinite(event.quantity) && event.quantity >= 0)
      .map((event) => ({
        run_id: data.runId,
        job_id: event.jobId ?? null,
        provider: safeProvider(event.provider),
        agent_type: event.agentType,
        metric_name: event.metricName,
        quantity: Math.round(event.quantity * 1000) / 1000,
        unit: event.unit,
        model: event.model ?? null,
        status: event.status ?? "complete",
        note: event.note ?? null,
      }));
    if (rows.length === 0) return { ok: true };

    const { error } = await context.supabase.from("audit_usage_events").insert(rows);
    // A duplicate just means this run was already accounted for.
    if (error && error.code !== "23505") return { ok: false, error: error.message };
    return { ok: true };
  });

/** Per-run usage rollup for the console's usage view. */
export const getUsageOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageOverview> => {
    const { data: runs } = await context.supabase
      .from("audit_runs")
      .select("id, domain, status, stages_count, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const ids = (runs ?? []).map((r) => r.id as string);
    const { data: events } = ids.length
      ? await context.supabase
          .from("audit_usage_events")
          .select("run_id, provider, agent_type, metric_name, quantity, unit, model, occurred_at")
          .in("run_id", ids)
          .order("occurred_at", { ascending: true })
      : { data: [] as Record<string, unknown>[] };

    const byRun = new Map<string, RunUsage>();
    for (const run of runs ?? []) {
      const status = (run.status as string) ?? "complete";
      byRun.set(run.id as string, {
        runId: run.id as string,
        domain: run.domain as string,
        createdAt: run.created_at as string,
        status,
        completion:
          status === "error" || status === "failed"
            ? "failed"
            : status === "complete"
              ? "complete"
              : "partial",
        browserMinutes: 0,
        tokens: 0,
        executionMs: 0,
        providers: [],
        models: [],
        lines: [],
      });
    }

    for (const raw of (events ?? []) as Record<string, unknown>[]) {
      const entry = byRun.get(raw["run_id"] as string);
      if (!entry) continue;
      const quantity = Number(raw["quantity"] ?? 0);
      const unit = (raw["unit"] as string) ?? "";
      const provider = (raw["provider"] as string) ?? "other";
      const model = (raw["model"] as string | null) ?? null;

      if (unit === "minutes") entry.browserMinutes += quantity;
      else if (unit === "tokens") entry.tokens += quantity;
      else if (unit === "ms") entry.executionMs += quantity;

      if (!entry.providers.includes(provider)) entry.providers.push(provider);
      if (model && !entry.models.includes(model)) entry.models.push(model);
      entry.lines.push({
        provider,
        agentType: (raw["agent_type"] as string) ?? "funnel",
        metricName: (raw["metric_name"] as string) ?? "",
        quantity,
        unit,
        model,
        occurredAt: (raw["occurred_at"] as string) ?? "",
      });
    }

    const list = [...byRun.values()];
    const totals = list.reduce(
      (acc, run) => ({
        browserMinutes: acc.browserMinutes + run.browserMinutes,
        tokens: acc.tokens + run.tokens,
        executionMs: acc.executionMs + run.executionMs,
        runs: acc.runs + 1,
      }),
      { browserMinutes: 0, tokens: 0, executionMs: 0, runs: 0 },
    );

    return { totals, runs: list };
  });
