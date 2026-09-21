# KERB V2 AUDIT
### Crucible pass on commit `6b107b3`, live site usekerb.xyz, 21 Sep 2026 ~11:00 UTC

Sources inspected directly: the full `Franlinozz/Kerb` repository (cloned: web app source, CSS, engine capacity code, KTS params, contracts, API routes, scripts, PROJECT_STATE, README, SUBMISSION), the live pages `/`, `/reports`, `/reports/1`, `/asset/HKEXCx`, the 13 screenshots, and ChatGPT's Crucible response. Where I say *verified* I read the code or the live response. Where I say *inferred* I did not execute it.

Time left: about 4 days 13 hours to 25 Sep 23:59 UTC. Internal submit target 18:00 UTC Friday.

---

## 1. Verdict

**SHIP AFTER LISTED CRITICAL FIXES.** The engine, contracts, data plane and evidence discipline are genuinely strong. Four things stand between that and a winning submission, and only one of them is visual:

1. **The thesis is not visible in the numbers.** Carry and Session Max never move with the clock. (Section 3. ChatGPT missed this, and it is the most dangerous finding in this document.)
2. **You declared the Remote route.** Judges will never see you pitch. They see three artifacts: the video, the URL, the repo. Every hour from now optimises those three.
3. **The presentation layer is an engineering console.** Agreed with ChatGPT, and the fix goes further than it proposed (Kerbstone design system, `V2-DESIGN-SYSTEM.md`).
4. **The public repo contains your private strategy chat.** `ROUGH-WORK-BUILD-PLAN.md` sits at the repo root.

---

## 2. Scores (Crucible weights, conservative)

| Dimension | Weight | Now | Target after V2 |
|---|---:|---:|---:|
| Functional completeness | 18 | 14 | 17 |
| Hackathon alignment | 12 | 11 | 12 |
| Sponsor integration | 10 | 8.5 | 9 |
| Reliability | 10 | 7.5 | 9 |
| UX clarity | 10 | 3.5 | 9 |
| Visual polish | 8 | 2 | 7.5 |
| Technical quality | 10 | 8.5 | 9.5 |
| Security / trust | 6 | 5 | 5.5 |
| Demo readiness | 6 | 2.5 | 6 |
| Competitive strength | 5 | 3 | 4.5 |
| Documentation / submission | 5 | 3.5 | 5 |
| **Total** | **100** | **69** | **~93** |

**Win readiness now: 60 / 100.** Lower than ChatGPT's 66 because of the thesis-integrity finding, the public strategy file, and the Remote-route implication (no video yet, and the hero moment cannot be reproduced by a judge on demand).

---

## 3. The finding ChatGPT missed: the clock does not move the credit

Live terms history for HKEXCx on 21 Sep (from `/asset/HKEXCx`):

```
07:04  Normal            Carry 50.00%  Session Max 55.00%
07:30  Last Call         Carry 50.00%  Session Max 55.00%
08:00  Normal            Carry 50.00%  Session Max 55.00%
08:10  Reference closed  Carry 50.00%  Session Max 55.00%
10:40  Reference closed  Carry 50.00%  Session Max 55.00%
```

Every asset on the Board shows the same pattern. The cause is in `apps/engine/src/capacity.ts`:

```ts
let carry   = Decimal.min(sWeak, LT.minus(cfg.carryMargin));    // carryMargin   = 0.10
let session = Decimal.min(sCure, LT.minus(cfg.sessionMargin));  // sessionMargin = 0.05
```

`stressLTV` evaluates to roughly 0.87 for these blue chips (a 99th percentile 30 hour gap of about 4.6% is small), so the `LT - margin` clamp always binds. Carry is always LT minus 10 points, Session Max is always LT minus 5 points, regardless of session, horizon or depth. Only the debt ceiling moves.

Why this matters: the product's name, tagline, demo and README all say credit follows the market's clock. A technical judge who opens one terms history sees two flat lines across four regimes and asks what exactly moved. The honest answer today is "the debt ceiling, and the cure deadline". That is defensible, but the Carry versus Session Max split is then a fixed 5 point constant, which reads as theatre.

**Fix: KTS-0.2, horizon-bound margins** (full spec in `KTS-0.2.md`). The margin below the fixed liquidation line becomes a function of the stressed gap over the horizon each mode must survive, plus the measured exit cost:

```
carryMargin   = max(minCarry,   k * v * g(H_weak) + s)
sessionMargin = max(minSession, k * v * g(H_cure) + s)
```

With `k = 2.5`, the shape comes from the data: before a weekend, Carry tightens (long horizon) while Session Max stays generous (cure deadline is close). Midweek, they converge. On Monday the loosening is visibly stepped by the existing tighten-fast, loosen-slow asymmetry, which today is invisible because nothing moves. Old reports stay reproducible because verification dispatches on the bundle's `kts` version.

This is a gated engine change with a hard decision time (Tue 22 Sep 18:00 UTC) and a written rollback. If it does not go green, the fallback is honest copy: say plainly that v0.1 moves the debt ceiling and the covenant deadline, and that the Carry to Session Max margin is fixed.

---

## 4. Top threats to winning, ranked

| # | Sev | Threat | Source |
|---|---|---|---|
| 1 | S1 | Carry and Session Max are constant by construction; the core claim is not visible in the terms | Mine |
| 2 | S1 | Remote route: video, URL and repo are the entire judging surface; no video exists yet | Mine |
| 3 | S1 | Presentation layer reads as an internal console: no hero, no hierarchy, no identity, no fonts loaded | Both |
| 4 | S1 | `ROUGH-WORK-BUILD-PLAN.md` at repo root holds the private strategy chat (visa, ChatGPT, prize route, key exceptions). `KERB-MASTER-PLAN.md` at root holds prize math and Telegram questions | Mine |
| 5 | S1 | A judge cannot reach the hero moment alone: no testnet OKB onboarding, no visible demo clock, no curable position to cure | Mine |
| 6 | S1 | Raw viem error persists in the global header after a rejected connect (`Wallet.tsx` prints `error.message`) | Both |
| 7 | S1 | `/market` shows the mainnet lead-asset strip, but the covenant runs on `KerbClockDemo`. The page's own clock contradicts the market it hosts | Mine |
| 8 | S2 | Session Strip goes stale: after the next transition passes, the countdown renders an em dash forever (`duration()` returns it for negatives; the clock is never refetched). Day labels sit on midnight ticks, so each session appears under the wrong day | Mine |
| 9 | S2 | `/methodology` parameter table is broken: nested objects render as one unbroken `nowrap` string, pushing every value off-screen behind a white scrollbar | Mine |
| 10 | S2 | Mirror liquidation thresholds (kKOx 68%, kHKEXCx 63%) differ from the mainnet LT the relayed terms were computed under (65%, 60%). Unexplained anywhere | Mine |
| 11 | S2 | Report #2 (campaign end, Thu 24 Sep 07:00 UTC) has no publishing plan, and the report's L-unit figures are unreadable to humans | Mine |
| 12 | S2 | Pinning refused; only 544 of 1,369 recent bundles fetchable at the last proof load; asset pages say "pinning is being refused right now" | Both |
| 13 | S2 | No mobile navigation, no favicon, no OG/Twitter card, no 404/error/loading routes, no CI, one web unit test | Both |
| 14 | S3 | 25 em dashes in web copy, 5 in README (your standing rule); em dash used as the empty-value glyph | Mine |
| 15 | S3 | Number formatting inconsistent (`765.00` beside `13.4k`; marks at 4 and 6 decimals) | Both |
| 16 | S3 | Tertiary text `#6d7f92` on `#121a24` fails WCAG AA for the small sizes it is used at | Mine |
| 17 | S3 | Every page is `force-dynamic` and blocks on the API; one slow API call slows every route | Mine |

---

## 5. What is verified working (keep, do not touch)

- Mainnet risk plane: KerbClock and KerbTerms on chain 196, Sourcify exact match, terms posted every ~5 to 10 minutes with the Builder Code suffix.
- Uniswap V3 tick-walk depth with OKX DEX v6 cross-check (rung 1), multi-hop, exclusions recorded.
- Credit Mark with reference median, TWAP pool price, dispersion guard, regime haircut, per-source exclusions (live HKEXCx page excluded a stale xStocks price by 9,347 s and said so).
- Per-asset calendars including the HKEX lunch; Last Call windows fire daily on HK names (visible on the Board at 07:45 UTC).
- KerbCredit with Carry, Session Max, cure covenant, default path, faucets for mirror collateral and mUSDG, Builder Code on UI transactions, cure executed from the UI (commit `ad92033`).
- Append-only store with triggers rejecting UPDATE, DELETE and TRUNCATE.
- 494 TypeScript and 106 Solidity tests, invariant suite, fork tests, Slither dispositioned.
- Market-Time Report #1 page (`/reports/1`) is substantive: 42.25 h, 35,130 readings, 7 of 10 pools down, largest fall MIXUx −49.12%, gap reported honestly.

## 6. Partially verified

- Reproducibility: every bundle since K-43 resolves through the API; IPFS coverage incomplete.
- Wallet flows: code handles wrong network, rejection and revert; not executed by me.
- Responsive: screenshot loop exists; source shows no mobile nav, so 390 px is inferred poor.

---

## 7. ChatGPT's audit: adopt, modify, reject

**Adopt:** the diagnosis that the frontend hides the engine; per-page IA (Home sells, Board explains, Asset explains risk, Credit acts, Position protects, Reports establish expertise, Methodology proves, Developers distribute, Proof verifies); Carry versus Session Max as the product moment; Last Call as a full state takeover; Proof as a verification cockpit; Reports as research; font loading; typography scale; wallet error fix; mobile shell; favicon and OG; CI; Playwright E2E; progressive disclosure on Methodology; developer tabs with live responses; "one frontend owner of the CSS".

**Modify:**
- Colour: it proposed a cool blue-cyan interactive accent. Replaced by the Kerbstone system you asked for (bone, black, stone, moss, brass, olive, forest), with interaction carried by moss and the bone fill, and brass reserved for Last Call.
- Nav: it proposed "Markets / Credit / Research / Developers". Keep the product word **Board**; rename Market to **Credit** and Reports to **Research** with 308 redirects so no existing link breaks.
- Reports: it judged from the index. The report page is already rich; the fix is editorial presentation, human units, charts, and Report #2.
- Session Strip: it proposed a bigger single rail. Better: a **two-lane rail** (New York and Hong Kong on one shared "now" cursor) on Home, because three markets on one clock is the most original visual Kerb owns.

**Reject:**
- "Freeze the engine" as an absolute. One engine change (KTS-0.2) is thesis-critical and is scoped, gated and reversible.
- Opening the demo on a live pitch. You are Remote. The video carries everything.

---

## 8. Hardening queue

### S1 (must land)
| ID | Work | Acceptance |
|---|---|---|
| H-01 | KTS-0.2 horizon-bound margins, versioned verify, replay proof | Carry and Session Max differ by regime in live posts; no onchain post reverts in a 48 h replay; `kerb verify` passes for a 0.1 and a 0.2 bundle |
| H-02 | Repo hygiene: remove `ROUGH-WORK-BUILD-PLAN.md`, move planning docs to `docs/planning/` with private sections stripped | Repo root contains only README, LICENSE, AGENTS.md, SECURITY.md, config and code |
| H-03 | Kerbstone design foundation: fonts loaded, tokens, shell, header, mobile nav, footer, 3-state theme | Screenshots at 390/768/1440 both themes look like one product |
| H-04 | Wallet layer: connector chooser (EIP-6963), mapped errors as toasts, never raw library text | Rejecting a connection shows "Connection cancelled" for 3 s, then nothing |
| H-05 | Judge onboarding on Credit: network add, testnet OKB check and faucet link, mirror and mUSDG faucets, approve then act stepper | A fresh wallet reaches a Session Max borrow with no outside instructions |
| H-06 | Demo clock surfaced on Credit, with countdown to the next Last Call | The rail on `/credit` is the demo cycle, labelled, and matches `cureStatus` onchain |
| H-07 | Curable positions feed plus a testnet demo position that becomes curable each cycle (operator approval) | Any visitor can press Cure within one hour of arriving |
| H-08 | Home rebuilt as the Kerbstone editorial hero with live data callouts | A stranger states what Kerb is within 10 seconds |
| H-09 | Demo video recorded to `V2-DEMO.md` | 2:50 to 3:30, all real, captioned |

### S2
| ID | Work | Acceptance |
|---|---|---|
| H-10 | Session Rail: live refetch at transitions, day-centred labels with dates, full, compact, two-lane and demo variants | No em dash, no stale countdown, labels under the correct day |
| H-11 | Board: KPI band, market filters, LTV ladder cells, depth sparklines, next-transition countdowns, sources collapsed | Risk differences scannable in 5 seconds |
| H-12 | Asset page: hero KPIs, LTV ladder, tabs, terms-history chart with regime bands | The thesis is visible as a picture |
| H-13 | Research: editorial index, report page with charts and human units, Report #2 from the campaign-end window | Report #2 live by Thu 24 Sep 20:00 UTC |
| H-14 | Methodology: sticky contents, layered diagrams, parameter table fixed | No value off-screen at any width |
| H-15 | Proof cockpit; testnet contracts verified on Sourcify; pinning note reframed | No bare "no" in the verification column |
| H-16 | Mirror LT explained or aligned | One sentence on `/credit` and `/proof`, or equal values |
| H-17 | CI workflow and Playwright E2E for the golden paths | Green badge on README |
| H-18 | Favicon, app icon, OG and Twitter images, per-page metadata | Link unfurls as Kerb with art |

### S3 / S4
Em dash sweep in UI, README and docs; number formatting standard; WCAG AA contrast; ISR plus client refresh instead of blanket `force-dynamic`; skeletons; focus rings; reduced motion; 404, error and loading routes; keyboard path through Credit; changelog page from `BUILD_PERIOD.md`.

---

## 9. Things not to touch

Kerb name. The product thesis. Clock, Mark, Depth, Terms pipeline (except the KTS-0.2 capacity function). Fixed liquidation threshold. Partial cure architecture. The tick-walk engine. Append-only store and its triggers. Builder Code wiring. Mainnet risk plane / testnet credit plane split. Provenance labels. Contract code (no redeploys). The collector during 24 Sep 05:00 to 09:00 UTC. Git history (do not rewrite; commit hashes are cited on `/proof`).

---

## 10. Final gates for Friday

| Gate | Pass condition |
|---|---|
| A Eligibility | Form fields, public repo, video 2 to 4 min, contract addresses, product link |
| B Golden path | Fresh wallet: onboard, borrow Session Max, Last Call, cure, repay, all on the live site |
| C X Layer | Mainnet posts in the last hour with Builder Code decoded on `/proof` |
| D Security | No secrets in history, no new privileged keys beyond the approved demo wallet |
| E UX | Each page passes the 10-second test for its job |
| F Responsive | 390, 768, 1440, both themes, zero horizontal page scroll |
| G Repository | CI green, README accurate, root clean |
| H Demo | Video uploaded, plays logged out |
| I Claims | `CLAIM_EVIDENCE.md` complete, nothing unverified in public copy |
| J Submission | Form submitted by 18:00 UTC with receipt saved |
