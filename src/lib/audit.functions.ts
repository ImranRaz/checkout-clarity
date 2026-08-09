import { createServerFn } from "@tanstack/react-start";

import { auditReportSchema, type ForensicAuditReport, type LogActor } from "./audit-schema";

/**
 * The agent worker runs jobs in the background: a journey takes 1–3 minutes,
 * well past the 100s edge timeout that produced the old HTTP 524. We start a
 * job, then poll it — which also gives the UI a live step feed.
 */

export type LiveStep = {
  actor: LogActor;
  text: string;
  tone: "normal" | "warn" | "error" | "success";
  at: number;
};

export type LivePoll =
  | { ok: false; error: string }
  | {
      ok: true;
      status: "running" | "done" | "error";
      steps: LiveStep[];
      elapsed_ms: number;
      error: string | null;
      report: ForensicAuditReport | null;
    };

function agentConfig() {
  const base = process.env["AGENT_WORKER_URL"];
  const secret = process.env["AGENT_SHARED_SECRET"];
  return {
    base: base ? base.replace(/\/$/, "") : null,
    headers: {
      "content-type": "application/json",
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
  };
}

/** Kicks off a background run and returns its job id straight away. */
export const startLiveAudit = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> => {
    const { base, headers } = agentConfig();
    if (!base) return { ok: false, error: "The agent worker URL is not configured." };

    try {
      const response = await fetch(`${base}/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url: data.url }),
        signal: AbortSignal.timeout(60_000),
      });
      const text = await response.text();
      if (!response.ok) {
        let message = `Agent returned HTTP ${response.status}.`;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          /* keep the generic message */
        }
        return { ok: false, error: message };
      }
      const parsed = JSON.parse(text) as { job_id?: string };
      if (!parsed.job_id) return { ok: false, error: "The agent did not return a job id." };
      return { ok: true, jobId: parsed.job_id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The agent could not be reached.";
      return { ok: false, error: message };
    }
  });

/** Polls a running job for its step log and, once finished, the report. */
export const pollLiveAudit = createServerFn({ method: "POST" })
  .inputValidator((input: { jobId: string }) => input)
  .handler(async ({ data }): Promise<LivePoll> => {
    const { base, headers } = agentConfig();
    if (!base) return { ok: false, error: "The agent worker URL is not configured." };

    try {
      const response = await fetch(`${base}/run/${encodeURIComponent(data.jobId)}`, {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      const text = await response.text();
      if (!response.ok) {
        let message = `Agent returned HTTP ${response.status}.`;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          /* keep the generic message */
        }
        return { ok: false, error: message };
      }

      const raw = JSON.parse(text) as {
        status: "running" | "done" | "error";
        steps?: LiveStep[];
        elapsed_ms?: number;
        error?: string | null;
        report?: unknown;
      };

      let report: ForensicAuditReport | null = null;
      if (raw.report) {
        const parsed = auditReportSchema.safeParse(sanitizeReport(raw.report));
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          return {
            ok: false,
            error: `The agent's report failed validation${
              issue ? ` at ${issue.path.join(".") || "root"}: ${issue.message}` : ""
            }.`,
          };
        }
        report = parsed.data;
      }


      return {
        ok: true,
        status: raw.status,
        steps: raw.steps ?? [],
        elapsed_ms: raw.elapsed_ms ?? 0,
        error: raw.error ?? null,
        report,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The agent poll failed.";
      return { ok: false, error: message };
    }
  });

/** Cheap liveness probe so the UI can warn about a cold Render instance. */
export const pingAgent = createServerFn({ method: "GET" }).handler(async () => {
  const base = process.env["AGENT_WORKER_URL"];
  if (!base) return { available: false };
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(8_000),
    });
    return { available: response.ok };
  } catch {
    return { available: false };
  }
});
