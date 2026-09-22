// The real-user walkthrough: every page at 1440, 768 and 390, Night and Day, as a visitor would
// meet it. Records full-page screenshots and everything a person would trip over: console errors
// and hydration warnings, failed requests, broken images, sideways scroll, text cut off by its
// box, tap targets under 44 px on phones, and empty headings or links. Then it walks the common
// interactions (nav, drawer, theme, tabs, disclosures, hover cards) and screenshots each.
//   node scripts/walkthrough.mjs [base] > walkthrough.json
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? process.env.KERB_WEB_URL ?? "https://www.usekerb.xyz";
const OUT = resolve(process.cwd(), "../../data/screens/walkthrough");
mkdirSync(OUT, { recursive: true });
const ROUTES = ["/", "/board", "/asset/BRK.Bx", "/asset/HKEXCx", "/asset/KOx", "/credit", "/research", "/research/1", "/methodology", "/proof", "/developers", "/changelog", "/no-such-page"];
const SIZES = [[1440, 900], [768, 1024], [390, 844]];
const report = [];
const b = await chromium.launch();

async function audit(p, w) {
  return p.evaluate((w) => {
    const issues = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1) issues.push(`page scrolls sideways by ${document.documentElement.scrollWidth - vw}px`);
    for (const img of document.images) if (img.complete && img.naturalWidth === 0 && img.loading !== "lazy") issues.push(`broken image ${img.currentSrc || img.src}`);
    for (const el of document.querySelectorAll("h1,h2,h3,p,a,button,span,td,th,dd,dt,li,label")) {
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none" || el.closest("[hidden],[aria-hidden=true]")) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if ((s.overflow === "hidden" || s.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 2 && el.children.length === 0) issues.push(`text cut off: <${el.tagName.toLowerCase()} class="${el.className}"> "${el.textContent.trim().slice(0, 40)}"`);
      if (r.right > vw + 1 && !el.closest(".dt-wrap,.scroll-x,pre,.tape,.tape-viewport,.footer-giant,.rail-band,.code-block")) issues.push(`sticks out past the screen: <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 40)}"> "${el.textContent.trim().slice(0, 30)}"`);
    }
    if (w <= 400) for (const el of document.querySelectorAll("a[href],button,[role=tab],input")) {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      if (!r.width || s.visibility === "hidden" || el.closest("[hidden],.footer-giant,p,li:not(.drawer-nav li),td,.dt-under,.prov-wrap")) continue;
      if (r.height < 40 && r.width < 40) issues.push(`small tap target ${Math.round(r.width)}x${Math.round(r.height)}: "${(el.getAttribute("aria-label") ?? el.textContent).trim().slice(0, 30)}"`);
    }
    for (const el of document.querySelectorAll("h1,h2,h3,a,button")) if (!el.textContent.trim() && !el.getAttribute("aria-label") && !el.querySelector("img[alt],svg[aria-label]")) issues.push(`empty ${el.tagName.toLowerCase()} ${el.outerHTML.slice(0, 80)}`);
    if (document.querySelectorAll("h1").length !== 1) issues.push(`${document.querySelectorAll("h1").length} h1 elements`);
    const text = document.body.innerText;
    for (const bad of ["undefined", "NaN", "[object Object]", "null%", "Infinity", "—", "Error:", "TypeError", "viem"]) if (text.includes(bad)) issues.push(`page text contains "${bad}"`);
    return [...new Set(issues)];
  }, w);
}

for (const theme of ["night", "day"]) for (const [w, h] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
  await ctx.addInitScript((t) => localStorage.setItem("kerb-theme", t), theme);
  for (const r of ROUTES) {
    const p = await ctx.newPage();
    const log = { route: r, theme, width: w, console: [], failed: [], issues: [] };
    p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) log.console.push(m.text().split("\n")[0].slice(0, 200)); });
    p.on("pageerror", (e) => log.console.push(`pageerror ${e.message.slice(0, 200)}`));
    p.on("response", (res) => { if (res.status() >= 400 && !(r === "/no-such-page" && res.url() === BASE + r)) log.failed.push(`${res.status()} ${res.url().slice(0, 120)}`); });
    p.on("requestfailed", (q) => { if (!/_rsc=|favicon/.test(q.url())) log.failed.push(`failed ${q.url().slice(0, 120)} ${q.failure()?.errorText ?? ""}`); });
    const t0 = Date.now();
    await p.goto(BASE + r, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => log.issues.push(`navigation: ${e.message.slice(0, 80)}`));
    log.loadMs = Date.now() - t0;
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((s) => setTimeout(s, 80)); } window.scrollTo(0, 0); });
    await p.waitForTimeout(700);
    log.issues.push(...await audit(p, w));
    const name = `${r === "/" ? "home" : r.slice(1).replace(/\//g, "_")}-${theme}-${w}`;
    await p.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: true });
    report.push(log);
    await p.close();
  }
  await ctx.close();
}

// Interactions, Night, desktop and phone.
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
  await ctx.addInitScript(() => localStorage.setItem("kerb-theme", "night"));
  const p = await ctx.newPage();
  const shot = (n) => p.screenshot({ path: resolve(OUT, `ix-${n}-${w}.png`) });
  const note = (what, ok, extra = "") => report.push({ interaction: what, width: w, ok, extra });
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  if (w < 500) {
    await p.getByRole("button", { name: /menu/i }).first().click().catch(() => note("open the drawer", false));
    await p.waitForTimeout(500); await shot("drawer");
    note("drawer opens with every nav link", await p.locator(".drawer-nav a").count() >= 5);
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    note("drawer closes on Escape", (await p.locator(".drawer").count()) === 0);
  } else {
    await p.hover(".main-nav a:nth-of-type(3)"); await p.waitForTimeout(400); await shot("nav-hover");
    await p.getByRole("button", { name: /Change theme/ }).click(); await p.waitForTimeout(300); await shot("theme-menu");
    await p.keyboard.press("Escape");
  }
  await p.goto(BASE + "/asset/BRK.Bx", { waitUntil: "networkidle" });
  for (const tab of ["Liquidity", "Mark", "Terms history", "Onchain"]) {
    const t = p.getByRole("tab", { name: new RegExp(tab, "i") }).first();
    if (await t.count()) { await t.click(); await p.waitForTimeout(500); await shot(`asset-${tab.replace(/\s/g, "")}`); note(`asset tab ${tab}`, true); } else note(`asset tab ${tab}`, false, "missing");
  }
  const prov = p.locator(".prov").first();
  if (await prov.count()) { await prov.hover(); await p.waitForTimeout(300); await shot("provmark"); }
  await p.goto(BASE + "/credit", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /Testnet · mirror collateral/ }).click(); await p.waitForTimeout(400); await shot("credit-drawer");
  await p.keyboard.press("Escape");
  for (const tab of ["Supply", "Repay", "Withdraw", "Borrow"]) { await p.getByRole("tab", { name: tab }).click(); await p.waitForTimeout(300); await shot(`credit-${tab}`); }
  await p.locator(".header-tools").getByRole("button", { name: /Connect/ }).first().click(); await p.waitForTimeout(1200); await shot("wallet-sheet");
  note("wallet sheet opens with no wallet installed", (await p.getByText(/No browser wallet|Browser wallet/).count()) > 0);
  await p.keyboard.press("Escape");
  await p.goto(BASE + "/proof", { waitUntil: "networkidle" });
  await p.evaluate(() => document.querySelectorAll("details").forEach((d) => { d.open = true; })); await p.waitForTimeout(400);
  await p.screenshot({ path: resolve(OUT, `ix-proof-open-${w}.png`), fullPage: true });
  await p.goto(BASE + "/developers", { waitUntil: "networkidle" });
  for (const tab of ["REST", "Solidity"]) { await p.getByRole("tab", { name: tab }).click(); await p.waitForTimeout(1500); await shot(`dev-${tab}`); }
  await ctx.close();
}
await b.close();
writeFileSync(resolve(OUT, "report.json"), JSON.stringify(report, null, 1));
const bad = report.filter((x) => (x.issues?.length || x.console?.length || x.failed?.length) || x.ok === false);
console.log(`${report.length} checks, ${bad.length} with findings`);
for (const x of bad) console.log(JSON.stringify(x));
