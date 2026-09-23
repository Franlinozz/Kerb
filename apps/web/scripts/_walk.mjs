import { chromium } from "playwright";
const BASE = "https://www.usekerb.xyz", OUT = "/root/kerb/data/screens/v3/audit";
const routes = ["/", "/board", "/asset/HKEXCx", "/credit", "/account", "/research", "/research/1", "/methodology", "/proof", "/developers", "/docs", "/changelog", "/nope"];
const b = await chromium.launch();
const errors = [];
for (const [theme, w, h] of [["night", 1440, 900], ["day", 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((t) => localStorage.setItem("kerb-theme", t), theme);
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(`${theme} ${p.url()}: ${m.text().slice(0, 160)}`); });
  p.on("pageerror", (e) => errors.push(`${theme} ${p.url()} PAGEERROR ${e.message.slice(0, 160)}`));
  for (const r of routes) {
    const t0 = Date.now();
    const res = await p.goto(BASE + r, { waitUntil: "networkidle" }).catch((e) => ({ status: () => "ERR " + e.message.slice(0, 40) }));
    await p.waitForTimeout(1500);
    // scroll through so reveal animations fire, then back to top
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } window.scrollTo(0, 0); });
    await p.waitForTimeout(700);
    const name = r === "/" ? "home" : r.slice(1).replace(/\//g, "_");
    await p.screenshot({ path: `${OUT}/${name}-${theme}-${w}.png`, fullPage: true });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    console.log(`${theme} ${w} ${r} ${typeof res?.status === "function" ? res.status() : "?"} ${Date.now() - t0}ms${overflow ? " HORIZONTAL-OVERFLOW" : ""}`);
  }
  await ctx.close();
}
console.log("console errors:", errors.length); for (const e of errors.slice(0, 30)) console.log(" ", e);
await b.close();
