import { auditReportSchema, type ForensicAuditReport } from "./audit-schema";

/**
 * Live runs are not persisted server-side yet, so the report travels with the
 * browser session. Fixture reports keep using their own ids.
 */

const PREFIX = "checkout-forensic:live:";

export function isLiveId(id: string): boolean {
  return id.startsWith("live-");
}

export function saveLiveReport(report: ForensicAuditReport): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + report.id, JSON.stringify(report));
  } catch {
    /* storage may be unavailable; the run simply won't survive a reload */
  }
}

export function loadLiveReport(id: string): ForensicAuditReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + id);
    if (!raw) return null;
    const parsed = auditReportSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
