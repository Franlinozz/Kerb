// V2-11 dead-button sweep: on every route, in both themes, press every enabled button and check
// that something observable happens (the DOM changes, focus moves into a dialog, the URL changes,
// the clipboard is written or aria state flips). Disabled buttons must say why (title, aria or a
// visible reason nearby). Prints one line per suspect; exit code 1 if any.
import { chromium } from "playwright";
const BASE = process.env.KERB_WEB_URL ?? "https://v2.usekerb.xyz";
const ROUTES = ["/", "/board", "/asset/BRK.Bx", "/credit", "/research", "/research/1", "/methodology", "/proof", "/developers", "/account", "/docs", "/faq", "/whitepaper", "/legal/terms", "/changelog", "/no-such-page"];
const b = await chromium.launch();
const suspects = [];
let pressed = 0;
for (const theme of ["night", "day"]) {
  for (const route of ROUTES) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
    await ctx.addInitScript((t) => localStorage.setItem("kerb-theme", t), theme);
    const p = await ctx.newPage();
    await p.goto(BASE + route, { waitUntil: "networkidle" });
    const n = await p.locator("main button:visible, header button:visible").count();
    for (let i = 0; i < n; i++) {
      await p.goto(BASE + route, { waitUntil: "networkidle" });
      const btn = p.locator("main button:visible, header button:visible").nth(i);
      if (!(await btn.count())) continue;
      const label = ((await btn.getAttribute("aria-label")) ?? (await btn.innerText()).trim()).slice(0, 50) || "(no label)";
      if (await btn.isDisabled()) {
        const why = await btn.evaluate((e) => e.getAttribute("title") || e.getAttribute("aria-describedby") || (/^(Enter an amount|Connect|Nothing)/.test(e.textContent ?? "") ? e.textContent : "") || e.closest("form,section,div")?.querySelector(".fld-error,.t-small")?.textContent || "");
        if (!why) suspects.push(`${theme} ${route}: disabled without a reason: "${label}"`);
        continue;
      }
      const before = await p.evaluate(() => ({ html: document.body.innerHTML.length + ":" + document.querySelectorAll("[aria-expanded=true],[aria-pressed=true],[aria-selected=true],[open]").length, url: location.href, focus: document.activeElement?.outerHTML.slice(0, 80) }));
      // Live clocks change the page by themselves: measure that first, and when the page is noisy
      // count only the stronger signals (URL, focus, aria state, dialogs, clipboard, theme).
      await p.waitForTimeout(400);
      const idle = await p.evaluate(() => document.body.innerHTML.length + ":" + document.querySelectorAll("[aria-expanded=true],[aria-pressed=true],[aria-selected=true],[open]").length);
      const noisy = idle !== before.html;
      before.html = idle;
      await p.evaluate(() => navigator.clipboard.writeText("__before__")).catch(() => {});
      await btn.click({ timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(400);
      pressed++;
      const after = await p.evaluate(async () => ({ html: document.body.innerHTML.length + ":" + document.querySelectorAll("[aria-expanded=true],[aria-pressed=true],[aria-selected=true],[open]").length, url: location.href, focus: document.activeElement?.outerHTML.slice(0, 80), clip: await navigator.clipboard.readText().catch(() => "") }));
      const theme2 = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
      const strong = before.url !== after.url || before.focus !== after.focus || (after.clip && after.clip !== "__before__") || theme2 !== theme || before.html.split(":")[1] !== after.html.split(":")[1];
      const changed = strong || (!noisy && before.html !== after.html) || before.url !== after.url || before.focus !== after.focus || (after.clip && after.clip !== "__before__") || theme2 !== theme;
      if (!changed) suspects.push(`${theme} ${route}: nothing happened on "${label}"`);
    }
    await ctx.close();
  }
}
await b.close();
console.log(`pressed ${pressed} buttons; ${suspects.length} suspects`);
for (const s of suspects) console.log(" -", s);
process.exitCode = suspects.length ? 1 : 0;
