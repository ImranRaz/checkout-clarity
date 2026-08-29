import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LiveStep } from "@/lib/audit.functions";
import type { FrictionPoint, ForensicAuditReport, ReputationReport } from "@/lib/audit-schema";
import {
  analyzeReviewSources,
  searchReviewSources,
  synthesizeReputation,
} from "@/lib/reputation.functions";
import { mergeReputation } from "@/lib/reputation-merge";

export type LaneStatus = "idle" | "starting" | "running" | "done" | "error";

/**
 * Drives the second (browser-free) agent from the client, one stage at a time,
 * so the run page can show its progress lane-by-lane next to the browser agent
 * instead of hiding the whole thing behind one request.
 */
export function useReputationRun(url: string, enabled: boolean) {
  const search = useServerFn(searchReviewSources);
  const analyze = useServerFn(analyzeReviewSources);
  const synth = useServerFn(synthesizeReputation);

  const [status, setStatus] = useState<LaneStatus>(enabled ? "starting" : "idle");
  const [steps, setSteps] = useState<LiveStep[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReputationReport | null>(null);

  const [synthStatus, setSynthStatus] = useState<LaneStatus>("idle");
  const [synthSteps, setSynthSteps] = useState<LiveStep[]>([]);

  const startedRef = useRef(false);
  const startRef = useRef(Date.now());
  const fns = useRef({ search, analyze, synth });
  fns.current = { search, analyze, synth };

  const push = useCallback(
    (text: string, tone: LiveStep["tone"] = "normal", actor: LiveStep["actor"] = "vision") => {
      setSteps((prev) => [...prev, { actor, text, tone, at: Date.now() - startRef.current }]);
    },
    [],
  );

  useEffect(() => {
    if (!enabled || !url || startedRef.current) return;
    startedRef.current = true;
    startRef.current = Date.now();
    let cancelled = false;

    void (async () => {
      setStatus("running");
      push("Resolving the brand behind this domain", "normal", "system");

      const found = await fns.current.search({ data: { url } });
      if (cancelled) return;
      if (!found.ok) {
        setStatus("error");
        setError(found.error);
        push(found.error, "error", "system");
        return;
      }

      push(`Brand resolved: ${found.brand}`, "success", "system");
      if (found.hits.length === 0) {
        push("No public review pages found for this brand", "warn");
      } else {
        push(`Found ${found.hits.length} review sources`, "success");
        for (const hit of found.hits.slice(0, 6)) push(`Reading ${hit.site}`);
      }

      push("Clustering what customers actually complain about", "normal");
      const analyzed = await fns.current.analyze({
        data: { brand: found.brand, hits: found.hits },
      });
      if (cancelled) return;
      if (!analyzed.ok) {
        setStatus("error");
        setError(analyzed.error);
        push(analyzed.error, "error", "system");
        return;
      }

      const complaints = analyzed.report.themes.filter((t) => t.kind === "complaint").length;
      push(
        analyzed.report.themes.length
          ? `${complaints} complaint ${complaints === 1 ? "theme" : "themes"} across ${analyzed.report.review_count} reviews`
          : "No usable customer reviews in the pages we read",
        analyzed.report.themes.length ? "success" : "warn",
      );
      setReport(analyzed.report);
      setStatus("done");
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, url, push]);

  // Keep the lane clock ticking while it works.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 500);
    return () => clearInterval(id);
  }, [status]);

  /**
   * The payoff: matches complaint themes against the funnel findings so the
   * report can say "customers are already complaining about this one".
   */
  const synthesize = useCallback(
    async (funnelReport: ForensicAuditReport): Promise<ForensicAuditReport> => {
      if (!report) return funnelReport;
      setSynthStatus("running");
      const at = () => Date.now() - startRef.current;
      setSynthSteps([
        { actor: "system", text: "Cross-referencing reviews against on-site findings", tone: "normal", at: at() },
      ]);

      const findings: Array<Pick<FrictionPoint, "id" | "title" | "description" | "category">> =
        funnelReport.stages.flatMap((stage) =>
          stage.friction_points.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            category: p.category,
          })),
        );

      const result = await fns.current.synth({ data: { themes: report.themes, findings } });
      const matches = result.ok ? result.matches : {};
      const merged = mergeReputation(funnelReport, report, matches);
      const corroborated = new Set(Object.values(matches).flat()).size;

      setSynthSteps((prev) => [
        ...prev,
        {
          actor: "vision",
          text: result.ok
            ? corroborated > 0
              ? `${corroborated} on-site ${corroborated === 1 ? "finding is" : "findings are"} corroborated by real customer reviews`
              : "No overlap between customer complaints and on-site findings"
            : result.error,
          tone: result.ok ? (corroborated > 0 ? "success" : "normal") : "warn",
          at: at(),
        },
      ]);
      setSynthStatus(result.ok ? "done" : "error");
      return merged;
    },
    [report],
  );

  return { status, steps, elapsed, error, report, synthesize, synthStatus, synthSteps };
}
