/**
 * The mandatory screenshot loop, AGENTS.md section 6: every page at 390 and 1440, in both themes,
 * shot against the running app so what is captured is what a judge would see.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE = process.env["KERB_WEB_URL"] ?? "http://127.0.0.1:3300";
const OUT = resolve(process.cwd(), "shots");
const WIDTHS = [390, 1440] as const;
const THEMES = ["dark", "light"] as const;

const PAGES: { path: string; name: string }[] = [
  { path: "/", name: "landing" },
  { path: "/board", name: "board" },
  { path: `/asset/${encodeURIComponent(process.env["KERB_SHOT_ASSET"] ?? "KOx")}`, name: "asset" },
  { path: "/market", name: "market" },
  { path: "/methodology", name: "methodology" },
  { path: "/reports/1", name: "report1" },
  { path: "/proof", name: "proof" },
];

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const failures: string[] = [];

  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        deviceScaleFactor: 2,
        colorScheme: theme,
      });
      // Set the stored preference before any page script runs, so the theme is right at first paint.
      await ctx.addInitScript((t: string) => {
        try { window.localStorage.setItem("kerb-theme", t); } catch { /* storage may be blocked */ }
      }, theme);

      const page = await ctx.newPage();
      page.on("pageerror", (e) => failures.push(`${theme}/${width}: page error: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") failures.push(`${theme}/${width}: console: ${m.text()}`);
      });

      for (const p of PAGES) {
        const res = await page.goto(`${BASE}${p.path}`, { waitUntil: "networkidle", timeout: 45_000 });
        if (!res || res.status() >= 400) failures.push(`${p.path} returned ${res?.status() ?? "no response"}`);
        await page.waitForTimeout(450);
        const file = resolve(OUT, `${p.name}-${theme}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`shot ${file}`);
      }
      await ctx.close();
    }
  }

  await browser.close();
  if (failures.length > 0) {
    console.error(`\n${failures.length} problems while shooting:`);
    for (const f of [...new Set(failures)]) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log("\nno page errors, no console errors");
  }
}

void main();
