import { Stagehand, AISdkClient } from "@browserbasehq/stagehand";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
const r = await fetch("https://api.browserbase.com/v1/projects",{headers:{"X-BB-API-Key":process.env.BROWSERBASE_API_KEY}});
const projectId = (await r.json())[0].id;
const provider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL, compatibility: "compatible" });
const sh = new Stagehand({ env:"BROWSERBASE", useAPI:false, apiKey:process.env.BROWSERBASE_API_KEY, projectId,
  llmClient: new AISdkClient({ model: provider(process.env.STAGEHAND_MODEL) }) });
try {
  await sh.init();
  await sh.page.goto("https://www.allbirds.com/products/mens-tree-runners",{waitUntil:"domcontentloaded",timeout:45000});
  const out = await sh.page.extract({ instruction:"Classify this page as one of: category, product, variant, mini-cart, cart", schema: z.object({ kind: z.enum(["category","product","variant","mini-cart","cart"]) }) });
  console.log("EXTRACT", JSON.stringify(out));
  await sh.page.act("click the add to cart button");
  console.log("ACT ok", sh.page.url());
} catch(e){ console.log("ERR", (e?.message||String(e)).slice(0,400)); }
finally { await sh.close().catch(()=>{}); }
