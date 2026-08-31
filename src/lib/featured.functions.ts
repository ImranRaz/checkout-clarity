import { createServerFn } from "@tanstack/react-start";

import { auditReportSchema } from "./audit-schema";
import type { ForensicAuditReport } from "./audit-schema";

/**
 * Featured runs are real, hand-picked audits of real stores that we publish as
 * public samples. Everything else in `audit_runs` stays private: these reads go
 * through the admin client but are hard-filtered to `featured = true`.
 */

export type FeaturedSummary = {
  id: string;
  domain: string;
  url: string;
  score: number | null;
  stages: number;
  findings: number;
  consoleErrors: number;
  /** Which tracks this run carries. */
  kind: "both" | "funnel" | "reputation";
  reputationScore: number | null;
  reputationThemes: number;
  averageRating: number | null;
  reviewCount: number | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export const listFeaturedReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<FeaturedSummary[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("audit_runs")
        .select(
          "id, domain, url, score, stages_count, friction_count, console_errors, created_at, rep_score:report->reputation->>score, rep_rating:report->reputation->>average_rating, rep_reviews:report->reputation->>review_count, rep_themes:report->reputation->themes",
        )
        .eq("featured", true)
        .order("created_at", { ascending: false });

      if (error || !data) return [];
      const rows = data.map((row) => {
        const stages = (row.stages_count as number) ?? 0;
        const reputationScore = num((row as Record<string, unknown>)["rep_score"]);
        const themes = (row as Record<string, unknown>)["rep_themes"];
        const kind: FeaturedSummary["kind"] =
          reputationScore !== null && stages > 0
            ? "both"
            : reputationScore !== null
              ? "reputation"
              : "funnel";
        return {
          id: row.id as string,
          domain: row.domain as string,
          url: row.url as string,
          score: (row.score as number | null) ?? null,
          stages,
          findings: (row.friction_count as number) ?? 0,
          consoleErrors: (row.console_errors as number) ?? 0,
          kind,
          reputationScore,
          reputationThemes: Array.isArray(themes) ? themes.length : 0,
          averageRating: num((row as Record<string, unknown>)["rep_rating"]),
          reviewCount: num((row as Record<string, unknown>)["rep_reviews"]),
        };
      });

      // Lead with the run that shows both agents at once.
      const rank = { both: 0, funnel: 1, reputation: 2 } as const;
      return rows.sort((a, b) => rank[a.kind] - rank[b.kind]);
    } catch {
      return [];
    }
  },
);


export const getFeaturedReport = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<ForensicAuditReport | null> => {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(data.id)) return null;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("audit_runs")
        .select("report")
        .eq("id", data.id)
        .eq("featured", true)
        .maybeSingle();

      if (error || !row) return null;
      const parsed = auditReportSchema.safeParse(row.report);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  });
