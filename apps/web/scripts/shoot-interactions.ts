/** Shots of the shell's interactive states: drawer, wallet sheet, theme menu, toast, redirects. */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE = process.env["KERB_WEB_URL"] ?? "http://127.0.0.1:3301";
const OUT = resolve(process.cwd(), "../../data/screens/v2/shell");

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  for (const theme of ["night", "day"]) {
    const m = await b.newContext({ viewport: { width: 390, height: 844 } });
    await m.addInitScript((t: string) => localStorage.setItem("kerb-theme", t), theme);
    const p = await m.newPage();
    await p.goto(`${BASE}/board`, { waitUntil: "networkidle" });
    await p.screenshot({ path: resolve(OUT, `header-${theme}-390.png`) });
    await p.click('button[aria-label="Open menu"]');
    await p.waitForTimeout(500);
    await p.screenshot({ path: resolve(OUT, `drawer-${theme}-390.png`) });
    const focused = await p.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent);
    const locked = await p.evaluate(() => document.body.style.overflow);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(300);
    const closed = await p.locator('[role="dialog"]').count();
    console.log(`drawer ${theme}: focus on open=${focused}, scroll lock=${locked}, dialogs after Escape=${closed}`);
    await m.close();

    const d = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await d.addInitScript((t: string) => localStorage.setItem("kerb-theme", t), theme);
    const q = await d.newPage();
    await q.goto(`${BASE}/credit`, { waitUntil: "networkidle" });
    await q.click('button:has-text("Connect")');
    await q.waitForTimeout(400);
    await q.screenshot({ path: resolve(OUT, `wallet-sheet-${theme}-1440.png`) });
    await q.keyboard.press("Escape");
    await q.click('button[aria-haspopup="menu"][aria-label^="Theme"]');
    await q.waitForTimeout(200);
    await q.screenshot({ path: resolve(OUT, `theme-menu-${theme}-1440.png`), clip: { x: 900, y: 0, width: 540, height: 260 } });
    await d.close();
  }
  const r = await b.newContext();
  const x = await r.newPage();
  for (const path of ["/market", "/reports", "/reports/1"]) {
    const resp = await x.request.get(`${BASE}${path}`, { maxRedirects: 0 });
    console.log(`redirect ${path} -> ${resp.status()} ${resp.headers()["location"]}`);
  }
  await b.close();
}
void main();
