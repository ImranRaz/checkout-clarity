/**
 * Shapes returned by the Browserbase-backed preflight. Client-safe: types only,
 * no runtime imports, so both the UI and the server function can use them.
 */

export type PreflightSignal = {
  key: string;
  label: string;
  /** true = present, false = absent, null = could not determine */
  present: boolean | null;
  detail: string;
};

export type PreflightResult = {
  url: string;
  ok: boolean;
  /** HTTP status the real page returned, as seen by Browserbase. */
  statusCode: number | null;
  /** Set when the page looks bot-protected rather than genuinely broken. */
  blocked: boolean;
  title: string | null;
  platform: string | null;
  contentChars: number;
  elapsedMs: number;
  signals: PreflightSignal[];
  error: string | null;
};

export type SearchHit = {
  url: string;
  title: string;
};
