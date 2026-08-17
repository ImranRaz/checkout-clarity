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
};

export const listFeaturedReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<FeaturedSummary[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("audit_runs")
        .select("id, domain, url, score, stages_count, friction_count, console_errors, created_at")
        .eq("featured", true)
        .eq("status", "complete")
        .order("created_at", { ascending: false });

      if (error || !data) return [];
      return data.map((row) => ({
        id: row.id as string,
        domain: row.domain as string,
        url: row.url as string,
        score: (row.score as number | null) ?? null,
        stages: (row.stages_count as number) ?? 0,
        findings: (row.friction_count as number) ?? 0,
        consoleErrors: (row.console_errors as number) ?? 0,
      }));
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
