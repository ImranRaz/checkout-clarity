import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { preflightTargetUrl, searchWeb } from "./browserbase.server";

/**
 * Live Browserbase-backed endpoints. Fetch/Search are HTTP-only, so they run
 * here in the edge runtime; the full browser-driving agent lives elsewhere.
 */

export const preflightTarget = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ url: z.string().url() }).parse(input))
  .handler(async ({ data }) => preflightTargetUrl(data.url));

export const findStoreCandidates = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ query: z.string(), numResults: z.number().optional() }).parse(input),
  )
  .handler(async ({ data }) => searchWeb(data.query, data.numResults ?? 5));
