import { createServerFn } from "@tanstack/react-start";

import { auditReportSchema, type ForensicAuditReport } from "./audit-schema";

/**
 * Calls the hosted Stagehand agent (Render) and validates that whatever comes
 * back satisfies the same contract the fixtures do.
 */
export const runLiveAudit = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; report: ForensicAuditReport } | { ok: false; error: string }> => {
    const base = process.env["AGENT_WORKER_URL"];
    const secret = process.env["AGENT_SHARED_SECRET"];
    if (!base) return { ok: false, error: "The agent worker URL is not configured." };

    try {
      const response = await fetch(`${base.replace(/\/$/, "")}/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify({ url: data.url }),
        signal: AbortSignal.timeout(280_000),
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

      const parsed = auditReportSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        return { ok: false, error: "The agent returned a report in an unexpected shape." };
      }
      return { ok: true, report: parsed.data };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The agent run failed.";
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
