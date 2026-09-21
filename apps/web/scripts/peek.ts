/** Read back what the cure panel actually says after a click, without a wallet. */
import { chromium } from "playwright";
const BASE = process.env["KERB_WEB_URL"] ?? "https://usekerb.xyz";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } } as never);
const errors: string[] = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("requestfailed", (r) => errors.push(`FAILED ${r.url()} ${r.failure()?.errorText ?? ""}`));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.goto(`${BASE}/market`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);
console.log("problem responses / console errors:");
for (const e of [...new Set(errors)]) console.log("  " + e.slice(0, 160));
await browser.close();
