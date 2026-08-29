/**
 * The reputation agent's server half.
 *
 * Unlike the funnel agent, this track never opens a browser: it searches and
 * reads public review pages over plain HTTP (Firecrawl, through the connector
 * gateway) and reasons about them with the Lovable AI gateway. That is why it
 * can run in the edge runtime, in parallel with the browser run, at a fraction
 * of the cost.
 */

import {
  reputationReportSchema,
  type FrictionPoint,
  type ReputationReport,
  type ReputationTheme,
} from "./audit-schema";

const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

export type SourceHit = {
  url: string;
  title: string;
  site: string;
  text: string;
};

/** Review destinations worth reading, in rough order of signal quality. */
const REVIEW_SITES = [
  "trustpilot.com",
  "reddit.com",
  "sitejabber.com",
  "bbb.org",
  "consumeraffairs.com",
  "resellerratings.com",
  "producthunt.com",
  "tripadvisor.com",
  "cruisecritic.com",
  "yelp.com",
  "g2.com",
];

export function brandFromUrl(url: string): { brand: string; domain: string } {
  let domain = url;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? url;
  }
  const label = domain.split(".")[0] ?? domain;
  const brand = label
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return { brand, domain };
}

function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the web";
  }
}

function friendlySiteName(site: string): string {
  const label = site.split(".")[0] ?? site;
  return label.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function firecrawlSearch(query: string, limit: number): Promise<SourceHit[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIRECRAWL_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("The review search connector is not configured.");
  }

  const response = await fetch(`${FIRECRAWL_GATEWAY}/search`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
    },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Review search failed [${response.status}]: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;

  // v2 search answers either `{data: [...]}` or `{data: {web: [...]}}`.
  const data = payload["data"];
  const rows: Array<Record<string, unknown>> = Array.isArray(data)
    ? (data as Array<Record<string, unknown>>)
    : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>)["web"])
      ? ((data as Record<string, unknown>)["web"] as Array<Record<string, unknown>>)
      : Array.isArray(payload["web"])
        ? (payload["web"] as Array<Record<string, unknown>>)
        : [];

  return rows
    .map((row) => {
      const url = typeof row["url"] === "string" ? row["url"] : "";
      const text =
        (typeof row["markdown"] === "string" ? row["markdown"] : "") ||
        (typeof row["description"] === "string" ? row["description"] : "");
      return {
        url,
        title: typeof row["title"] === "string" ? row["title"] : url,
        site: siteOf(url),
        text: text.slice(0, 12_000),
      };
    })
    .filter((hit) => hit.url.length > 0);
}

/**
 * Search only returns snippets, so the pages that matter get fetched properly.
 * A scrape that fails or times out falls back to the search snippet rather
 * than dropping the source.
 */
async function scrapePage(hit: SourceHit): Promise<SourceHit> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIRECRAWL_API_KEY"];
  if (!lovableKey || !connectionKey) return hit;

  try {
    const response = await fetch(`${FIRECRAWL_GATEWAY}/scrape`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
      },
      body: JSON.stringify({
        url: hit.url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!response.ok) return hit;
    const payload = (await response.json()) as Record<string, unknown>;
    const doc = (payload["data"] ?? payload) as Record<string, unknown>;
    const markdown = typeof doc["markdown"] === "string" ? doc["markdown"] : "";
    return markdown.length > hit.text.length ? { ...hit, text: markdown.slice(0, 12_000) } : hit;
  } catch {
    return hit;
  }
}

/** Finds the pages where this brand is actually being talked about. */
export async function findReviewSources(url: string): Promise<{
  brand: string;
  domain: string;
  hits: SourceHit[];
}> {
  const { brand, domain } = brandFromUrl(url);

  const queries = [
    `"${brand}" reviews ${REVIEW_SITES.slice(0, 4)
      .map((s) => `site:${s}`)
      .join(" OR ")}`,
    `${brand} ${domain} customer complaints refund shipping experience reviews`,
  ];

  const settled = await Promise.allSettled(queries.map((q) => firecrawlSearch(q, 6)));
  const seen = new Set<string>();
  const hits: SourceHit[] = [];

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const hit of result.value) {
      if (seen.has(hit.url)) continue;
      // Reviews of the brand, not the brand's own marketing copy.
      if (hit.site === domain) continue;
      seen.add(hit.url);
      hits.push(hit);
    }
  }

  if (hits.length === 0) {
    const reason = settled.find((s) => s.status === "rejected");
    if (reason && reason.status === "rejected") {
      throw new Error(
        reason.reason instanceof Error ? reason.reason.message : "Review search failed.",
      );
    }
  }

  // Prefer known review destinations, then everything else.
  hits.sort((a, b) => {
    const ra = REVIEW_SITES.indexOf(a.site);
    const rb = REVIEW_SITES.indexOf(b.site);
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
  });

  return { brand, domain, hits: hits.slice(0, 8) };
}

async function askModel(system: string, user: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("The AI gateway is not configured.");

  const response = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429) throw new Error("The analysis model is rate limited — try again shortly.");
    if (response.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    throw new Error(`Review analysis failed [${response.status}]: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content ?? "";
}

function parseJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error("The analysis model returned something that was not JSON.");
  }
}

const THEME_SYSTEM = `You are a voice-of-customer analyst for an e-commerce and booking conversion consultancy.
You are given raw text scraped from public review pages about one brand.
Cluster what customers actually say into themes.

Return STRICT JSON only, no prose, in this exact shape:
{
  "average_rating": number|null,
  "review_count": number,
  "summary": "two sentences on how this brand is perceived",
  "themes": [
    {
      "kind": "complaint" | "praise",
      "title": "short noun phrase, e.g. Surprise shipping cost",
      "summary": "one or two sentences on what customers say and why it matters commercially",
      "mention_count": number,
      "severity": "high" | "medium" | "low",
      "trend": "rising" | "steady" | "fading",
      "category": "trust" | "clarity" | "accessibility" | "form" | "performance" | null,
      "quotes": [ { "text": "verbatim, under 200 chars", "source": "trustpilot.com", "rating": number|null, "url": "source url or null" } ]
    }
  ]
}

Rules:
- Never invent a quote. Every quote must appear in the supplied text.
- 3 to 7 complaint themes and 1 to 3 praise themes, ordered by weight.
- "category" maps the theme to the on-site lens it would show up as: pricing/returns/refund distrust -> trust; confusing product info or promises -> clarity; checkout or form pain -> form; slow site -> performance; otherwise null.
- review_count is your honest estimate of how many distinct reviews the text represents.
- If the text is not really about this brand, return an empty themes array and say so in summary.`;

/** Turns scraped review text into ranked complaint and praise themes. */
export async function analyzeReviews(
  brand: string,
  hits: SourceHit[],
): Promise<ReputationReport> {
  const searched_at = new Date().toISOString();

  const sources = hits.map((hit) => ({
    name: friendlySiteName(hit.site),
    url: hit.url,
    review_count: null,
    average_rating: null,
  }));

  if (hits.length === 0) {
    return reputationReportSchema.parse({
      score: 0,
      average_rating: null,
      review_count: 0,
      summary: `We could not find a credible public review footprint for ${brand}.`,
      sources: [],
      themes: [],
      searched_at,
      note: "No review sources found. This is common for young brands, private B2B sellers, or names that collide with a larger brand.",
    });
  }

  const corpus = hits
    .map((hit) => `### ${hit.title}\nSOURCE: ${hit.site}\nURL: ${hit.url}\n\n${hit.text.slice(0, 6000)}`)
    .join("\n\n---\n\n");

  const raw = await askModel(
    THEME_SYSTEM,
    `Brand: ${brand}\n\nScraped review pages:\n\n${corpus.slice(0, 90_000)}`,
  );
  const parsed = parseJson(raw) as {
    average_rating?: number | null;
    review_count?: number;
    summary?: string;
    themes?: Array<Record<string, unknown>>;
  };

  const themes: ReputationTheme[] = (parsed.themes ?? []).map((theme, index) => ({
    id: `rep-${index + 1}`,
    kind: theme["kind"] === "praise" ? "praise" : "complaint",
    title: String(theme["title"] ?? "Unnamed theme"),
    summary: String(theme["summary"] ?? ""),
    mention_count: Number(theme["mention_count"]) || 1,
    severity: (["high", "medium", "low"] as const).includes(theme["severity"] as never)
      ? (theme["severity"] as ReputationTheme["severity"])
      : "medium",
    trend: (["rising", "steady", "fading"] as const).includes(theme["trend"] as never)
      ? (theme["trend"] as ReputationTheme["trend"])
      : "steady",
    category: (["trust", "clarity", "accessibility", "form", "performance"] as const).includes(
      theme["category"] as never,
    )
      ? (theme["category"] as ReputationTheme["category"])
      : null,
    quotes: Array.isArray(theme["quotes"])
      ? (theme["quotes"] as Array<Record<string, unknown>>).slice(0, 3).map((quote) => ({
          text: String(quote["text"] ?? "").slice(0, 320),
          source: String(quote["source"] ?? "the web"),
          rating: typeof quote["rating"] === "number" ? quote["rating"] : null,
          url: typeof quote["url"] === "string" ? quote["url"] : null,
        }))
      : [],
    corroborates: [],
  }));

  return reputationReportSchema.parse({
    score: reputationScore(themes, parsed.average_rating ?? null),
    average_rating: typeof parsed.average_rating === "number" ? parsed.average_rating : null,
    review_count: Number(parsed.review_count) || 0,
    summary: String(parsed.summary ?? ""),
    sources,
    themes,
    searched_at,
    note: themes.length === 0 ? "The pages we found did not contain usable customer reviews." : null,
  });
}

/**
 * Deterministic, so two runs on the same themes produce the same number:
 * start at 100, subtract weighted complaint severity, add a little back for
 * praise, and let a published star rating pull the result toward itself.
 */
export function reputationScore(themes: ReputationTheme[], rating: number | null): number {
  const weight = { high: 14, medium: 8, low: 4 } as const;
  let score = 100;
  for (const theme of themes) {
    if (theme.kind === "complaint") score -= weight[theme.severity];
    else score += 3;
  }
  score = Math.max(0, Math.min(100, score));
  if (typeof rating === "number" && rating > 0 && rating <= 5) {
    const fromStars = (rating / 5) * 100;
    score = Math.round(score * 0.6 + fromStars * 0.4);
  }
  return Math.round(score);
}

const MATCH_SYSTEM = `You match customer complaint themes to on-site friction findings.
A match means the complaint and the finding describe the SAME underlying problem
(e.g. "surprise shipping cost" matches an unlabelled shipping field at cart).
Be conservative: no plausible-sounding matches, only real ones.

Return STRICT JSON only:
{ "matches": [ { "theme_id": "rep-1", "finding_ids": [3, 7] } ] }
Return an empty array if nothing genuinely matches.`;

/** The differentiator: says which findings customers are already complaining about. */
export async function crossReference(
  themes: ReputationTheme[],
  findings: Array<Pick<FrictionPoint, "id" | "title" | "description" | "category">>,
): Promise<Record<string, number[]>> {
  if (themes.length === 0 || findings.length === 0) return {};

  const raw = await askModel(
    MATCH_SYSTEM,
    JSON.stringify({
      themes: themes
        .filter((t) => t.kind === "complaint")
        .map((t) => ({ id: t.id, title: t.title, summary: t.summary, category: t.category })),
      findings: findings.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description.slice(0, 240),
        category: f.category,
      })),
    }),
  );

  const parsed = parseJson(raw) as { matches?: Array<{ theme_id?: string; finding_ids?: number[] }> };
  const out: Record<string, number[]> = {};
  for (const match of parsed.matches ?? []) {
    if (!match.theme_id || !Array.isArray(match.finding_ids)) continue;
    const ids = match.finding_ids.filter((id) => typeof id === "number");
    if (ids.length) out[match.theme_id] = ids;
  }
  return out;
}
