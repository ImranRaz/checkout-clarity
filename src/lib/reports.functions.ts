import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import { allFrictionPoints, auditReportSchema, totalConsoleErrors } from "./audit-schema";
import type { ForensicAuditReport } from "./audit-schema";
import { scoreReport } from "./scoring";

/**
 * Live runs are expensive (real browser minutes), so every finished run is
 * persisted. The landing page reads the most recent saved runs instead of only
 * the bundled fixtures, and a permalink can be reopened without re-running.
 */

export type RecentAudit = {
  id: string;
  domain: string;
  status: string;
  score: number | null;
  stages: number;
  friction: number;
  consoleErrors: number;
  createdAt: string;
};

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Persists a finished report so it shows up under "Recent audits". */
export const saveAuditRun = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string; report: unknown }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const parsed = auditReportSchema.safeParse(data.report);
    if (!parsed.success) return { ok: false, error: "Report failed validation." };
    const report = parsed.data;

    const score = report.status === "partial" ? null : scoreReport(report).total;
    const { error } = await publicClient()
      .from("audit_runs")
      .upsert(
        {
          id: report.id,
          url: data.url,
          domain: report.domain,
          status: report.status,
          score,
          report: report as unknown as Record<string, unknown>,
          stages_count: report.stages.length,
          friction_count: allFrictionPoints(report).length,
          console_errors: totalConsoleErrors(report),
        },
        { onConflict: "id" },
      );

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

/** The most recent saved runs, newest first — summary fields only. */
export const listRecentAudits = createServerFn({ method: "GET" }).handler(
  async (): Promise<RecentAudit[]> => {
    const { data, error } = await publicClient()
      .from("audit_runs")
      .select("id, domain, status, score, stages_count, friction_count, console_errors, created_at")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id as string,
      domain: row.domain as string,
      status: row.status as string,
      score: (row.score as number | null) ?? null,
      stages: (row.stages_count as number) ?? 0,
      friction: (row.friction_count as number) ?? 0,
      consoleErrors: (row.console_errors as number) ?? 0,
      createdAt: row.created_at as string,
    }));
  },
);

/** Full saved report for a permalink. */
export const getSavedAuditRun = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<ForensicAuditReport | null> => {
    const { data: row, error } = await publicClient()
      .from("audit_runs")
      .select("report")
      .eq("id", data.id)
      .maybeSingle();

    if (error || !row) return null;
    const parsed = auditReportSchema.safeParse(row.report);
    return parsed.success ? parsed.data : null;
  });
