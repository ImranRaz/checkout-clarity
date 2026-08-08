import express from "express";

import { runJourney } from "./agent.js";

/**
 * Thin HTTP wrapper. The Lovable app posts a URL here and gets back a report
 * in the exact shape the dashboard already renders.
 */

const app = express();
app.use(express.json({ limit: "1mb" }));

const token = process.env.AGENT_SHARED_SECRET;

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/run", async (req, res) => {
  if (token && req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const url = String(req.body?.url || "");
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "A fully qualified http(s) url is required." });
  }

  try {
    const report = await runJourney(url);
    res.json(report);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`agent worker listening on :${port}`));
