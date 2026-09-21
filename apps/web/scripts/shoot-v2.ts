/**
 * The V2 screenshot loop (AGENTS.md 12.7): every route at 390, 768 and 1440, Night and Day, against
 * the staging build. Also records console errors, hydration warnings, horizontal overflow and the
 * font each page actually rendered with, so a defect list can be made from facts.
 *
 *   KERB_WEB_URL=http://127.0.0.1:3301 KERB_SHOT_SET=shell tsx scripts/shoot-v2.ts [route-filter]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE = process.env["KERB_WEB_URL"] ?? "http://127.0.0.1:3301";
const SET = process.env["KERB_SHOT_SET"] ?? "shell";
const OUT = resolve(process.cwd(), "../../data/screens/v2", SET);
const WIDTHS = (process.env["KERB_SHOT_WIDTHS"] ?? "390,768,1440").split(",").map(Number);
const THEMES = (process.env["KERB_SHOT_THEMES"] ?? "night,day").split(",");
const FULL = process.env["KERB_SHOT_FULL"] !== "0";
const filter = process.argv[2];

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/board", name: "board" },
  { path: "/asset/KOx", name: "asset" },
  { path: "/credit", name: "credit" },
  { path: "/research", name: "research" },
  { path: "/research/1", name: "research-1" },
  { path: "/methodology", name: "methodology" },
  { path: "/proof", name: "proof" },
  { path: "/developers", name: "developers" },
  { path: "/no-such-page", name: "not-found" },
].filter((r) => !filter || r.name.includes(filter));

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report: Record<string, unknown>[] = [];
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : width < 1000 ? 1024 : 900 }, deviceScaleFactor: 1 });
      await ctx.addInitScript((t: string) => { try { window.localStorage.setItem("kerb-theme", t); } catch { /* blocked */ } }, theme);
      for (const r of ROUTES) {
        const page = await ctx.newPage();
        const errors: string[] = [];
        page.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
        page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
        const res = await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => null);
        await page.waitForTimeout(600);
        const facts = await page.evaluate(() => ({
          appliedTheme: document.documentElement.getAttribute("data-theme"),
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          font: getComputedStyle(document.body).fontFamily.split(",")[0],
          fontReady: document.fonts.check('500 16px "General Sans"') || [...document.fonts].some((f) => f.status === "loaded" && /general/i.test(f.family)),
          h1: document.querySelector("h1")?.textContent?.slice(0, 60) ?? null,
        }));
        const file = resolve(OUT, `${r.name}-${theme}-${width}.png`);
        await page.screenshot({ path: file, fullPage: FULL });
        report.push({ route: r.path, theme, width, status: res?.status() ?? 0, ...facts, errors });
        await page.close();
      }
      await ctx.close();
    }
  }
  await browser.close();
  writeFileSync(resolve(OUT, "report.json"), JSON.stringify(report, null, 1));
  for (const x of report) {
    const bad = (x["status"] !== 200 && x["route"] !== "/no-such-page") || (x["overflowX"] as number) > 0 || (x["errors"] as string[]).length > 0;
    console.log(`${bad ? "!!" : "ok"} ${String(x["route"]).padEnd(14)} ${x["theme"]}/${x["width"]} status=${x["status"]} applied=${x["appliedTheme"]} overflowX=${x["overflowX"]} font=${x["font"]} ready=${x["fontReady"]} ${(x["errors"] as string[]).join(" | ").slice(0, 160)}`);
  }
}

void main();
