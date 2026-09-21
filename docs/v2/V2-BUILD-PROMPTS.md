# V2-BUILD-PROMPTS.md
## Kerb V2: paste-ready phase prompts, 21 to 25 September 2026

Paste one phase at a time. Wait for the CHECKPOINT block. Check it against the acceptance lines. Then paste the next. Two agents run in parallel: **Codex** (backend, engine, API, scripts, art pipeline) and **Claude Code** (all frontend and all CSS). The lane column tells you who gets which prompt.

Every prompt assumes these files are in the repo under `docs/v2/`: `V2-AUDIT.md`, `V2-DESIGN-SYSTEM.md`, `KTS-0.2.md`, `V2-IMAGE-PROMPTS.md`, `V2-DEMO.md`, and that `AGENTS-V2-ADDENDUM.md` has been appended to `AGENTS.md` as section 12.

---

## Schedule (UTC)

| When | Codex lane | Claude Code lane | You |
|---|---|---|---|
| Mon 21, now to 23:59 | V2-K, V2-00, V2-01 start, V2-03 | V2-04 | Approve art cost; pick art tonight |
| Tue 22 | V2-01 finish, V2-02 | V2-05, V2-06 | **18:00 KTS-0.2 go / no-go** |
| Wed 23 | V2-08 backend | V2-07, V2-08 frontend | Approve demo keeper wallet |
| Thu 24 05:00 to 09:00 | **hands off collector and attester**, window watch | continue frontend on staging only | Record B-roll of the Board 07:00 to 08:00 |
| Thu 24 rest | Report #2, V2-11 | V2-09, V2-10, V2-11 | **20:00 freeze and cutover** |
| Fri 25 | V2-12 | V2-12 | Video 06:30 to 09:00, form by 18:00 |

Cut line if behind at Wed 18:00 UTC, in this order: Market-time theme mode, DepthSpark, Developers live response panels, Methodology diagrams beyond the LTV ladder (restyle only), demo keeper (fall to rung 2), Research forest band art.

---

## Operator decisions you owe the agents

1. Art batch cost approval (V2-03), then your pick per plate.
2. KTS-0.2 go or no-go at Tue 18:00 UTC (V2-01).
3. Demo position keeper approval with a fresh testnet-only wallet (V2-08).
4. Pinning: upgrade Pinata, switch provider, or keep API-served bundles and state it (V2-00).
5. Mirror LT: align or explain (V2-00).
6. Your voice or captions-only for the video (V2-12).

---

# V2-K. Kickoff and staging (Codex, 30 min)

```
V2-K. Re-read AGENTS.md sections 1 to 11, then read docs/v2/V2-AUDIT.md in full. You are starting Kerb V2.

1. Commit the V2 docs under docs/v2/ exactly as provided. Append docs/v2/AGENTS-V2-ADDENDUM.md to AGENTS.md as section 12. Commit: "docs(v2): audit, design system, KTS-0.2, prompts".

2. Staging. The live site usekerb.xyz must never go down during V2. Stand up a second web deployment of the same app at v2.usekerb.xyz (Caddy host plus a second PM2 process on a different port, or a second project on whatever host serves the web today). It reads the same public API. V2 frontend work deploys ONLY to staging until the cutover in V2-11. Write the exact cutover and rollback commands into PROJECT_STATE.md under "V2 cutover".

3. Builds never happen in the directory a live process serves from. Build into a fresh directory or worktree, then swap. A failed build must leave the running site untouched.

4. Add a "V2" section to PROJECT_STATE.md: the phase list from docs/v2/V2-BUILD-PROMPTS.md with status per phase, the operator decisions list, and an empty "Requests" table (one agent asking the other for something).

CHECKPOINT: staging URL live and serving the current app, cutover and rollback commands, commit hash. STOP.
```

---

# V2-00. Repo hygiene, CI, verification (Codex, ~2 h)

```
V2-00. Re-read AGENTS.md section 12. Judges open the repo. Make it look like a company's repo.

1. Remove ROUGH-WORK-BUILD-PLAN.md from the working tree (git rm; do NOT rewrite history). Move KERB-MASTER-PLAN.md, BUILD_PLAN.md, DEMO.md, SUBMISSION.md and QA.md to docs/planning/. In the moved master plan, delete section 11 (participation route), section 12 (Telegram questions), and every sentence about prize amounts, visas, travel, or other teams. Move KTS-0.1.md and ARCHITECTURE.md to docs/. Fix every link that pointed at the old paths (README, web pages, API responses that embed paths). Root keeps: README.md, LICENSE, AGENTS.md, SECURITY.md, package files, config, apps, packages, contracts, scripts, data, docs.

2. Em dash sweep. Replace every em dash in README.md, SECURITY.md, docs/**, apps/web/src/**, apps/api/src/** and apps/engine/src/** user-visible strings with a colon, comma or full stop that reads naturally. In code that renders an empty value, replace the dash glyph with a word ("No debt", "Not yet posted", "Updating"). Add a CI check: fail if a public copy file or a .tsx string contains U+2014.

3. CI. Add .github/workflows/ci.yml with three jobs:
   - ts: checkout (submodules recursive), pnpm, Node 22 with cache, install --frozen-lockfile, typecheck, lint, test (tests that need Postgres or live RPC run against a service container or are tagged and skipped in CI; print the skipped count), then build @kerb/web with KERB_API_PUBLIC=https://api.usekerb.xyz. The web build must succeed even if the API is unreachable.
   - sol: foundry-rs/foundry-toolchain, forge build, forge test excluding the Fork suites.
   - e2e: placeholder job that runs `pnpm --filter @kerb/web e2e` (V2-11 fills it). Mark allowed-to-fail until V2-11.
   Add the CI badge to the README header.

4. Verification. Verify on Sourcify every testnet contract that shows "no" on /proof: MockUSDG, KerbClockDemo, KerbMirror kKOx, KerbMirror kHKEXCx, KerbCredit. Use the exact compiler settings from the deploy artifacts. Update config/deployments.json and the /v1/proof verification strings to "Sourcify exact match", "Sourcify partial match", or "Source in repo, verification pending". The string "no" must never be served again.

5. Mirror liquidation thresholds. Mainnet KOx LT is 0.65 and HKEXCx LT is 0.60; the testnet mirrors list 0.68 and 0.63. Find why (deploy scripts, listing params). Do not redeploy. Write the reason into the credit API's disclaimer field and into docs/ARCHITECTURE.md in one sentence, for example "Mirror listings carry LT three points above mainnet so a relayed Session Max term can never sit on the liquidation line during the compressed demo cycle." If there is no good reason, say so in PROJECT_STATE.md and propose the timelocked alignment for the operator; do not execute it.

6. Pinning. Report the current pin success rate and the exact failure. Offer the operator three options with costs: upgrade Pinata, switch to another pinning service, or keep API-served bundles. Whatever is chosen, /v1/proof phrases the history as: "Every bundle posted after K-43 resolves from its inputsHash through the Kerb API. Earlier posts have a documented IPFS gap caused by the pinning quota."

CHECKPOINT: root listing, moved files, em dash count before and after, CI run URL and status, Sourcify results per contract, mirror LT explanation, pinning options. STOP.
```

---

# V2-01. KTS-0.2 horizon-bound margins (Codex, ~5 h, gated)

```
V2-01. Re-read docs/v2/KTS-0.2.md and docs/KTS-0.1.md section 7. This is the only engine change in V2. The collector, depth, mark, regime and contracts are frozen.

1. params: add kts "0.2" fields to config/kts-params.json under capacityDefaults: stressMultiplier "2.5", minCarryMargin "0.05", minSessionMargin "0.03". Bump paramsVersion (for example 2026-09-22.1). Keep the 0.1 fields.

2. engine: in apps/engine/src/capacity.ts add computeCapacityV02 implementing KTS-0.2 section 2 exactly, returning the same Capacity shape plus the margins block in KTS-0.2 section 5. Keep computeCapacity (0.1) untouched. build.ts selects the function by params.kts. bundle.ts type becomes kts: "0.1" | "0.2". The engine stays a pure function of the bundle.

3. verify: kerb verify reads kts from the bundle and dispatches. Tests: one stored 0.1 bundle and one freshly built 0.2 bundle both verify byte-identically.

4. unit tests: table-driven, at least six horizon cases (lunch, overnight, weekend, holiday bridge, tiny gap hitting the floor, thin depth raising s). Invariant: carry <= session <= LT, both within guardrails.

5. replay: run 0.2 capacity over every stored bundle from the last 72 hours (inputs only; do not post). Write data/reports/kts-0.2-replay.json and a PNG or SVG chart of Carry and Session Max per asset over time with regime bands. Summarise min, max and spread per asset.

6. fork test: on an anvil fork of X Layer mainnet, impersonate the attester, and post the replayed 0.2 series through KerbTerms in time order for three assets (one US, one HK, SLVx). Zero reverts required. If a loosen step reverts, align the engine's asymmetry parameters to the contract's bounds; never change the contract.

7. report and API: /v1/report and /v1/board expose capacity.margins and the kts version. /v1/params shows the new fields.

8. STOP BEFORE SWITCHING THE LIVE ATTESTER. Present: the replay chart, the spread table, fork test output, verify output, and the exact change the attester needs. Wait for the operator's written "go KTS-0.2". On go: deploy engine and attester, confirm the first live 0.2 posts on chain 196 and 1952, and confirm at least one regime change later produces a different Carry. On no-go, or no answer by Tue 22 Sep 18:00 UTC: leave 0.1 live, keep the branch unmerged, and add a Requests line for Claude Code to use the 0.1 copy in KTS-0.2.md section 8.

CHECKPOINT: test counts, replay summary, fork result, verify result, decision received, first 0.2 tx hashes if live. STOP.
```

---

# V2-02. API support for V2 (Codex, ~3 h)

```
V2-02. Re-read AGENTS.md section 12 and docs/v2/V2-DESIGN-SYSTEM.md section 11. Add read-only endpoints the new frontend needs. No existing response field is removed or renamed; only additions. Every new value carries a provenance label like the rest of the API.

1. Market metadata, static config in apps/api: XNYS {city "New York", tz "America/New_York", lat 40.7069, lon -74.0113}, XNAS {city "New York", tz "America/New_York", lat 40.7566, lon -73.9863}, ARCX {city "New York", label "NYSE Arca", tz "America/New_York", lat 40.7069, lon -74.0113}, XHKG {city "Hong Kong", tz "Asia/Hong_Kong", lat 22.2840, lon 114.1580}.

2. GET /v1/board additions per row: lt, market {code, city, tz, lat, lon}, next {type, at, weakening}, cure {opensAt, closesAt, open}, kts, margins (compact: carryMarginUsed, sessionMarginUsed, horizonEndsAt), spark (C(1%) and regime from terms posts over the last 24 h, at most 48 points, oldest first). Top level adds summary {inLastCall, c1Total, ceilingTotal, sourcesHealthy, sourcesTotal, lastPostAgeSec}. Cache 15 s.

3. GET /v1/tape?limit=20: newest Terms posts across both chains {symbol, chainId, regime, c1, carryLTV, sessionMaxLTV, tx, observedAt}. Cache 15 s.

4. GET /v1/stats: {obsPoolRows, obsTotalRows, postsByChain [{chainId, count}], assets, markets, latestReport {id, title, headline, figure}}. Cheap queries only; cache 60 s.

5. GET /v1/credit/:chain/demo-clock: read KerbClockDemo immutables (weekLength, sessionEnd, cureStart, epoch) and return {address, weekLengthSec, sessionEndSec, cureStartSec, epoch, now, phaseSec, state "SESSION" | "LAST_CALL" | "CLOSED", nextCureOpensAt, nextCureClosesAt, nextSessionAt, cycleStartedAt}. Cache 5 s.

6. GET /v1/credit/:chain/positions?state=curable|all: scan KerbCredit Borrow, Repay, Cure, Liquidate events from the deploy block (getLogs in bounded chunks, cached 30 s, indexed incrementally), then read cureStatus and healthFactor per open (user, asset). Return {user, assetId, symbol, mode, debt, positionLTV, carryTarget, healthFactor, cure {eligible, deadline, requiredRepay}}. Sorted: curable first, then by deadline.

7. OpenAPI-style table of every endpoint in docs/API.md with one real example response each (captured, not invented).

8. Tests for each new route: success, unknown asset, upstream RPC failure (returns a labelled error, not a 500 with a stack).

CHECKPOINT: curl output of each new endpoint against production, test count, docs/API.md link. STOP.
```

---

# V2-03. Art batch and brand assets (Codex, ~1.5 h plus operator pick)

```
V2-03. Re-read docs/v2/V2-IMAGE-PROMPTS.md in full.

1. Ask the operator to approve the image batch cost (gate 7). Wait for approval.
2. Implement scripts/art/generate.ts, process.ts and og.ts exactly as specified. Raw files stay on the VPS under art/raw/, never in git.
3. Generate three candidates per plate and theme (P1 day and night plus mobile crops, P2, P3 plus forest variant, P4, P5). Post a contact sheet (one image with all candidates labelled) for the operator.
4. After the operator picks, process to apps/web/public/art/ with the manifest and blur placeholders. Verify sizes against the budget.
5. Brand: create apps/web/src/app/icon.svg from the mark in V2-DESIGN-SYSTEM.md section 6, apple-icon.png (180), favicon.ico (16, 32), and the OG set from og.ts (home, board, credit, research, methodology, proof, developers) at 1200x630.
6. If the operator rejects every candidate for a plate, fall to rung 2 (geometric SVG Kerbstone) for that plate and log it.

CHECKPOINT: contact sheet path, operator picks, final asset list with byte sizes, OG images, cost. STOP.
```

---

# V2-04. Kerbstone foundation and app shell (Claude Code, ~7 h)

```
V2-04. Re-read AGENTS.md section 12 and docs/v2/V2-DESIGN-SYSTEM.md sections 1 to 10 in full. You own every line of CSS from now on. Work only on the staging deployment.

Current state you are replacing: apps/web/src/app/globals.css (349 lines, 1.5rem H1, 3px radius, fonts declared but never loaded), a 52 px header with six tiny links and no mobile nav, a raw viem error printed in the header, a text theme toggle.

1. Styles architecture. Replace globals.css with src/styles/: tokens.css (paste section 3 exactly), reset.css, base.css (typography scale from section 4 as classes and element defaults), layout.css (grid, containers, construction layer, section rule), components/*.css, utilities.css. Use @layer reset, tokens, base, layout, components, pages, utilities. No raw hex outside tokens.css.

2. Fonts. General Sans 300/400/500/600 self-hosted via next/font/local (download woff2 from Fontshare into src/fonts/, record the licence in docs/THIRD_PARTY.md), Instrument Serif and IBM Plex Mono via next/font/google. Expose as CSS variables. If General Sans cannot be fetched, use Hanken Grotesk and log the rung. Verify in the browser that the computed font-family resolves to the loaded face.

3. Themes. Night (default), Day, Market time. Rewrite the bootstrap script to read kerb-theme = night | day | market, resolve market to night or day using the New York regular session (13:30 to 20:00 UTC Mon to Fri, holidays from /v1/clock when available, else weekday rule), and set data-theme before first paint. The theme menu is an icon button (lucide Sun, Moon, Clock) with a small popover. Re-resolve market mode every 60 s. No flash of the wrong theme on reload.

4. Header. Per section 9 SiteHeader: mark + wordmark, nav Board, Credit, Research, Methodology, Developers with active state, Status pill fed by /health (Live and post age in moss, brass over 15 min, oxide unreachable) linking to /proof, Connect, theme menu. Sticky, 64 px, blurred canvas. Mobile 56 px with drawer (nav, MarketClocks, theme, Connect). Focus trap in the drawer, Escape closes, body scroll locked.

5. Routes. Rename /market to /credit and /reports to /research (move the page folders), add 308 redirects in next.config.ts from /market, /reports and /reports/:id. Update every internal link.

6. Wallet layer. Replace Wallet.tsx:
   - WalletSheet listing EIP-6963 discovered connectors (use wagmi's connectors with their name and icon; OKX Wallet first when present), then generic injected; empty state with install links to OKX Wallet and MetaMask.
   - Connected state: address chip (copy, OKLink), network badge (X Layer testnet 1952), disconnect.
   - Never render error.message. Map through a new lib/errors.ts: user rejection (code 4001 or matching text) becomes toast "Connection cancelled" for 3 s; no provider becomes "No browser wallet found"; unknown becomes "Could not connect. Try again or use another wallet." with details only in console.
   - lib/errors.ts also maps every KerbCredit and KerbMirror custom error to a sentence with decoded numbers: ExceedsModeLTV(ltv, ceiling) "This would take the position to {ltv}% against a {mode} limit of {ceiling}%.", ExceedsDebtCeiling, ExceedsPositionCap, InsufficientLiquidity, PositionUnsafe, TermsUnusable "New borrowing is paused: the latest terms for this asset are not usable ({regime}). Repay and cure still work.", CureWindowClosed, NotCurable, CureTooLarge, NotLiquidatable, CloseFactorExceeded, InsufficientCollateral, MarkUnavailable, BorrowPaused, DepositPaused, FaucetCapExceeded "This address has used its faucet allowance ({remaining} left).", ZeroAmount, NoDebt. Update Tx.tsx to use it.

7. Toasts. A tiny store plus <Toaster/> per section 9. aria-live polite. Replace every inline status callout for transactions with toasts plus the TxStepper (build TxStepper now; it is used in V2-08).

8. Footer per section 9 with the giant wordmark, four columns, MarketClocks placeholder (V2-05 fills it), standing disclaimer.

9. UI primitives in src/components/ui/: Button, IconButton, Field (numeric with Max chip), Tabs, Disclosure, Drawer, Modal, Tooltip (hover and focus), Pill, Kpi, SectionHead, Skeleton, EmptyState, ErrorState, AddressChip, HashChip, CodeBlock (copy button, language tabs), ArtPanel (picture with night/day sources and masks; uses public/art manifest, falls back to geometric SVG if no manifest), ProvMark (keeps the four labels, adds the hover and focus card).

10. System routes: app/not-found.tsx (Fog plate or fallback, copy from section 11.9), app/error.tsx, app/global-error.tsx, loading.tsx for every route with skeletons in final geometry.

11. Metadata: per-route title and description, openGraph and twitter images from V2-03 (use placeholders that are clearly labelled until assets land), themeColor per theme, icons.

12. Existing pages keep working inside the new shell with the new tokens even before their redesign phases. No page may be broken on staging at the end of this phase.

Screenshot loop (mandatory): every route at 390, 768, 1440 in Night and Day. View them. List defects. Fix. Re-shoot. Save finals to data/screens/v2/shell/.

CHECKPOINT: staging URL, screenshot paths, fonts verification, redirect checks, list of primitives, error map coverage (every custom error name listed with its sentence). STOP.
```

---

# V2-05. Time components (Claude Code, ~3 h)

```
V2-05. Re-read V2-DESIGN-SYSTEM.md sections 8 and 9 (SessionRail, MarketClocks, the Tape). These are Kerb's signature. They must be the best-built components in the app.

Bugs to fix from V1: the countdown renders a dash glyph once the transition passes because the clock is never refetched; day labels sit on the midnight tick, so each session reads as the next day's; /market shows the mainnet lead asset's strip even though the covenant runs on KerbClockDemo.

1. useClock(symbol) hook: fetch /v1/clock/:chain/:asset, refetch 60 s and immediately when now passes nextTransition.at (show "Updating" while in flight, never a negative or dash).

2. SessionRail with variants lanes, full, compact, demo:
   - day columns with centred labels "MON 21", thin day separators, session segments by kind, lunch as a notch, Last Call windows as brass hatching, 2 px ink cursor with a "now" flag, head row with RegimePill, session name, countdown and the time in UTC plus exchange local time.
   - lanes: New York and Hong Kong on one shared time axis and cursor, one row each, 132 px total at 1440, labels at left ("NEW YORK · XNYS", "HONG KONG · XHKG").
   - demo: reads /v1/credit/1952/demo-clock, draws one full demo cycle, labels "DEMO CLOCK · ONE TRADING WEEK PER HOUR", countdown to the next Last Call.
   - hover and focus on a segment shows a tooltip with start and end in UTC and local.
   - regime transition motion per section 8, disabled under reduced motion.
   - accessible description text as today.

3. MarketClocks: two rows (New York, Hong Kong) with city, market code, coordinates from /v1/board market metadata (V2-02), live local time ticking each second, session word from the clock. Compact variant for the header drawer and footer.

4. Tape: reads /v1/tape, renders a horizontal ticker per section 8 with asset, RegimePill small, C(1%), short tx link, age. Pauses on hover and focus; static list under reduced motion; labelled region.

5. Replace PageStrip: inner pages render the compact rail for the page's own subject (asset page: that asset; credit: demo; research: the report window; others: lanes compact). Delete the "the asset currently carrying the most capacity" note.

6. Unit tests for the geometry helpers (pct, day centring, segment clipping, countdown never negative) and a Playwright test that the countdown never shows a dash across a mocked transition.

Screenshots of every variant in both themes at 390 and 1440.

CHECKPOINT: screenshots, tests, a short screen recording (10 s) of a live transition on staging if one occurs, otherwise the mocked one. STOP.
```

---

# V2-06. Home (Claude Code, ~5 h)

```
V2-06. Re-read V2-DESIGN-SYSTEM.md section 11.1 and the reference posters' logic: left typographic stack, monolith on the right, annotation stacks with short rules, coordinates in the corner, crosshairs, one olive line.

Build app/page.tsx as the editorial home:

1. Hero (min-height 100svh minus header, max 900 px): construction layer with four corner crosshairs; left stack of tracked labels TOKENIZED EQUITIES / EXECUTABLE LIQUIDITY / MARKET TIME / X LAYER 196 with a 24 px rule; H1 display-xl "Credit on the" / "market's clock." (second line olive); lede "Tokenized stocks trade around the clock. Liquidation conditions don't. Kerb measures the exit in real X Layer pools, then lends against it."; buttons "Open the Board" (primary) and "Borrow on testnet" (secondary); tracked line NEVER LEND MORE THAN YOU CAN LIQUIDATE.; bottom-right tracked links BOARD / CREDIT / RESEARCH / PROOF. Right: ArtPanel P1 bleeding to the right edge with up to three live callouts from /v1/board (lead asset regime and C(1%), one HK asset regime, last post age). Top-right: MarketClocks. Mobile: art above the headline in the 4:5 crop, clocks move below the buttons.

2. The Tape directly under the hero.

3. Section "Every asset keeps its own hours.": SessionRail lanes plus three short sentences.

4. Section "Measured, not modelled.": three num-xl Kpis from /v1/stats and the latest report headline, each with ProvMark and a link.

5. Section "How a term is made.": ArtPanel P3 forest variant in a forest band (dark in both themes), five rows Clock, Depth, Mark, Terms, Credit, each one sentence plus the live value for the lead asset from /v1/report. Link to /methodology.

6. Section "How long should your loan survive without you?": Carry and Session Max side by side for the lead asset with live values, LtvLadder (build it now in src/components/kerb/LtvLadder.tsx per section 9, with the margin line from capacity.margins when kts is 0.2, or the fixed-margin sentence when 0.1), next cure deadline, button "Try it on testnet".

7. Section "The Board": top five rows of the new DataTable (build DataTable now; V2-07 extends it), link "All 10 assets".

8. Section "Verify everything.": forest band with mainnet contract AddressChips, Builder Code, CI test counts from /v1/proof, one sentence on reproducibility, button "Open the proof".

9. Data: server-render with revalidate 15 s; client refresh for live bits. If any source fails, that section shows its ErrorState; the page never fails as a whole and never shows a fake value.

10. Entrance motion per section 8, once.

The 10-second test: show the 1440 Night screenshot to a fresh model context with no other information and ask "What is this product and what can I do here?" Paste the answer into the checkpoint. Iterate until the answer names tokenized-stock credit that changes with market conditions.

CHECKPOINT: screenshots (both themes, 390, 768, 1440), the 10-second test answer, Lighthouse mobile scores. STOP.
```

---

# V2-07. Board and Asset (Claude Code, ~6 h)

```
V2-07. Re-read V2-DESIGN-SYSTEM.md sections 11.2 and 11.3.

BOARD
1. Header: tracked THE BOARD · X LAYER 196 · {n} ASSETS · {m} MARKETS, h1 "What each stock can safely support, right now.", live updated age; client refresh every 30 s via /v1/board.
2. KPI band from board.summary (In Last Call now, Executable at 1%, Debt capacity, Sources healthy, Last post), each Computed with ProvMark.
3. Filters: market segmented control (All, New York, Hong Kong, Metals) and regime chips that appear only when present. URL query reflects the filter.
4. SessionRail full for the selected row (row focus or hover selects; default first).
5. DataTable columns: Asset (ticker, underlying name, market code, local time), Regime, Credit Mark, C(1%) with DepthSpark, Terms (LtvLadder compact: Carry, Session Max, LT), Debt ceiling, Coverage, Next (name and countdown), Posted (age and tx). Whole row links to the asset. Sort with aria-sort. Numbers per the format standard.
6. Sources in a Disclosure "{n} sources reporting".
7. Mobile: card list per asset.

ASSET
8. Hero: ticker in display, underlying name, pool line with AddressChip, RegimePill, MarketClocks row for its market.
9. KPI band: Credit Mark (num-xl), Carry, Session Max, Liquidation (fixed), C(1%), Debt ceiling. Full LtvLadder with margin line. SessionRail full.
10. Tabs Overview, Liquidity, Mark, Terms history, Onchain, keyboard accessible, URL hash reflects the tab.
   - Overview: instrument profile, next transitions, a plain paragraph generated from live values: what Carry and Session Max mean for this asset right now and when the next Last Call opens.
   - Liquidity: rebuilt ImpactCurve (area, C markers, cross-check marker, hover readout), C(i) table, excluded venues with reasons.
   - Mark: MarkWaterfall with sources used and excluded (with reasons and ages).
   - Terms history: TermsHistory chart (debt ceiling and C(1%) with regime bands; Carry and Session Max lines on a secondary axis) over 72 h, table collapsed to 10 rows with "Show all".
   - Onchain: latest tx, input bundle hash (HashChip), retrievability status in the new wording, verify command in CodeBlock.
11. Unknown symbol renders the not-found page, not an error.

Screenshots, both themes, three widths, for Board and for KOx, HKEXCx, SLVx and COINx (a two-leg path).

CHECKPOINT: screenshots, E2E added for filter, sort, row click, tab switch, copy buttons. STOP.
```

---

# V2-08. Credit: the hero workflow (Claude Code frontend, Codex backend, ~7 h)

```
V2-08 (CLAUDE CODE). Re-read V2-DESIGN-SYSTEM.md section 11.4. This page is where the demo video's hero moment is filmed. It must work for a stranger with a fresh wallet.

1. Route /credit. Header: tracked KERB CREDIT · X LAYER TESTNET 1952 · DEMO CLOCK, h1 "Borrow against tokenized stocks, on the market's clock.", disclosure chip "Testnet · mirror collateral · risk from mainnet" opening a Drawer with the full explanation (mUSDG substitution and why, mirror relay from mainnet, the mirror LT relationship from V2-00, links to every contract on /proof).
2. SessionRail demo under the header with the live countdown to the next Last Call.
3. Left zone: collateral cards (kKOx, kHKEXCx) with RegimePill, Credit Mark, Carry and Session Max, next cure deadline, relayed-from line. Selecting a card drives the other zones. Below: "Get set up" checklist with live state per step:
   (1) Wallet on X Layer testnet: connect or switch (wagmi switchChain adds the chain if missing).
   (2) Test OKB for gas: read native balance; if zero, link to the official X Layer faucet (https://www.okx.com/xlayer/faucet) and re-check on focus.
   (3) Test collateral: mirror faucet button with remaining allowance read from the contract.
   (4) mUSDG (to supply or repay): mUSDG faucet button.
   Each step shows done, needed, or blocked with a reason.
4. Centre zone: Tabs Borrow, Supply, Repay, Withdraw.
   Borrow: the mode question as two large selectable cards (Carry and Session Max) with live borrowing power in mUSDG for the entered collateral, the difference "+{x} with Session Max", the cure deadline in UTC and local time for Session Max, "No cure events" for Carry. Amount Field with Max. Post-action preview (LTV and health after) computed from contract reads, not guessed. TxStepper for approve then borrow. Button label repeats the amount and mode.
   Supply, Repay, Withdraw: same Field + preview + TxStepper pattern.
5. Right zone: position panel. States: No position (empty state with the next step), Ready to carry (health large, LtvLadder with the brass diamond, current LTV, carry target, next Last Call), Last Call takeover (per section 11.4 wireframe: brass border draws in, cure amount and deadline, Repay and Add collateral buttons, the sentence that the liquidation line is not moving), Cured (small timeline Session Max to cure amount to Carry, tx link), Liquidatable (oxide, plain explanation). Poll the position every 5 s while a Last Call is open.
6. "Curable now" public table under the workspace from /v1/credit/1952/positions?state=curable: user AddressChip, collateral, mode, required repay, bonus, deadline, Cure button with TxStepper. Empty state: "No position needs a cure right now. The next demo Last Call opens in {t}."
7. Pool strip at the bottom: supplied, borrowed, available, utilisation, borrow rate, reserves.
8. Every transaction: Builder Code suffix preserved, toasts with OKLink, errors through lib/errors.ts.
9. Keyboard-only run through the whole borrow and cure flow.

V2-08 (CODEX).
A. Confirm V2-02 endpoints used here are live.
B. Demo position keeper (gate 6, needs operator approval and a new testnet-only wallet funded only from faucets): scripts/demo-keeper.ts opens a Session Max position on kHKEXCx at the start of each demo session phase, so that during every demo Last Call at least one curable position exists for visitors. If a visitor cures it, the keeper repays and reopens next cycle. Hard caps: testnet only (refuse any chainId other than 1952), max debt 2,000 mUSDG, never more than one open position, logs every action with tx hash to data/keeper.log, PM2 managed. If not approved, fall to the rung in AGENTS.md 12.8.
C. Run the real browser flow with the existing scripts/cure-from-ui.ts adapted to the new UI selectors: fresh wallet, faucets, deposit, borrow Session Max, wait for demo Last Call, cure, repay. Record the tx hashes in PROJECT_STATE.md and on /proof.

CHECKPOINT (joint): screenshots of every position state in both themes, the full tx list from the real browser flow, keeper log excerpt or rung, E2E results. STOP.
```

---

# V2-09. Research and Report #2 (Claude Code frontend, Codex data, ~5 h)

```
V2-09 (CODEX), Thu 24 Sep. HANDS OFF the collector and attester from 05:00 to 09:00 UTC.
1. 05:00 to 09:00: run scripts/window-watch.sh (health every 30 min, no restarts) and window-snapshot.sh at 06:30, 06:55, 07:05, 07:30 and 08:30 labelled campaign-pre and campaign-post.
2. After 09:00, generate Market-Time Report #2 from stored observations only: "What happened when the X Liquidity incentives ended". Window 23 Sep 07:00 to 25 Sep 07:00 UTC as far as data exists at publish time, clearly marked as partial if still accumulating. Include: per-pool in-range liquidity change across 07:00 on 24 Sep, C(1%) and C(3%) before and after from the snapshots, Credit Mark change, debt ceiling change, regime at each snapshot, a session-versus-closed comparison now that sessions exist in the record (Report #1 could not make it), gaps reported, sources, limitations, reproduce command. Findings may only state what the numbers show. If depth did not fall, say so.
3. Add human units: alongside L, report C(1%) in USDG for every asset at every snapshot. Also backfill C(1%) at start and end of Report #1's window from stored pool state and add it to Report #1 as an appendix without changing its original figures (label "added 24 Sep").
4. Publish via /v1/market-time/2 and update /v1/stats latestReport. Target 20:00 UTC.

V2-09 (CLAUDE CODE).
5. /research index per section 11.5: forest band hero with P2, serif title "Market-Time Reports", sub, featured latest report card (serif title, three num-xl findings, window, readings), list, and a "Scheduled" row for Report #2 with a live countdown until it is published.
6. /research/[id]: serif title, window line, three headline numbers, diverging bar chart of liquidity change by pool (sorted; oxide falls, moss rises; route legs separated and labelled), a window-against-sessions strip showing the observation window over both markets' sessions with the gap marked, findings as claim and evidence pairs, what the report does not show, sources, appendix table with units labelled, reproduce CodeBlock, Download JSON.
7. Report #2 adds the before and after table with change bars.
8. Day theme check: the research pages must look like a printed research note in Day.

CHECKPOINT: Report #2 URL and headline figure, screenshots of index and both reports in both themes. STOP.
```

---

# V2-10. Methodology, Proof, Developers (Claude Code, ~5 h)

```
V2-10. Re-read V2-DESIGN-SYSTEM.md sections 11.6 to 11.8.

METHODOLOGY
1. Sticky contents rail with scroll-spy (Regime, Depth, Mark, Capacity, Covenant, Reproducibility, Parameters, Limits); header with P3 and a version pill (KTS 0.2 or 0.1, params version).
2. Each section: diagram first (regime resolution order as a vertical ladder with the live regime highlighted; the live ImpactCurve; MarkWaterfall; LtvLadder with the margin explanation; covenant timeline), then the rule in two sentences, then the live worked example for BRK.Bx.
3. Parameters: grouped definition lists that wrap; nested objects become sub-rows (ladder values listed, not concatenated); Download JSON. There must be no horizontal scroll at any width. This fixes the V1 table that pushed every value off-screen.
4. If KTS-0.2 is live, section Capacity explains 0.2 and links the replay chart; if not, it states the 0.1 truth from KTS-0.2.md section 8.

PROOF
5. h1 "Kerb is independently verifiable." Status tile matrix per section 11.7 from /v1/proof and /health, every tile with state and link.
6. Disclosures: Contracts (vocabulary Sourcify exact match / partial / source in repo, verification pending), Latest Terms posts with decoded Builder Code per row, Build period (commits per day as a small bar chart, BUILD_PERIOD.md rendered), Data store (row counts, append-only triggers statement), Reproduce a report (inputs hash, bundle link, command, last verify result), Limitations (rungs).
7. P4 art on the right of the header.

DEVELOPERS
8. h1 "Read Kerb Terms from anywhere." Tabs SDK, REST, Solidity. Each: install line, 8 to 12 line example with copy, live response panel fetched client-side from the public API. "What you can build" (Lender, Venue, Agent) with one sentence and one line of code each. Endpoint table from docs/API.md. ABIs download.

CHANGELOG (P2, only if time): /changelog rendering BUILD_PERIOD.md with dates.

Screenshots both themes, three widths.

CHECKPOINT: screenshots, confirmation that no parameter value is off-screen at 390 and 1440, and that no verification cell reads "no". STOP.
```

---

# V2-11. Hardening and cutover (both, Thu until 20:00 UTC freeze)

```
V2-11. Re-read AGENTS.md sections 9 and 12.7 and V2-AUDIT.md section 10.

CLAUDE CODE
1. Playwright E2E suite in apps/web/e2e, run in CI against a fixture API (a small server replaying captured real responses from docs/API.md examples) and locally against production with pnpm e2e:live:
   home renders h1 and board rows or a labelled error; every nav link resolves and has a unique h1; redirects from /market, /reports, /reports/1; board filter, sort, row click; asset tabs and copy buttons; theme menu night, day, market persists without flash; wallet connect with an injected EIP-1193 mock that announces via EIP-6963, rejection shows "Connection cancelled" and the header stays clean; wrong network prompts the switch; credit demo rail countdown never negative across a mocked transition; credit borrow preview updates on input without sending; curable table renders or its empty state; methodology has no element wider than the viewport at 390; proof has no cell reading "no"; 404 page; at 390 no page scrolls horizontally; reduced motion leaves the Tape static.
2. Accessibility: axe on every route (zero serious or critical), keyboard path through Credit, focus rings everywhere, contrast checked for every token pairing in use.
3. Performance: replace blanket force-dynamic with revalidate where live-ness allows (board and home 15 s, research 300 s, methodology 60 s, proof 30 s) plus client refresh for live elements; hero image priority only; Lighthouse mobile on every route: Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95. Record scores.
4. Dead-button sweep: click every interactive element on every route in both themes. Each works, is removed, or is disabled with a visible reason.
5. Copy sweep: no em dash, no raw error text, number formats per standard, every label informative.

CODEX
6. Enable the e2e CI job as required. Make CI green.
7. Security pass on new endpoints: input validation for user and assetId params, bounded getLogs ranges, rate limit on /v1/credit/*/positions, no stack traces in responses.
8. Secret scan over the full git history.

CUTOVER at or before 20:00 UTC
9. Freeze features. Run the full E2E against staging. Run the golden path by hand on staging with a fresh wallet. Then cut staging over to usekerb.xyz with the recorded commands, verify every route on the apex, keep the rollback ready. Tag v2.0.0.

CHECKPOINT: CI run URL (green), E2E count, axe summary, Lighthouse table, dead-button sweep result, cutover time and verification. STOP.
```

---

# V2-12. Certification, video, submission (both plus operator, Fri 25)

```
V2-12. Re-read the Crucible sections on claims and submission, docs/v2/V2-DEMO.md, and V2-AUDIT.md section 10.

1. Create the Crucible files at docs/release/ with real evidence only: FINAL_AUDIT.md, HARDENING_PLAN.md (every H item with status), CLAIM_EVIDENCE.md (every public claim on the site, README and submission mapped to a tx, test, endpoint or file; anything unverifiable is removed from the copy), RELEASE_STATE.md (commit, tag, URLs, every address, working flows, known issues), JUDGE_CHECKLIST.md, DEMO_VERIFICATION.md (each video step, expected output, tested status, fallback), SUBMISSION_CHECKLIST.md.
2. README rewrite for judges: one-line thesis, the Home screenshot (Night), CI badge, "Watch the 3-minute demo" link, how it works in five lines (Clock, Depth, Mark, Terms, Credit), the KTS version and one sentence on what changed in 0.2 if live, deployments table with explorer links, "Try it" (four setup steps), verify-a-report command, tests, limitations (testnet credit plane with mirror collateral and why, unaudited, rungs), attribution and licences. No em dashes.
3. Video: operator records per V2-DEMO.md. Agents prepare the browser profile (fresh testnet wallet with test OKB, faucet balances pre-minted in a second profile for the takes that need them), close every notification, set the site to Night, 1440 x 900 viewport, and verify the demo clock phase so a Last Call lands inside the take.
4. Final cold check from a logged-out browser on another network: every route, every explorer link on /proof, the video link, the repo, the API health.
5. Submission form from docs/planning/SUBMISSION.md updated with V2 URLs and the video link. Operator submits by 18:00 UTC. Save the receipt to docs/release/.
6. After submission: collector, attester and keeper keep running; PROJECT_STATE.md final entry.

CHECKPOINT: every Crucible file path, README link, video URL and duration, form receipt, final RELEASE_STATE commit. STOP.
```

---

## If an agent drifts, paste this

```
Stop. Re-read AGENTS.md sections 2, 3 and 12. You are in Kerb V2. Only the phase you were given is in scope.
- Engine, contracts, collector and store are frozen except KTS-0.2's capacity function.
- One owner for CSS: Claude Code.
- No em dashes, no raw errors, no fake values, no dead buttons.
- Staging first; the apex changes only at the V2-11 cutover.
- Hands off the collector and attester Thu 24 Sep 05:00 to 09:00 UTC.
Report the CHECKPOINT block for what actually exists now.
```
