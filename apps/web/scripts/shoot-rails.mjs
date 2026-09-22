// Element shots of every SessionRail variant, the Tape and the market clocks (V2-05 checkpoint).
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
const BASE = process.env.KERB_WEB_URL ?? "http://127.0.0.1:3301";
const OUT = resolve(process.cwd(), "../../data/screens/v2/rail");
mkdirSync(OUT, { recursive: true });
const shots = [
  { name: "lanes", path: "/", sel: ".rail-lanes:not(.rail-lanes-compact)" },
  { name: "full", path: "/asset/HKEXCx", sel: ".rail-full" },
  { name: "compact-lanes", path: "/proof", sel: ".rail-lanes-compact" },
  { name: "demo", path: "/credit", sel: ".rail-demo" },
  { name: "tape", path: "/", sel: ".tape" },
];
const b = await chromium.launch();
for (const theme of ["night", "day"]) for (const w of [390, 1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  await ctx.addInitScript((t) => localStorage.setItem("kerb-theme", t), theme);
  const p = await ctx.newPage();
  for (const s of shots) {
    await p.goto(BASE + s.path, { waitUntil: "networkidle" });
    const el = p.locator(s.sel).first();
    await el.scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    // Hover the first regular segment, to show the tooltip on the rails.
    if (s.name !== "tape" && w > 500) await p.locator(`${s.sel} .rail-REGULAR`).first().hover().catch(() => {});
    await p.waitForTimeout(200);
    await el.screenshot({ path: resolve(OUT, `${s.name}-${theme}-${w}.png`) }).catch((e) => console.log("miss", s.name, theme, w, e.message.slice(0, 80)));
  }
  await ctx.close();
}
await b.close();
console.log("ok");
