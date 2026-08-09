/**
 * Browserbase REST helpers.
 *
 * Fetch and Search are plain HTTP endpoints — no browser session is spun up —
 * so they run inside this app's edge runtime, unlike Playwright/Stagehand,
 * which need a Node host (that lives in the separate agent worker).
 *
 * Auth is a single `X-BB-API-Key` header. No project id is required; the key
 * resolves the project.
 */

import type { PreflightResult, PreflightSignal, SearchHit } from "./preflight-types";

const API_BASE = "https://api.browserbase.com/v1";

type FetchPageResponse = {
  id: string;
  statusCode: number;
  headers: Record<string, string>;
  content: string;
};

type SearchResponse = {
  results?: Array<{ url: string; title?: string }>;
};

function apiKey(): string {
  const key = process.env["BROWSERBASE_API_KEY"];
  if (!key) throw new Error("BROWSERBASE_API_KEY is not configured");
  return key;
}

async function callBrowserbase<T>(path: string, body: unknown): Promise<T> {
  // The reader endpoint occasionally answers 5xx on heavy, slow marketing
  // pages (travel and booking sites especially). That is our reader hiccuping,
  // not the site refusing us, so retry once before giving up.
  let lastStatus = 0;
  let lastText = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "X-BB-API-Key": apiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.ok) return (await response.json()) as T;

    lastStatus = response.status;
    lastText = await response.text().catch(() => "");
    if (lastStatus < 500) break;
  }

  if (lastStatus >= 500) {
    throw new Error(
      "We couldn't preview this page (the page reader timed out). This usually means a heavy, slow page — not a block. You can still send in the agent.",
    );
  }
  throw new Error(`Browserbase ${path} returned ${lastStatus}: ${lastText.slice(0, 300)}`);
}


const BLOCK_PATTERNS =
  /just a moment|checking your browser|access denied|robot or human|are you a (human|robot)|verify (you are|that you)|captcha|unusual traffic|request blocked/i;

function detectPlatform(headers: Record<string, string>, content: string): string | null {
  const headerBlob = Object.entries(headers)
    .map(([k, v]) => `${k}:${v}`)
    .join("\n")
    .toLowerCase();

  if (headerBlob.includes("shopify")) return "Shopify";
  if (headerBlob.includes("woocommerce") || /woocommerce/i.test(content)) return "WooCommerce";
  if (headerBlob.includes("bigcommerce")) return "BigCommerce";
  if (headerBlob.includes("magento")) return "Magento";
  if (/squarespace/i.test(headerBlob)) return "Squarespace";
  return null;
}

function firstHeading(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function buildSignals(content: string): PreflightSignal[] {
  const has = (re: RegExp) => re.test(content);

  return [
    {
      key: "add-to-cart",
      label: "Add-to-cart control",
      present: has(/add to (cart|bag|basket)|buy (it )?now/i),
      detail: "A purchase entry point the agent can click to advance the journey.",
    },
    {
      key: "price",
      label: "Visible price",
      present: has(/[$£€]\s?\d/) || has(/\d+[.,]\d{2}\s?(usd|eur|gbp)/i),
      detail: "A price rendered in the initial HTML rather than injected later.",
    },
    {
      key: "quantity",
      label: "Quantity control",
      present: has(/\bquantity\b|\bqty\b/i),
      detail: "Lets the audit check quantity editing on the product page.",
    },
    {
      key: "variants",
      label: "Variant selection",
      present: has(/\b(size|colou?r|variant|select an option)\b/i),
      detail: "Multi-variant products add a required step before add-to-cart.",
    },
    {
      key: "cart-link",
      label: "Cart route",
      present: has(/\/cart\b|\bview (cart|bag)\b|shopping (cart|bag)/i),
      detail: "A reachable cart page for the final stage of the journey.",
    },
    {
      key: "search-funnel",
      label: "Search-first booking funnel",
      present: has(
        /\b(find a (cruise|trip|flight|stay)|search (cruises|sailings|trips|dates|rooms)|destination|itinerar(y|ies)|departure date|check[- ]in)\b/i,
      ),
      detail: "The journey starts with a search step rather than a product grid.",
    },
    {
      key: "book-control",
      label: "Booking entry point",
      present: has(/\b(book now|reserve|select (cabin|room|stateroom|fare)|continue to guests?)\b/i),
      detail: "A reservation control the agent can drive toward a booking summary.",
    },
  ];
}

/** Fetch a page through Browserbase and derive journey-readiness signals. */
export async function preflightTargetUrl(url: string): Promise<PreflightResult> {
  const startedAt = Date.now();

  const base: PreflightResult = {
    url,
    ok: false,
    statusCode: null,
    blocked: false,
    title: null,
    platform: null,
    contentChars: 0,
    elapsedMs: 0,
    signals: [],
    error: null,
  };

  try {
    const page = await callBrowserbase<FetchPageResponse>("/fetch", {
      url,
      format: "markdown",
      // Stores routinely redirect (www, trailing slash, locale). Without this
      // the fetch stops on the 301 and returns an empty body.
      allowRedirects: true,
    });


    const content = page.content ?? "";
    const blocked = page.statusCode === 403 || page.statusCode === 429 || BLOCK_PATTERNS.test(content);

    return {
      ...base,
      // Redirects are already followed, so a lingering 3xx is an unresolved
      // chain, not a healthy target.
      ok: page.statusCode >= 200 && page.statusCode < 300 && !blocked,

      statusCode: page.statusCode,
      blocked,
      title: firstHeading(content),
      platform: detectPlatform(page.headers ?? {}, content),
      contentChars: content.length,
      elapsedMs: Date.now() - startedAt,
      signals: blocked ? [] : buildSignals(content),
      error: blocked ? "The page responded, but its contents look like a bot-protection wall." : null,
    };
  } catch (error) {
    return {
      ...base,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Preflight failed.",
    };
  }
}

/** Find candidate store URLs for a query, without opening a browser. */
export async function searchWeb(query: string, numResults: number): Promise<SearchHit[]> {
  const data = await callBrowserbase<SearchResponse>("/search", { query, numResults });
  return (data.results ?? []).map((r) => ({
    url: r.url,
    title: r.title?.trim() || r.url,
  }));
}
