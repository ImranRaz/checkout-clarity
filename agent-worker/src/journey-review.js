import { generateObject, generateText } from "ai";
import { z } from "zod";

import { verticalBrief } from "./vertical.js";

/**
 * The run-level pass no per-page reviewer can do.
 *
 * Each stage reviewer only ever sees one screen. A consultant's real value is
 * in the shape of the whole funnel: how many steps to commit, what is asked
 * for too early, where the price finally appears, what is asked twice, and
 * which three changes are worth doing first. That judgement needs every stage
 * at once, which is what this call gets.
 */

const schema = z.object({
  headline: z.string().describe("One sentence a VP of e-commerce would repeat in a meeting."),
  diagnosis: z
    .string()
    .describe("2-4 sentences on the shape of this funnel and where a motivated buyer most likely abandons."),
  steps_to_commit: z.number().describe("How many steps the buyer took from entry to cart/summary."),
  drop_off_stage: z.string().describe("The label of the stage most likely to lose buyers."),
  moves: z
    .array(
      z.object({
        title: z.string().describe("The change, stated as an instruction."),
        rationale: z.string().describe("Why it earns money here specifically."),
        impact: z.string().describe("material, meaningful or minor"),
        stage: z.string().describe("Which stage label it applies to, or 'journey' if funnel-wide."),
      }),
    )
    .describe("The top three changes, ranked by expected revenue impact."),
});

function clamp(value, limit) {
  const text = String(value ?? "").trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

const IMPACTS = ["material", "meaningful", "minor"];

function parseLoose(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

const SYSTEM = (brief) => `You are the lead of a conversion consultancy presenting to a Fortune-100 e-commerce team. You have just watched a shopper attempt one complete purchase or booking on their site, step by step, and you have your team's per-page findings in front of you.

${brief}

Write the engagement's top-line judgement. You are not listing defects — the team already has the defect list. You are answering: what is the SHAPE of this funnel, and what would you change first if you owned the number?

Judge:
- number of steps to commit, against what is normal for this category;
- information or personal data asked for earlier than it needs to be;
- where the true total price first appears, and whether that is late;
- anything asked for twice, or state the buyer has to re-enter;
- the single stage where a motivated buyer most likely gives up, and why;
- whether the journey ever answers the buyer's biggest unspoken objection for this category.

Be specific to this site. Never write advice that would apply to any website. Name real stages and real wording. Exactly three moves, ranked, each one something a team could ship this quarter.`;

/**
 * @param {(modelId: string) => any} provider
 * @param {{ report: object, vertical?: object }} input
 */
export async function reviewJourney(provider, { report, vertical, timeoutMs = 90000 }) {
  if (process.env.UX_REVIEW_DISABLED === "1") return null;
  const modelId =
    process.env.JOURNEY_REVIEW_MODEL ||
    process.env.UX_REVIEW_MODEL ||
    process.env.REVIEW_MODEL ||
    process.env.STAGEHAND_MODEL ||
    "gpt-4.1";

  const outline = report.stages.map((s, i) => ({
    step: i + 1,
    label: s.label,
    kind: s.kind,
    url: s.url,
    arrived_by: s.transition_in?.action || "entry",
    load_ms: Math.round(s.technical_metrics?.largest_contentful_paint_ms || 0),
    findings: s.friction_points.map((p) => ({
      severity: p.severity,
      category: p.category,
      title: p.title,
      evidence: p.evidence,
    })),
  }));

  const prompt = [
    `Site: ${report.domain}. Entry: ${report.url}.`,
    `Run status: ${report.status}${report.blocked_reason ? ` — ${report.blocked_reason}` : ""}.`,
    `Total time from entry to the last captured step: ${Math.round(report.run_duration_ms / 1000)}s.`,
    ``,
    `The journey, in order: ${JSON.stringify(outline)}`,
  ].join("\n");

  const withTimeout = (promise) => {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Journey review timed out")), timeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
  };

  const system = SYSTEM(verticalBrief(vertical));
  let raw = null;
  try {
    const result = await withTimeout(
      generateObject({ model: provider(modelId), schema, system, prompt }),
    );
    raw = result.object;
  } catch (error) {
    if (/timed out/i.test(error?.message || "")) return null;
    try {
      const retry = await withTimeout(
        generateText({
          model: provider(modelId),
          system: `${system}\n\nReply with JSON only, no prose: {"headline":"...","diagnosis":"...","steps_to_commit":4,"drop_off_stage":"...","moves":[{"title":"...","rationale":"...","impact":"material","stage":"..."}]}`,
          prompt,
        }),
      );
      raw = parseLoose(retry.text);
    } catch {
      return null;
    }
  }

  if (!raw || !raw.headline) return null;

  return {
    headline: clamp(raw.headline, 160),
    diagnosis: clamp(raw.diagnosis, 700),
    steps_to_commit: Number.isFinite(Number(raw.steps_to_commit))
      ? Math.max(1, Math.round(Number(raw.steps_to_commit)))
      : report.stages.length,
    drop_off_stage: clamp(raw.drop_off_stage, 60),
    vertical: (vertical && vertical.name) || "Unclassified commerce",
    moves: (Array.isArray(raw.moves) ? raw.moves : []).slice(0, 3).map((m) => ({
      title: clamp(m?.title, 120),
      rationale: clamp(m?.rationale, 300),
      impact: IMPACTS.find((i) => String(m?.impact || "").toLowerCase().includes(i)) || "meaningful",
      stage: clamp(m?.stage, 60) || "journey",
    })),
  };
}
