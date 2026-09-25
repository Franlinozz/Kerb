#!/usr/bin/env node
/**
 * Builds the Kerb whitepaper PDF (A4): a designed print document, not a screenshot of the web page.
 *
 *   node scripts/whitepaper/build.mjs            (run from apps/web so playwright resolves)
 *
 * Live figures and parameters are read from the public API at build time and dated on the page.
 * Writes apps/web/public/kerb-whitepaper.pdf and docs/release/kerb-whitepaper.pdf.
 */
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(ROOT, "apps/web/package.json"));
const { chromium } = require("playwright");
const API = "https://api.usekerb.xyz";

const brand = readFileSync(resolve(ROOT, "apps/web/src/lib/brand.ts"), "utf8");
const pick = (name) => brand.match(new RegExp(`${name} = "([^"]+)"`))[1];
const MARK_UP = pick("MARK_UPPER"), MARK_LO = pick("MARK_LOWER"), WORD = pick("WORDMARK_PATH");
const mark = (fill, lo = 0.55, h = 18) => `<svg viewBox="0 0 854 413" height="${h}" width="${Math.round((h * 854) / 413)}"><path d="${MARK_UP}" fill="${fill}"/><path d="${MARK_LO}" fill="${fill}" fill-opacity="${lo}"/></svg>`;
const word = (fill, h = 14) => `<svg viewBox="0 0 2772 420" height="${h}" width="${Math.round((h * 2772) / 420)}"><path d="${WORD}" fill="${fill}" fill-rule="evenodd"/></svg>`;
const dataUri = (p, type) => `data:${type};base64,${readFileSync(resolve(ROOT, p)).toString("base64")}`;

const get = async (p) => { try { const r = await fetch(API + p); return r.ok ? await r.json() : null; } catch { return null; } };
const [stats, proof, params, agents, report2] = await Promise.all([get("/v1/stats"), get("/v1/proof"), get("/v1/params"), get("/v1/agents/stats"), get("/v1/market-time/2")]);
const group = (n) => (n === null || n === undefined ? "n/a" : Number(n).toLocaleString("en-US"));
const pct = (x) => (x === undefined ? "n/a" : `${(Number(x) * 100).toFixed(0)}%`);
const posts196 = stats?.postsByChain?.find((p) => p.chainId === 196)?.count ?? null;
const c = params?.capacityDefaults ?? {}, a = params?.asymmetry ?? {};
const deployments = proof?.onchain?.deployments?.length ?? 34;
const settled = agents?.paidCalls?.find((p) => p.network === "eip155:196")?.count ?? 1;
const asOf = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
const tests = JSON.parse(readFileSync(resolve(ROOT, "data/test-report.json"), "utf8"));
const later = (report2?.campaign?.rows ?? []).filter((r) => r.c1LaterChangePct != null);
const fell10 = later.filter((r) => Number(r.c1LaterChangePct) <= -10).length;
const worst = [...later].sort((x, y) => Number(x.c1LaterChangePct) - Number(y.c1LaterChangePct))[0];

const archSvg = readFileSync(resolve(ROOT, "docs/media/architecture-light.svg"), "utf8").replace(/<svg ([^>]*)width="1600" height="1010"/, '<svg $1width="100%"');
const cover = dataUri("scripts/whitepaper/art/cover.jpg", "image/jpeg");
const back = dataUri("scripts/whitepaper/art/back.jpg", "image/jpeg");

const INK = "#16170F", BONE = "#ECE8DE", BRASS = "#A7771E", NIGHT = "#0B0C0A";

const pipeline = `<svg viewBox="0 0 860 200" width="100%" role="img" aria-label="Pipeline">
  <defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="${BRASS}"/></marker></defs>
  ${[["Clock", "market calendars"], ["Depth", "tick-walk C(1%)"], ["Mark", "conservative price"], ["Terms", "KTS 0.2, signed"]].map(([t, s], i) => `
  <g transform="translate(${i * 148},66)"><rect width="124" height="62" rx="4" fill="#fff" stroke="#CFC9BA"/>
  <text x="62" y="28" text-anchor="middle" font-size="16" font-weight="600" fill="${INK}">${t}</text>
  <text x="62" y="47" text-anchor="middle" font-size="11.5" fill="#6A685F">${s}</text>
  ${i < 3 ? `<path d="M124 31H146" stroke="${BRASS}" stroke-width="1.6" marker-end="url(#ah)"/>` : ""}</g>`).join("")}
  <path d="M568 97H606" stroke="${BRASS}" stroke-width="1.6"/>
  ${["Kerb Credit", "KerbQuote and feeds", "Agents (x402, MCP)", "REST and kerb-sdk"].map((t, i) => `
  <path d="M606 97C620 97 620 ${24 + i * 50} 634 ${24 + i * 50}" fill="none" stroke="${BRASS}" stroke-width="1.6" marker-end="url(#ah)"/>
  <g transform="translate(640,${4 + i * 50})"><rect width="210" height="40" rx="4" fill="${NIGHT}"/><text x="105" y="25" text-anchor="middle" font-size="13.5" fill="${BONE}">${t}</text></g>`).join("")}
</svg>`;

const css = `
@page { size: A4; margin: 22mm 20mm 20mm 20mm; }
@page cover { margin: 0; }
@page wide { size: A4 landscape; margin: 16mm 16mm 16mm 16mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Inter, "Helvetica Neue", Arial, sans-serif; font-size: 10.4pt; line-height: 1.55; color: ${INK}; }
.serif { font-family: "Instrument Serif", Georgia, serif; font-weight: 400; }
.mono, code { font-family: "IBM Plex Mono", ui-monospace, monospace; }
.label { font-family: "IBM Plex Mono", monospace; font-size: 7.6pt; letter-spacing: 0.16em; text-transform: uppercase; color: #7B786E; }
.cover { page: cover; position: relative; width: 210mm; height: 297mm; background: ${NIGHT}; color: ${BONE}; overflow: hidden; break-after: page; }
.cover .art { position: absolute; inset: 0 0 auto 0; height: 190mm; background: url(${cover}) 72% center/cover no-repeat; }
.cover .art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(11,12,10,0.1) 0%, rgba(11,12,10,0.35) 55%, ${NIGHT} 100%); }
.cover .top { position: absolute; top: 16mm; left: 18mm; right: 18mm; display: flex; justify-content: space-between; align-items: center; }
.cover .top .label { color: #B9B4A7; }
.cover .brand { display: flex; align-items: center; gap: 10px; }
.cover .body { position: absolute; left: 18mm; right: 18mm; bottom: 26mm; }
.cover h1 { font-family: "Instrument Serif", Georgia, serif; font-weight: 400; font-size: 50pt; line-height: 1.02; letter-spacing: -0.01em; margin: 0 0 8mm; }
.cover h1 em { font-style: normal; color: #D6A64F; }
.cover .sub { font-size: 13pt; color: #CFCABD; max-width: 140mm; margin: 0 0 14mm; }
.cover .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6mm; border-top: 1px solid #2B2E27; padding-top: 6mm; }
.cover .meta b { display: block; font-weight: 500; font-size: 9.5pt; color: ${BONE}; margin-top: 2px; }
.cover .rule { position: absolute; left: 18mm; right: 18mm; bottom: 14mm; display: flex; justify-content: space-between; font-size: 8pt; color: #8B877B; }
section { break-inside: auto; }
h2 { break-inside: avoid; font-family: "Instrument Serif", Georgia, serif; font-weight: 400; font-size: 23pt; line-height: 1.1; margin: 0 0 4mm; break-after: avoid; }
h2 .n { color: ${BRASS}; font-family: "IBM Plex Mono", monospace; font-size: 10pt; letter-spacing: 0.1em; display: block; margin-bottom: 2mm; }
h3 { font-size: 11pt; margin: 5mm 0 1.5mm; break-after: avoid; }
p { margin: 0 0 3mm; }
.chapter { break-before: page; }
.lede { font-size: 12.2pt; line-height: 1.5; color: #2E2F27; }
.abstract { border-left: 2px solid ${BRASS}; padding: 1mm 0 1mm 6mm; margin: 4mm 0 8mm; }
.figs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid #DAD5C8; border-radius: 3px; margin: 6mm 0 2mm; }
.figs div { padding: 4mm; border-right: 1px solid #DAD5C8; }
.figs div:last-child { border-right: 0; }
.figs b { display: block; font-family: "Instrument Serif", Georgia, serif; font-weight: 400; font-size: 21pt; line-height: 1.1; margin-top: 2mm; }
.small { font-size: 8.4pt; color: #7B786E; }
.toc { margin-top: 10mm; columns: 2; column-gap: 12mm; }
.toc div { display: flex; gap: 4mm; padding: 2.2mm 0; border-bottom: 1px solid #E6E1D5; break-inside: avoid; font-size: 10pt; }
.toc span { font-family: "IBM Plex Mono", monospace; color: ${BRASS}; width: 8mm; }
.quote { font-family: "Instrument Serif", Georgia, serif; font-size: 22pt; line-height: 1.2; margin: 6mm 0; padding: 6mm 8mm; background: ${NIGHT}; color: ${BONE}; border-radius: 3px; }
.quote small { display: block; font-family: "IBM Plex Mono", monospace; font-size: 7.5pt; letter-spacing: 0.16em; text-transform: uppercase; color: #D6A64F; margin-top: 3mm; }
.formula { font-family: "IBM Plex Mono", monospace; font-size: 9.2pt; line-height: 1.7; white-space: pre; background: #F4F1EA; border: 1px solid #DAD5C8; border-left: 3px solid ${BRASS}; border-radius: 3px; padding: 4mm 5mm; margin: 4mm 0; }
table { width: 100%; border-collapse: collapse; margin: 4mm 0 5mm; font-size: 9.2pt; break-inside: avoid; }
th { text-align: left; font-family: "IBM Plex Mono", monospace; font-size: 7.4pt; letter-spacing: 0.12em; text-transform: uppercase; color: #7B786E; font-weight: 500; border-bottom: 1.2px solid ${INK}; padding: 2mm 2.5mm; }
td { border-bottom: 1px solid #E6E1D5; padding: 2.2mm 2.5mm; vertical-align: top; }
td.num { text-align: right; font-family: "IBM Plex Mono", monospace; white-space: nowrap; }
figure { margin: 5mm 0; break-inside: avoid; }
figcaption { font-size: 8.4pt; color: #7B786E; margin-top: 2mm; }
.callout { background: #F4F1EA; border-radius: 3px; padding: 4mm 5mm; margin: 4mm 0; break-inside: avoid; }
.callout .label { color: ${BRASS}; display: block; margin-bottom: 1.5mm; }
ul, ol { margin: 0 0 3mm; padding-left: 5mm; } li { margin-bottom: 1.4mm; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
.wide { break-before: page; break-after: page; height: 250mm; position: relative; }
.wide .rot { position: absolute; top: 0; left: 170mm; width: 250mm; transform-origin: top left; transform: rotate(90deg); }
.wide h2 { font-size: 18pt; }
a { color: inherit; text-decoration: none; border-bottom: 1px solid #CFC9BA; }
.backcover { page: cover; break-before: page; position: relative; width: 210mm; height: 297mm; background: ${NIGHT}; color: ${BONE}; overflow: hidden; }
.backcover .art { position: absolute; inset: auto 0 0 0; height: 150mm; background: url(${back}) center/cover no-repeat; opacity: 0.9; }
.backcover .art::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, ${NIGHT} 0%, rgba(11,12,10,0.15) 40%, rgba(11,12,10,0.35) 75%, rgba(11,12,10,0.92) 100%); z-index: 1; }
.backcover .body { position: absolute; top: 30mm; left: 18mm; right: 18mm; z-index: 2; }
.backcover .links { display: grid; grid-template-columns: auto 1fr; gap: 2mm 8mm; font-size: 10pt; margin-top: 10mm; }
.backcover .links span { color: #8B877B; font-family: "IBM Plex Mono", monospace; font-size: 8pt; letter-spacing: 0.12em; text-transform: uppercase; padding-top: 1px; }
.backcover a { border: 0; color: ${BONE}; }
.backcover .fine { position: absolute; left: 18mm; right: 18mm; bottom: 14mm; z-index: 2; font-size: 7.8pt; color: #B9B4A7; }
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Kerb whitepaper</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif&family=IBM+Plex+Mono:wght@400;500&display=block" rel="stylesheet">
<style>${css}</style></head><body>

<div class="cover" id="cover">
  <div class="art"></div>
  <div class="top"><div class="brand">${mark(BONE, 0.6, 22)}${word(BONE, 15)}</div><span class="label">Whitepaper · v1.1</span></div>
  <div class="body">
    <span class="label" style="color:#D6A64F">The market-time risk layer for tokenized stocks on X Layer</span>
    <h1 style="margin-top:5mm">Credit on the<br><em>market&rsquo;s clock.</em></h1>
    <p class="sub">Measure the exit that is really there, and how long a loan must survive before the next deep market. Post both as signed terms on X Layer. Let anyone recompute them.</p>
    <div class="meta">
      <div><span class="label">Version</span><b>1.1 · 25 September 2026</b></div>
      <div><span class="label">Standard</span><b>KTS 0.2 · params ${params?.paramsVersion ?? "n/a"}</b></div>
      <div><span class="label">Authors</span><b>Xyndicate Labs</b></div>
      <div><span class="label">Built for</span><b>OKX Dev Day 2026</b></div>
    </div>
  </div>
  <div class="rule"><span>usekerb.xyz</span><span>github.com/Franlinozz/Kerb</span><span>api.usekerb.xyz</span></div>
</div>

<section>
  <span class="label">Abstract</span>
  <div class="abstract"><p class="lede">Tokenized stocks trade around the clock; the markets behind them do not. When New York or Hong Kong is shut, no new reference price arrives and the onchain pool becomes the only exit. A lender that sizes credit against a price rather than against that exit lends more than it could liquidate at exactly the moments it would need to. Kerb measures the exit that is really there in X Layer pools, and how long a loan must survive before the next deep market, and publishes both as signed credit terms on X Layer mainnet every few minutes. Every term recomputes from its published inputs. A reference credit market, any contract, any agent and any developer read the same terms.</p></div>
  <div class="figs">
    <div><span class="label">Terms posted on mainnet</span><b>${group(posts196)}</b></div>
    <div><span class="label">Pool readings stored</span><b>${group(stats?.obsPoolRows)}</b></div>
    <div><span class="label">Assets · markets</span><b>${stats?.assets ?? 10} · ${stats?.markets ?? 4}</b></div>
    <div><span class="label">Contracts, Sourcify exact</span><b>${deployments}</b></div>
  </div>
  <p class="small">Live figures read from api.usekerb.xyz at ${asOf}. usekerb.xyz/proof checks them on every load.</p>
  <div class="toc">
    ${["The problem", "Design", "Measurement", "The standard (KTS 0.2)", "A worked example", "The covenant", "Attestation and guardrails", "System architecture", "Consumers", "Evidence from the live system", "Limits", "What comes next", "References"].map((t, i) => `<div><span>${String(i + 1).padStart(2, "0")}</span>${t}</div>`).join("")}
  </div>
</section>

<section class="chapter">
  <h2><span class="n">01</span>The problem</h2>
  <p class="lede">Three clocks run under every tokenized stock.</p>
  <p>The exchange keeps its own calendar, with lunch breaks, holidays and early closes. Reference prices follow that calendar. Onchain liquidity follows neither: it moves with liquidity providers, incentives and the hour. Kerb&rsquo;s first Market-Time Report measured 35,130 readings over one closed weekend on X Layer: seven of ten asset pools lost in-range liquidity, the largest by 49%.</p>
  <p>A collateral value that ignores this is precise and wrong. The questions a lender must answer are whether the collateral could be sold, and how long the loan must hold before it could.</p>

  <h2 style="margin-top:9mm"><span class="n">02</span>Design</h2>
  <div class="quote">Never lend more than you can liquidate.<small>The design principle</small></div>
  <p>Every choice follows from that sentence: measure the exit rather than assume it; tie each loan&rsquo;s margin to the horizon it must survive; never move the liquidation line under an open loan; let anyone check every number; keep models out of anything that produces a number.</p>
  <figure>${pipeline}<figcaption>Figure 1. Four layers turn measurements into terms on X Layer mainnet; four kinds of consumer read the same terms.</figcaption></figure>
</section>

<section class="chapter">
  <h2><span class="n">03</span>Measurement</h2>
  <h3>3.1 Clock</h3><p>Each asset follows its underlying market&rsquo;s calendar (NYSE, Nasdaq, NYSE Arca, HKEX with its lunch break), resolved identically off chain and on chain in KerbClock; a 1,000-timestamp fuzz test holds the two in agreement. A regime machine names the state of each asset in a strict order: Halted, Stale, Corporate action, Reference closed, Pre-transition, Recovery, Thin, Normal, Deep. The first rule that holds wins.</p>
  <h3>3.2 Depth</h3><p>Every minute the collector reads each pool&rsquo;s price, in-range liquidity and initialised ticks. The engine walks the Uniswap V3 pool tick by tick in the direction of a sale and finds C(i), the largest sale that moves the price at most i. C(1%) is cross-checked against the OKX DEX aggregator at the same notionals; when the two differ by more than 25%, the smaller is used.</p>
  <h3>3.3 Mark</h3><p>The Credit Mark is the lower of the reference median and the pool price along the whole path to the loan asset, less a haircut set by the regime. If the sources disagree by more than 2%, the regime becomes Stale and new borrowing stops. The Mark is conservative by construction; it is not a mid-market price.</p>

  <h2 style="margin-top:9mm"><span class="n">04</span>The standard (KTS 0.2)</h2>
  <p>The Kerb Terms Standard turns measurements into two loan-to-value limits and two debt limits. Each mode&rsquo;s margin below the fixed liquidation threshold LT is tied to the horizon it must survive:</p>
  <div class="formula">carryMargin     = max(floorCarry,   k · v · g(H_next_deep) + s)
sessionMargin   = max(floorSession, k · v · g(H_cure)      + s)
carryLTV        = LT − carryMargin
sessionMaxLTV   = LT − sessionMargin
debtCeiling     = kCeiling · C(1%)
maxPositionDebt = min(capAbs, capShare · C(1%))</div>
  <p>g(H) is the 99th-percentile price gap over a horizon of H hours from five years of daily closes; v is a recent-volatility scaler; s is the measured exit cost at the reference liquidation size. Before a long closure, Carry tightens because its horizon grows, while Session Max, which only has to reach the next Last Call, does not.</p>
  <table><thead><tr><th>Parameter</th><th>Live value</th><th>Meaning</th></tr></thead><tbody>
    <tr><td>k</td><td class="num">${c.stressMultiplier ?? "n/a"}</td><td>Stress multiplier on the horizon gap</td></tr>
    <tr><td>floorCarry, floorSession</td><td class="num">${pct(c.minCarryMargin)}, ${pct(c.minSessionMargin)}</td><td>Smallest margin each mode may keep</td></tr>
    <tr><td>kCeiling</td><td class="num">${c.k ?? "n/a"}</td><td>Debt ceiling as a multiple of C(1%)</td></tr>
    <tr><td>capAbs, capShare</td><td class="num">$${group(c.positionCapAbs)}, ${pct(c.positionCapShare)}</td><td>Largest single position</td></tr>
    <tr><td>Reference liquidation size</td><td class="num">$${group(c.referenceLiquidationSize)}</td><td>Size at which exit cost s is measured</td></tr>
    <tr><td>Loosen step, cooldown</td><td class="num">${pct(a.maxLoosenStep)}, ${Number(a.recoveryCooldownSec) / 60} min</td><td>How fast terms may loosen</td></tr>
  </tbody></table>
</section>

<section>
  <h2 style="margin-top:9mm"><span class="n">05</span>A worked example</h2>
  <p>At the New York close on 21 September 2026 the horizon KOx&rsquo;s Carry must survive grew from 17 h 31 m to 41 h 26 m, spanning the night and the next session&rsquo;s gap. The stressed gap over that horizon rose from 3.63% to 5.41%.</p>
  <table><thead><tr><th>KOx</th><th style="text-align:right">Before 20:00 UTC</th><th style="text-align:right">After</th><th>Cause</th></tr></thead><tbody>
    <tr><td>Carry</td><td class="num">55.60%</td><td class="num">51.57%</td><td>Horizon −4.11 pts, loosening cap +0.08, exit cost 0.00</td></tr>
    <tr><td>Session Max</td><td class="num">61.20%</td><td class="num">54.47%</td><td>Margin left its floor as the cure horizon grew</td></tr>
  </tbody></table>
  <p>The causes sum to the posted move exactly. Across 2,186 attributed changes in the record, the unexplained residual is zero. Every asset page shows its own changes with their causes.</p>

  <h2 style="margin-top:9mm"><span class="n">06</span>The covenant</h2>
  <p>A Carry loan needs no attention. A Session Max loan borrows more now and accepts a covenant: when Last Call opens, before the market weakens, the position must come back to its Carry target. If the owner does not act, anyone may cure it, repaying only the difference for a small bonus in collateral, while liquidity is still there.</p>
  <div class="callout"><span class="label">The rule that never bends</span>The liquidation line never moves. Sessions move only how much may be borrowed and when a cure is due.</div>

  <h2 style="margin-top:9mm"><span class="n">07</span>Attestation and guardrails</h2>
  <p>The attester signs each report (EIP-712) and posts it to KerbTerms with the keccak256 of its complete input bundle; every Kerb transaction carries the ERC-8021 Builder Code <span class="mono">kt0hl6xyhlx8xmt</span>. KerbTerms enforces what the attester cannot change: bounded LTVs, a fixed liquidation line per asset, tightening at once and loosening in steps after a cooldown, and a maximum report age after which terms are unusable. The attester may clamp tighter than the engine, never looser.</p>
  <div class="formula"># no account, no key, no database
git clone https://github.com/Franlinozz/Kerb &amp;&amp; cd Kerb &amp;&amp; pnpm install
pnpm --filter @kerb/engine kerb verify &lt;inputsHash&gt;</div>
  <p class="small">The verifier fetches the bundle, rejects any bytes that do not hash to the onchain inputsHash, recomputes every figure and compares them with the values KerbTerms holds on X Layer.</p>
</section>

<section class="wide"><div class="rot">
  <h2><span class="n">08</span>System architecture</h2>
  <figure style="margin:2mm 0 0">${archSvg}<figcaption>Figure 2. Sources, off-chain measurement and computation, posts on X Layer, and the consumers that read them. Dashed lines carry data; brass lines are signed posts on chain.</figcaption></figure>
</div></section>

<section class="chapter">
  <h2><span class="n">09</span>Consumers</h2>
  <table><thead><tr><th>Consumer</th><th>How it reads Kerb Terms</th><th>Where</th></tr></thead><tbody>
    <tr><td>Kerb Credit</td><td>Carry or Session Max, Last Call, a public cure table, a standing demo position every cycle</td><td>X Layer testnet</td></tr>
    <tr><td>Contracts</td><td>KerbQuote: max borrow, cure deadline and usability in one view call. KerbMarkFeed: the Credit Mark as a Chainlink-shaped feed that fails closed</td><td>X Layer mainnet</td></tr>
    <tr><td>Agents</td><td>Kerb Credit Check and Exit Check, one cent in USDT0 per call over x402 through the OKX facilitator; a free MCP server; registered on OKX.AI (agent #13887)</td><td>X Layer mainnet</td></tr>
    <tr><td>Developers</td><td>A public API with no key, <span class="mono">npm i kerb-sdk</span>, an open hourly dataset, /llms.txt</td><td>api.usekerb.xyz</td></tr>
  </tbody></table>

  <h2 style="margin-top:9mm"><span class="n">10</span>Evidence from the live system</h2>
  <div class="two">
    <div>
      <h3>Incentives ending (Report #2)</h3>
      <p>At the 07:00 UTC end of the X Liquidity campaign on 24 September, C(1%) held for all ten assets. By the 08:30 UTC capture it had fallen by 10% or more for ${fell10 || 5} of ${later.length || 10}, the largest ${worst?.symbol ?? "HKEXCx"} at ${worst?.c1LaterChangePct ?? "-82.80"}%. The Hong Kong close sits inside that interval, and the report says so.</p>
      <h3>The dispersion guard in production</h3>
      <p>From 24 Sep 08:13 to 25 Sep 01:43 UTC, HKEXCx&rsquo;s pool price sat more than 2% from its reference. The regime went to Stale and new borrowing stopped on its own; it then loosened in capped steps.</p>
    </div>
    <div>
      <h3>Verified, not asserted</h3>
      <ul>
        <li>The full credit lifecycle ran in real browsers on the live site with fresh wallets.</li>
        <li>${settled} paid agent call settled in USDT0 on X Layer mainnet; calls without a transaction are never counted.</li>
        <li>KerbQuote on mainnet returns the same max borrow as the posted terms.</li>
        <li>6,342 of 6,342 exit checks follow the selection rule against OKX DEX.</li>
        <li>${tests.typescript.passed} TypeScript and ${tests.solidity.passed} Solidity tests pass; all ${deployments} deployments are Sourcify exact matches.</li>
      </ul>
    </div>
  </div>

  <h2 style="margin-top:9mm"><span class="n">11</span>Limits</h2>
  <p>Kerb is unaudited. One attester signs the terms. The reference price is issuer data with an independent check, not a verified oracle report. Credit runs on testnet with mirror collateral: the production tokens are restricted in some jurisdictions, and lending real money needs an audit first. Input bundles are served by the Kerb API since the free pinning quota ran out on 21 September; every bundle remains verifiable by its hash.</p>

  <h2 style="margin-top:9mm"><span class="n">12</span>What comes next</h2>
  <ol><li>A verified oracle reference (Chainlink Data Streams) as the first rung for the Mark.</li><li>Several attesters with a threshold, and an audit.</li><li>Curator integrations that set supply caps from measured depth.</li><li>Real collateral, where the law and the audit allow.</li></ol>

  <h2 style="margin-top:9mm"><span class="n">13</span>References</h2>
  <ol class="small" style="color:${INK}">
    <li>Kerb Terms Standard 0.1 and the 0.2 amendment: github.com/Franlinozz/Kerb/blob/main/docs/KTS-0.1.md and docs/v2/KTS-0.2.md.</li>
    <li>Market-Time Reports #1 and #2: usekerb.xyz/research.</li>
    <li>API reference with captured responses: github.com/Franlinozz/Kerb/blob/main/docs/API.md.</li>
    <li>Contracts, posts and the live recompute: usekerb.xyz/proof. Claims and their evidence: docs/release/CLAIM_EVIDENCE.md.</li>
  </ol>
</section>

<div class="backcover" id="back">
  <div class="art"></div>
  <div class="body">
    <div style="display:flex;align-items:center;gap:12px">${mark(BONE, 0.6, 30)}${word(BONE, 20)}</div>
    <p style="font-family:'Instrument Serif',Georgia,serif;font-size:28pt;line-height:1.15;margin:12mm 0 0">Most lenders ask what collateral is worth.<br><span style="color:#D6A64F">Kerb asks whether you could sell it.</span></p>
    <div class="links">
      <span>Product</span><a href="https://www.usekerb.xyz">www.usekerb.xyz</a>
      <span>Proof</span><a href="https://www.usekerb.xyz/proof">www.usekerb.xyz/proof</a>
      <span>Source</span><a href="https://github.com/Franlinozz/Kerb">github.com/Franlinozz/Kerb</a>
      <span>API</span><a href="https://api.usekerb.xyz">api.usekerb.xyz</a>
      <span>SDK</span><span style="font-family:inherit;letter-spacing:0;text-transform:none;color:${BONE};font-size:10pt">npm i kerb-sdk</span>
      <span>Studio</span><span style="font-family:inherit;letter-spacing:0;text-transform:none;color:${BONE};font-size:10pt">Xyndicate Labs · @xyndicatepro</span>
    </div>
  </div>
  <p class="fine">Kerb is unaudited software. Kerb Credit runs on X Layer testnet with mirror collateral that has no claim on any security. Nothing in this paper is investment advice. See usekerb.xyz/legal/risk.</p>
</div>
</body></html>`;

const header = `<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:7.5px;color:#8A887F;padding:0 20mm;display:flex;justify-content:space-between;align-items:center">
  <span style="display:flex;align-items:center;gap:6px">${mark("#16170F", 0.45, 9)}<span style="letter-spacing:0.14em">KERB WHITEPAPER · v1.1</span></span><span style="letter-spacing:0.14em">CREDIT ON THE MARKET&rsquo;S CLOCK</span></div>`;
const footer = `<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:7.5px;color:#8A887F;padding:0 20mm;display:flex;justify-content:space-between">
  <span>usekerb.xyz · Xyndicate Labs · 25 September 2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

writeFileSync(resolve(ROOT, "scripts/whitepaper/whitepaper.html"), html);
// Covers print without the running header; the body with it. pdfunite joins the three.
const { execFileSync } = await import("node:child_process");
const tmp = resolve(ROOT, "scripts/whitepaper");
const b = await chromium.launch();
const page = await b.newPage();
const only = async (keep, path, withHeader) => {
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((k) => {
    const cover = document.getElementById("cover"), back = document.getElementById("back");
    if (k === "cover") { back.remove(); for (const el of [...document.body.children]) if (el !== cover) el.remove(); }
    else if (k === "back") { for (const el of [...document.body.children]) if (el !== back) el.remove(); back.style.breakBefore = "auto"; }
    else { cover.remove(); back.remove(); }
  }, keep);
  await page.pdf({ path, format: "A4", printBackground: true, displayHeaderFooter: withHeader, headerTemplate: header, footerTemplate: footer, preferCSSPageSize: true });
};
await only("cover", `${tmp}/cover.pdf`, false);
await only("body", `${tmp}/body.pdf`, true);
await only("back", `${tmp}/back.pdf`, false);
await b.close();
const out = resolve(ROOT, "apps/web/public/kerb-whitepaper.pdf");
execFileSync("pdfunite", [`${tmp}/cover.pdf`, `${tmp}/body.pdf`, `${tmp}/back.pdf`, out]);
for (const f of ["cover", "body", "back"]) execFileSync("rm", ["-f", `${tmp}/${f}.pdf`]);
copyFileSync(out, resolve(ROOT, "docs/release/kerb-whitepaper.pdf"));
console.log("wrote", out, "and docs/release/kerb-whitepaper.pdf");
