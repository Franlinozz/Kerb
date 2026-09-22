// Shoot each Asset tab panel (V2-07 checkpoint).
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
const BASE = process.env.KERB_WEB_URL ?? "http://127.0.0.1:3301";
const OUT = resolve(process.cwd(), "../../data/screens/v2/board-asset");
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const theme of ["night", "day"]) for (const w of [390, 1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  await ctx.addInitScript((t) => localStorage.setItem("kerb-theme", t), theme);
  const p = await ctx.newPage();
  for (const sym of ["COINx", "HKEXCx"]) for (const tab of ["liquidity", "mark", "history", "onchain"]) {
    await p.goto(`${BASE}/asset/${sym}#${tab}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(300);
    await p.locator(`#panel-${tab}`).screenshot({ path: resolve(OUT, `tab-${sym}-${tab}-${theme}-${w}.png`) });
  }
  await ctx.close();
}
await b.close(); console.log("ok");
