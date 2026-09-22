// Shoot one page at 1440/768/390, both themes: node scripts/shoot-page.mjs /methodology out-dir
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
const BASE = process.env.KERB_WEB_URL ?? "http://127.0.0.1:3301";
const [path = "/", dir = "page"] = process.argv.slice(2);
const OUT = resolve(process.cwd(), "../../data/screens/v2", dir);
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [w, h] of [[1440, 1000], [768, 1024], [390, 844]]) {
  for (const theme of ["night", "day"]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((t) => localStorage.setItem("kerb-theme", t), theme);
    const p = await ctx.newPage();
    await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); } window.scrollTo(0, 0); });
    await p.waitForTimeout(600);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 0) console.log(`overflow ${over}px at ${w} ${theme}`);
    await p.screenshot({ path: resolve(OUT, `${theme}-${w}.png`), fullPage: true });
    await ctx.close();
  }
}
await b.close();
console.log("done");
