// Shoot /art-review at the four review sizes, both themes (plain JS: see probe-wallet-reject.mjs).
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
const BASE = process.env.KERB_WEB_URL ?? "http://127.0.0.1:3301";
const OUT = resolve(process.cwd(), "../../data/screens/v2/art-review");
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [w, h] of [[1440, 1000], [1280, 800], [768, 1024], [390, 844]]) {
  for (const theme of ["night", "day"]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((t) => localStorage.setItem("kerb-theme", t), theme);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/art-review`, { waitUntil: "networkidle" });
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await p.waitForTimeout(800);
    await p.screenshot({ path: resolve(OUT, `review-${theme}-${w}.png`), fullPage: true });
    await ctx.close();
  }
}
await b.close();
console.log("done");
