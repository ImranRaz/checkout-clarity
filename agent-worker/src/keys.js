/**
 * Browserbase key pool.
 *
 * Free plans cap browser minutes per account, so testing runs dry fast. Any
 * number of keys can be supplied and the pool rotates through them: each run
 * starts at the next key (round-robin, so load spreads) and falls forward to
 * the next one whenever a key is out of minutes, rate limited, or rejected.
 *
 * Config (either form, combined and de-duplicated):
 *   BROWSERBASE_API_KEY   = bb_live_one
 *   BROWSERBASE_API_KEYS  = bb_live_one,bb_live_two,bb_live_three
 */

export function loadKeys() {
  const raw = [process.env.BROWSERBASE_API_KEY, process.env.BROWSERBASE_API_KEYS]
    .filter(Boolean)
    .join(",");
  return [...new Set(raw.split(/[,\s]+/).map((k) => k.trim()).filter(Boolean))];
}

/** Never print a full key — just enough to tell two accounts apart in a log. */
export function keyLabel(key) {
  return key ? `…${key.slice(-6)}` : "unknown";
}

let cursor = 0;

/**
 * Returns the keys in rotation order for this run, starting one past the key
 * the previous run started with.
 */
export function rotationOrder() {
  const keys = loadKeys();
  if (keys.length === 0) return [];
  const start = cursor % keys.length;
  cursor = (cursor + 1) % keys.length;
  return [...keys.slice(start), ...keys.slice(0, start)];
}

/** Statuses where trying a different account is worthwhile. */
export function isExhaustedStatus(status) {
  return status === 402 || status === 429 || status === 401 || status === 403;
}
