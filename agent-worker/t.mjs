import { Stagehand } from "@browserbasehq/stagehand";
const r = await fetch("https://api.browserbase.com/v1/projects",{headers:{"X-BB-API-Key":process.env.BROWSERBASE_API_KEY}});
const projectId = (await r.json())[0].id;
const sh = new Stagehand({ env:"BROWSERBASE", useAPI:false, apiKey:process.env.BROWSERBASE_API_KEY, projectId, verbose:2,
  modelName: process.env.STAGEHAND_MODEL, modelClientOptions:{apiKey:process.env.OPENAI_API_KEY, baseURL:process.env.OPENAI_BASE_URL}});
try { await sh.init(); console.log("init ok"); await sh.page.goto("https://example.com"); console.log("title", await sh.page.title()); }
catch(e){ console.log("ERR", e?.stack || e); }
finally { await sh.close().catch(()=>{}); }
