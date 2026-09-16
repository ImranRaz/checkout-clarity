import { createFileRoute } from "@tanstack/react-router";

/**
 * Metering sink for the agent worker.
 *
 * The worker knows the real provider quantities (browser session minutes,
 * model tokens) that the browser client can only estimate. It posts them here
 * keyed by job id; the run id is attached later, once the run is saved.
 *
 * Bearer-authenticated with the shared worker secret. Nothing secret is
 * logged or returned.
 */

const AGENTS = new Set(["funnel", "reputation", "system"]);
const KNOWN_PROVIDERS = new Set(["browserbase", "openai", "lovable-ai", "firecrawl", "internal"]);

type IncomingEvent = {
  provider: string;
  agentType: string;
  metricName: string;
  quantity: number;
  unit: string;
  model?: unknown;
  status?: unknown;
  note?: unknown;
};

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function optionalStr(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  return str(value, max);
}

export const Route = createFileRoute("/api/public/usage")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["AGENT_SHARED_SECRET"];
        const header = request.headers.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (!secret || !token || token !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
        }

        const payload = (body ?? {}) as { jobId?: unknown; events?: unknown };
        const jobId = str(payload.jobId, 128);
        if (!jobId) return Response.json({ ok: false, error: "Missing jobId" }, { status: 400 });
        if (!Array.isArray(payload.events) || payload.events.length === 0) {
          return Response.json({ ok: false, error: "Missing events" }, { status: 400 });
        }
        if (payload.events.length > 200) {
          return Response.json({ ok: false, error: "Too many events" }, { status: 400 });
        }

        const rows: Record<string, unknown>[] = [];
        for (const raw of payload.events as IncomingEvent[]) {
          if (!raw || typeof raw !== "object") {
            return Response.json({ ok: false, error: "Invalid event" }, { status: 400 });
          }
          const provider = str(raw.provider, 64);
          const agentType = str(raw.agentType, 32);
          const metricName = str(raw.metricName, 64);
          const unit = str(raw.unit, 32);
          const quantity = typeof raw.quantity === "number" ? raw.quantity : Number.NaN;
          if (!provider || !metricName || !unit) {
            return Response.json({ ok: false, error: "Invalid event fields" }, { status: 400 });
          }
          if (!agentType || !AGENTS.has(agentType)) {
            return Response.json({ ok: false, error: "Invalid agentType" }, { status: 400 });
          }
          if (!Number.isFinite(quantity) || quantity < 0) {
            return Response.json({ ok: false, error: "Invalid quantity" }, { status: 400 });
          }
          rows.push({
            run_id: null,
            job_id: jobId,
            provider: KNOWN_PROVIDERS.has(provider.toLowerCase()) ? provider.toLowerCase() : "other",
            agent_type: agentType,
            metric_name: metricName,
            quantity: Math.round(quantity * 1000) / 1000,
            unit,
            model: optionalStr(raw.model, 128),
            status: optionalStr(raw.status, 32) ?? "complete",
            note: optionalStr(raw.note, 500),
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // If this job already produced a run, attach the rows to it right away.
        const { data: existing } = await supabaseAdmin
          .from("audit_usage_events")
          .select("run_id")
          .eq("job_id", jobId)
          .not("run_id", "is", null)
          .limit(1);
        const runId = (existing?.[0]?.run_id as string | undefined) ?? null;
        if (runId) for (const row of rows) row["run_id"] = runId;

        const { error } = await supabaseAdmin.from("audit_usage_events").insert(rows);
        if (error && error.code !== "23505") {
          return Response.json({ ok: false, error: "Could not record usage" }, { status: 500 });
        }

        return Response.json({ ok: true, recorded: rows.length });
      },
    },
  },
});
