import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditReportSchema } from "./audit-schema";
import type { ForensicAuditReport } from "./audit-schema";

/**
 * Share links are the outreach surface: an unguessable token that renders one
 * saved report read-only, with no path back into the console. Anonymous reads
 * go through a token-scoped database function, never through table access.
 */

export type ShareLink = {
  token: string;
  runId: string;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  viewCount: number;
  lastViewedAt: string | null;
};


function mintToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type Row = {
  token: string;
  run_id: string;
  created_at: string;
  expires_at: string | null;
  revoked: boolean;
  view_count: number;
  last_viewed_at: string | null;
};

function toLink(row: Row): ShareLink {
  return {
    token: row.token,
    runId: row.run_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revoked: row.revoked,
    viewCount: row.view_count ?? 0,
    lastViewedAt: row.last_viewed_at,
  };
}

/** Every share link minted for one run, newest first. */
export const listShareLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<ShareLink[]> => {
    const { data: rows, error } = await context.supabase
      .from("share_links")
      .select("token, run_id, created_at, expires_at, revoked, view_count, last_viewed_at")
      .eq("run_id", data.runId)
      .order("created_at", { ascending: false });

    if (error || !rows) return [];
    return (rows as unknown as Row[]).map(toLink);
  });

/** Mints a new link. `days` of 0 (or omitted) means it never expires. */
export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string; days?: number }) => input)
  .handler(async ({ data, context }): Promise<{ ok: boolean; link?: ShareLink; error?: string }> => {
    const expiresAt =
      data.days && data.days > 0
        ? new Date(Date.now() + data.days * 86_400_000).toISOString()
        : null;

    const { data: row, error } = await context.supabase
      .from("share_links")
      .insert({
        token: mintToken(),
        run_id: data.runId,
        created_by: context.userId,
        expires_at: expiresAt,
      })
      .select("token, run_id, created_at, expires_at, revoked, view_count, last_viewed_at")
      .single();

    if (error || !row) return { ok: false, error: error?.message ?? "Could not create the link." };
    return { ok: true, link: toLink(row as unknown as Row) };
  });

/** Kills a link without deleting its view history. */
export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await context.supabase
      .from("share_links")
      .update({ revoked: true })
      .eq("token", data.token);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

/**
 * Public: resolves a token to a report. The database function validates the
 * token (live, unrevoked, unexpired) and bumps the view counter; without a
 * valid token there is no anonymous path to any run.
 */
export const getSharedReport = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }): Promise<ForensicAuditReport | null> => {
    if (!/^[a-f0-9]{16,64}$/.test(data.token)) return null;
    const { data: report, error } = await publicClient().rpc("get_shared_report", {
      _token: data.token,
    });
    if (error || !report) return null;
    const parsed = auditReportSchema.safeParse(report);
    return parsed.success ? parsed.data : null;
  });
