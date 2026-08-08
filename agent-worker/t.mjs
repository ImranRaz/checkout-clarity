import { Stagehand } from "@browserbasehq/stagehand";
import { VITALS_INIT, VITALS_READ } from "./src/vitals.js";
import { FRICTION_SCRIPT } from "./src/friction.js";
const r = await fetch("https://api.browserbase.com/v1/projects",{headers:{"X-BB-API-Key":process.env.BROWSERBASE_API_KEY}});
const projectId = (await r.json())[0].id;
const sh = new Stagehand({ env:"BROWSERBASE", useAPI:false, apiKey:process.env.BROWSERBASE_API_KEY, projectId,
  modelName: process.env.STAGEHAND_MODEL, modelClientOptions:{apiKey:process.env.OPENAI_API_KEY, baseURL:process.env.OPENAI_BASE_URL}});
const step = async (name, fn) => { try { const v = await fn(); console.log("OK", name); return v; } catch(e){ console.log("FAIL", name, (e?.message||e).toString().slice(0,300)); throw e; } };
try {
  await step("init", ()=>sh.init());
  const page = sh.page;
  await step("initscript", ()=>page.addInitScript(VITALS_INIT));
  await step("goto", ()=>page.goto("https://www.allbirds.com/products/mens-tree-runners",{waitUntil:"domcontentloaded",timeout:45000}));
  await step("vitals", ()=>page.evaluate(VITALS_READ));
  await step("friction", ()=>page.evaluate(FRICTION_SCRIPT));
  await step("shot", ()=>page.screenshot({fullPage:true,type:"jpeg",quality:70}));
  await step("extract", ()=>sh.page.extract("Classify this page: category, product, variant, mini-cart or cart"));
} catch {} finally { await sh.close().catch(()=>{}); }
