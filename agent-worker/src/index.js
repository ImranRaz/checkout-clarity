import express from "express";
import { randomUUID } from "node:crypto";

import { runJourney } from "./agent.js";

/**
 * Thin HTTP wrapper.
 *
 * A full journey takes 1–3 minutes, which is longer than the 100s edge
 * timeout in front of this service (that's the HTTP 524 the app was seeing),
 * so runs are started as background jobs and polled. The job also streams its
 * step log while it runs, which is what the app's live terminal renders.
 */

const app = express();
app.use(express.json({ limit: "1mb" }));

const token = process.env.AGENT_SHARED_SECRET;

/** jobId -> { status, steps, report, error, started_at } */
const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;

function reapJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.started_at > JOB_TTL_MS) jobs.delete(id);
  }
}

function authorized(req) {
  return !token || req.headers.authorization === `Bearer ${token}`;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/run", (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const url = String(req.body?.url || "");
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "A fully qualified http(s) url is required." });
  }

  reapJobs();
  const id = randomUUID();
  const job = { status: "running", steps: [], report: null, error: null, started_at: Date.now() };
  jobs.set(id, job);

  runJourney(url, {
    onLog: (entry) => {
      job.steps.push({ ...entry, at: Date.now() - job.started_at });
    },
  })
    .then((report) => {
      job.report = report;
      job.status = "done";
    })
    .catch((error) => {
      job.error = error?.message || "The agent run failed.";
      job.status = "error";
    });

  res.status(202).json({ job_id: id });
});

app.get("/run/:id", (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Unknown job — the worker may have restarted." });
  res.json({
    status: job.status,
    steps: job.steps,
    elapsed_ms: Date.now() - job.started_at,
    error: job.error,
    report: job.status === "done" ? job.report : null,
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`agent worker listening on :${port}`));
