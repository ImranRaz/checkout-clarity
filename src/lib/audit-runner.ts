import type { ForensicAuditReport } from "./audit-schema";
import { fixtureReports, getReportById } from "./fixtures";

/**
 * The single seam between the product and whatever produces a report.
 *
 * Today: fixtures. Later: a hosted browser session (Browserless / Browserbase
 * over WebSocket — a headless browser cannot run inside this edge runtime)
 * feeding the same `ForensicAuditReport` shape. Nothing above this file
 * changes when that swap happens.
 */

export type RunMode = "fixture" | "live";

export const runMode: RunMode = "fixture";

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function isPlausibleUrl(input: string): boolean {
  const value = normalizeUrl(input);
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.hostname.includes(".") && !url.hostname.endsWith(".");
  } catch {
    return false;
  }
}

function hashToIndex(value: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000;
  }
  return hash % length;
}

/**
 * Resolve which report a submitted URL maps to. A known domain returns its
 * own report; anything else is deterministically assigned one so the same URL
 * always yields the same run.
 */
export function resolveReportForUrl(input: string): ForensicAuditReport {
  const value = normalizeUrl(input);
  let hostname = value;
  try {
    hostname = new URL(value).hostname.replace(/^www\./, "");
  } catch {
    /* fall through to hashing the raw string */
  }

  const exact = fixtureReports.find((r) => r.domain === hostname);
  if (exact) return exact;

  const eligible = fixtureReports.filter((r) => r.status === "complete");
  const picked = eligible[hashToIndex(hostname, eligible.length)];
  return picked ?? fixtureReports[0];
}

export function runAudit(input: string): ForensicAuditReport {
  return resolveReportForUrl(input);
}

export { fixtureReports, getReportById };
