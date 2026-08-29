import { createServerFn } from "@tanstack/react-start";

import type { FrictionPoint, ReputationReport, ReputationTheme } from "./audit-schema";
import { analyzeReviews, crossReference, findReviewSources } from "./reputation.server";

/**
 * The reputation track is exposed as three small calls rather than one long
 * one, so the run page can show each stage of the second agent as it happens
 * instead of a single spinner.
 */

export type SourceHitDTO = { url: string; title: string; site: string; text: string };

export const searchReviewSources = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => input)
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; brand: string; domain: string; hits: SourceHitDTO[] }
      | { ok: false; error: string }
    > => {
      try {
        return { ok: true, ...(await findReviewSources(data.url)) };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Review search failed.",
        };
      }
    },
  );

export const analyzeReviewSources = createServerFn({ method: "POST" })
  .inputValidator((input: { brand: string; hits: SourceHitDTO[] }) => input)
  .handler(
    async ({ data }): Promise<{ ok: true; report: ReputationReport } | { ok: false; error: string }> => {
      try {
        return { ok: true, report: await analyzeReviews(data.brand, data.hits) };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Review analysis failed.",
        };
      }
    },
  );

export const synthesizeReputation = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      themes: ReputationTheme[];
      findings: Array<Pick<FrictionPoint, "id" | "title" | "description" | "category">>;
    }) => input,
  )
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; matches: Record<string, number[]> } | { ok: false; error: string }> => {
      try {
        return { ok: true, matches: await crossReference(data.themes, data.findings) };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Cross-reference failed.",
        };
      }
    },
  );
