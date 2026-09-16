/**
 * Usage metering for a run.
 *
 * The app can only estimate cost from wall clock. The worker knows the real
 * numbers: how long the Browserbase session was actually open and how many
 * tokens each model consumed. Those are collected here and posted to the app
 * when the job settles.
 *
 * Note: the Stagehand navigation loop makes its own model calls internally and
 * does not expose token usage, so that portion stays unmetered.
 */

let sessionStartedAt = null;
/** model name -> { prompt, completion } */
const tokensByModel = new Map();

/** Marks the moment the Browserbase session became available. */
export function sessionStarted() {
  sessionStartedAt = Date.now();
  tokensByModel.clear();
}

/** Accumulates prompt/completion tokens reported by an AI SDK result. */
export function recordModelUsage(model, usage) {
  if (!model || !usage) return;
  const prompt = Number(usage.promptTokens ?? usage.inputTokens ?? 0);
  const completion = Number(usage.completionTokens ?? usage.outputTokens ?? 0);
  if (!Number.isFinite(prompt) && !Number.isFinite(completion)) return;
  const entry = tokensByModel.get(model) || { prompt: 0, completion: 0 };
  if (Number.isFinite(prompt)) entry.prompt += Math.max(0, prompt);
  if (Number.isFinite(completion)) entry.completion += Math.max(0, completion);
  tokensByModel.set(model, entry);
}

/** Session minutes so far, 0 when no session was ever acquired. */
export function sessionMinutes() {
  if (!sessionStartedAt) return 0;
  return Math.round(((Date.now() - sessionStartedAt) / 60000) * 1000) / 1000;
}

/** Builds the event list the app's /api/public/usage endpoint accepts. */
export function buildEvents(status = "complete") {
  const events = [
    {
      provider: "browserbase",
      agentType: "funnel",
      metricName: "browser_session_metered",
      quantity: sessionMinutes(),
      unit: "minutes",
      status,
    },
  ];

  for (const [model, counts] of tokensByModel) {
    events.push({
      provider: "openai",
      agentType: "funnel",
      metricName: "tokens_prompt",
      quantity: counts.prompt,
      unit: "tokens",
      model,
      status,
    });
    events.push({
      provider: "openai",
      agentType: "funnel",
      metricName: "tokens_completion",
      quantity: counts.completion,
      unit: "tokens",
      model,
      status,
    });
  }

  return events;
}

/** Fire and forget: never throws, never delays the caller. */
export async function reportUsage(jobId, status) {
  try {
    const base = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
    const secret = process.env.AGENT_SHARED_SECRET;
    if (!base || !secret || !jobId) return;
    await fetch(`${base}/api/public/usage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ jobId, events: buildEvents(status) }),
    });
  } catch {
    // Metering must never affect a run's outcome.
  }
}
