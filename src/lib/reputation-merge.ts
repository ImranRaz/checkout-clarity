import type { ForensicAuditReport, ReputationReport } from "./audit-schema";

/**
 * Folds the reputation agent's output into the funnel report, and writes the
 * corroboration links both ways so the UI can cross-link without recomputing
 * anything. Pure and deterministic, so a shared or exported report shows the
 * same links as the live one.
 */
export function mergeReputation(
  report: ForensicAuditReport,
  reputation: ReputationReport,
  matches: Record<string, number[]>,
): ForensicAuditReport {
  const themes = reputation.themes.map((theme) => ({
    ...theme,
    corroborates: matches[theme.id] ?? [],
  }));

  const themeByFinding = new Map<number, string>();
  for (const theme of themes) {
    for (const id of theme.corroborates) themeByFinding.set(id, theme.id);
  }

  return {
    ...report,
    reputation: { ...reputation, themes },
    stages: report.stages.map((stage) => ({
      ...stage,
      friction_points: stage.friction_points.map((point) => {
        const themeId = themeByFinding.get(point.id);
        return themeId ? { ...point, corroborated_by: themeId } : point;
      }),
    })),
  };
}

/** Total findings customers are independently complaining about. */
export function corroboratedCount(report: ForensicAuditReport): number {
  return report.stages.reduce(
    (n, stage) => n + stage.friction_points.filter((p) => p.corroborated_by).length,
    0,
  );
}

/**
 * A reputation-only run still deserves a saved, shareable, exportable report.
 * It carries no stages — the funnel agent never ran — so everything downstream
 * (recent audits, permalink, share link, PDF) treats it as a report whose only
 * track is what customers say.
 */
export function reputationOnlyReport(
  url: string,
  reputation: ReputationReport,
  runDurationMs: number,
): ForensicAuditReport {
  let domain = url;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* keep the raw string */
  }
  return {
    id: `live-${Date.now().toString(36)}`,
    url,
    domain,
    status: "partial",
    blocked_reason: null,
    captured_at: new Date().toISOString(),
    run_duration_ms: runDurationMs,
    steps: [],
    stages: [],
    reputation,
  };
}

/** True when a report only carries the reputation track. */
export function isReputationOnly(report: ForensicAuditReport): boolean {
  return report.stages.length === 0 && !!report.reputation;
}
