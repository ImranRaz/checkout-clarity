import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { allFrictionPoints, auditReportSchema, totalConsoleErrors } from "./audit-schema";
import type { ForensicAuditReport } from "./audit-schema";
import { scoreReport } from "./scoring";

/**
 * Live runs are expensive (real browser minutes), so every finished run is
 * persisted. Saved runs are private: only signed-in console users read or
 * write them. Prospects see a single run through a share link instead.
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
  /** Which agents produced it: both tracks, funnel only, or reputation only. */
  kind: "full" | "funnel" | "reputation";
  /** Reputation score, when that track ran. */
  reputationScore: number | null;
  /** Signature that lets the browser fetch this run's thumbnail. */
  thumbToken: string;
};

function kindOf(stages: number, reputationScore: string | null): RecentAudit["kind"] {
  if (reputationScore == null) return "funnel";
  return stages === 0 ? "reputation" : "full";
}

/** Persists a finished report so it shows up under "Recent audits". */
export const saveAuditRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string; report: unknown }) => input)
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const parsed = auditReportSchema.safeParse(data.report);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return {
        ok: false,
        error: `Report failed validation${first ? ` at ${first.path.join(".")}: ${first.message}` : ""}.`,
      };
    }
    const report = parsed.data;

    const score = report.stages.length > 0 ? scoreReport(report).total : null;
    // Insert only — the table intentionally allows no updates, so an upsert
    // would be rejected outright. A repeat id just means the run is already on
    // file, which is a success from the caller's point of view.
    const { error } = await context.supabase.from("audit_runs").insert({
      id: report.id,
      url: data.url,
      domain: report.domain,
      status: report.status,
      score,
      report: JSON.parse(JSON.stringify(report)),
      stages_count: report.stages.length,
      friction_count: allFrictionPoints(report).length,
      console_errors: totalConsoleErrors(report),
    });

    if (error) {
      if (error.code === "23505") return { ok: true };
      return { ok: false, error: error.message };
    }
    return { ok: true };
  });

/** The most recent saved runs, newest first — summary fields only. */
export const listRecentAudits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecentAudit[]> => {
    const { data, error } = await context.supabase
      .from("audit_runs")
      .select(
        "id, domain, status, score, stages_count, friction_count, console_errors, created_at, reputation_score:report->reputation->>score",
      )
      .order("created_at", { ascending: false })
      .limit(12);

    if (error || !data) return [];
    const { signThumbToken } = await import("./thumb-token.server");
    return Promise.all(
      data.map(async (row) => ({
        id: row.id as string,
        domain: row.domain as string,
        status: row.status as string,
        score: (row.score as number | null) ?? null,
        stages: (row.stages_count as number) ?? 0,
        friction: (row.friction_count as number) ?? 0,
        consoleErrors: (row.console_errors as number) ?? 0,
        createdAt: row.created_at as string,
        kind: kindOf(
          (row.stages_count as number) ?? 0,
          (row as { reputation_score?: string | null }).reputation_score ?? null,
        ),
        reputationScore:
          (row as { reputation_score?: string | null }).reputation_score != null
            ? Number((row as { reputation_score?: string | null }).reputation_score)
            : null,
        thumbToken: await signThumbToken(row.id as string),
      })),
    );
  });

/** Removes an unfinished/unscored run from the Recent audits rail. */
export const deleteAuditRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await context.supabase.from("audit_runs").delete().eq("id", data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

/** Full saved report for the console permalink. */
export const getSavedAuditRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<ForensicAuditReport | null> => {
    const { data: row, error } = await context.supabase
      .from("audit_runs")
      .select("report")
      .eq("id", data.id)
      .maybeSingle();

    if (error || !row) return null;
    const parsed = auditReportSchema.safeParse(row.report);
    return parsed.success ? parsed.data : null;
  });
