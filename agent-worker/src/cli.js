import { runJourney } from "./agent.js";

const url = process.argv[2];
if (!url) {
  console.error("usage: node src/cli.js <product-url>");
  process.exit(1);
}

const report = await runJourney(url, {
  onLog: ({ actor, text }) => console.log(`[${actor}] ${text}`),
});

// Screenshots are base64 and huge — print a readable summary instead.
console.log(
  JSON.stringify(
    {
      ...report,
      stages: report.stages.map((s) => ({
        ...s,
        screenshot: { ...s.screenshot, src: `<${s.screenshot.src.length} chars>` },
      })),
    },
    null,
    2,
  ),
);
