# BUILD_PLAN.md
## Kerb, 18 to 25 September 2026

Submission: **25 Sep 23:59 UTC** via the Dev Day form. Internal target: **18:00 UTC**, five hours of buffer.

Tiers. Each tier must be submittable on its own.

| Tier | Contents | Deadline |
|---|---|---|
| **T0** | Collectors running, engine producing Terms, mainnet Clock and Terms live, public Board, `/proof` v1 | End of D4 (Mon 21 Sep) |
| **T1** | Kerb Credit on testnet with Carry, Session Max, Last Call, Cure, Default. Market UI | End of D6 (Wed 23 Sep) |
| **T2** | Market-Time Report, Kerb Desk on OKX AI, SDK, external consumer, `kerb verify` | D7, only if T1 is green |

---

## D1 - Friday 18 Sep (today, partial day)

**The only thing that matters today: observations must be recording before the US close at 20:00 UTC, and through the weekend.** Everything else on this list is secondary to that.

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| K-01 | Repo scaffold, workspaces, TS strict, Foundry init, `AGENTS.md`, `BUILD_PERIOD.md`, `.env.example` | - | `pnpm typecheck` and `forge build` both pass on an empty project |
| K-02 | Chain config for X Layer 196 and 1952, viem clients, explorer link helpers | K-01 | A script prints the latest block on both networks |
| K-03 | Asset discovery: resolve the ten campaign pools to `token0/token1/fee/pool` and write `config/assets.json` with an explorer link and a verified-at timestamp per entry | K-02 | Ten pools resolved, each address independently confirmed by reading `token0()`, `token1()`, `fee()` |
| K-04 | `packages/adapters`: `AssetAdapter` interface plus `XStocksAdapter` (symbol, underlying, market code, decimals, wrapper if any, multiplier) | K-03 | Adapter returns a complete profile for KOx and HKEXCx from live data |
| K-05 | `apps/collector`: pool state loop (slot0, liquidity, tick bitmap and ticks spanning a configured range), price loop, multiplier loop, all writing append-only rows with content hashes | K-03 | Rows accumulating every 60s for all ten assets, visible in Postgres, with a source and hash on each |
| K-06 | Run collector on the VPS under PM2 with restart policy and a freshness alarm | K-05 | `pm2 status` healthy, `/health` returns per-source last-observation ages |

**Gate D1:** collector has written at least one full cycle for all ten assets and keeps running unattended. If the close at 20:00 UTC is already past when you get here, start anyway and note the start time in `PROJECT_STATE.md`.

---

## D2 - Saturday 19 Sep

Weekend, US and HK both closed. This is the cleanest `REFERENCE_CLOSED` data you will get, so protect the collector above all.

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| K-07 | `packages/v3math`: tick-walk swap simulation, exact-in and bisection for `C(i)` | K-01 | Unit tests reproduce a known swap outcome from a captured pool fixture within 1 bps |
| K-08 | Multi-hop path support and fragmentation factor | K-07 | `COINx/xETH -> USDG` path produces a compounded impact curve, path recorded |
| K-09 | `packages/calendar`: XNYS, XHKG (with the 12:00 to 13:00 HKT break), XCOM, holidays 2026 to 2027, DST | K-01 | Table-driven tests: 40 timestamps across both markets resolve to the correct session, including lunch, early close and DST weekends |
| K-10 | Clock resolution in TS: regime inputs, `nextTransition`, `nextWeakening`, cure window | K-09, K-05 | For any asset and timestamp, the resolver returns a regime and the next two transitions |
| K-11 | Mark: reference median, pool mid and TWAP, dispersion guard, regime haircuts | K-05 | Credit Mark computed for all ten assets, with provenance on each input |
| K-12 | Volatility and gap quantiles: historical daily series, 99th percentile by horizon, vol scaler | K-01 | Quantiles computed for the primary assets, dataset committed with its source and licence noted |

**Gate D2:** the engine can produce a full, labelled Terms object for KOx and HKEXCx from real observations, printed to stdout. Contracts not yet required.

---

## D3 - Sunday 20 Sep

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| K-13 | KTS capacity: stress capacity, liquidity capacity, position cap, Carry and Session Max, clamping | K-10, K-11, K-12 | Outputs match the worked shape in `docs/KTS-0.1.md`, all decimal strings |
| K-14 | Input bundle canonicalisation, keccak hash, Pinata pin, report assembly | K-13 | Bundle pinned, CID and hash recorded, re-running the engine on the pinned bundle reproduces identical outputs |
| K-15 | `contracts/KerbClock.sol` plus tests | K-09 | Fuzz test: contract regime equals TS resolver regime for 1,000 random timestamps across both markets |
| K-16 | `contracts/KerbTerms.sol` plus tests including every guardrail revert | K-15 | Tests prove: non-attester reverts, stale report reverts, out-of-bounds clamps, early loosening reverts, tighten applies immediately |
| K-17 | Deploy Clock and Terms to X Layer **testnet**, verify source | K-15, K-16 | Addresses in `PROJECT_STATE.md`, verified on OKLink |
| K-18 | `apps/attester`: sign EIP-712, post to testnet, retry and nonce handling, Builder Code data suffix | K-14, K-17 | Ten assets posting on a five minute cadence, suffix decodable from calldata |
| K-19 | `apps/web` skeleton and the Session Strip component with real regime data | K-10 | Strip renders live for KOx and HKEXCx, both themes, 390 and 1440 screenshots reviewed |

**Gate D3 (T0 half):** Terms are being posted on testnet every five minutes from real mainnet observations, and the Session Strip is rendering them.

---

## D4 - Monday 21 Sep

US market reopens 13:30 UTC. Capture the `RECOVERY` transition. HKEX lunch break at roughly 04:00 UTC is filmable today.

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| K-20 | Deploy Clock and Terms to X Layer **mainnet**, verify, start posting | K-18, operator approval | Mainnet addresses recorded, first `TermsPosted` transaction linked, Builder Code visible |
| K-21 | `apps/indexer` and `apps/api`: `/v1/board`, `/v1/terms/:chain/:asset`, `/v1/reports/:id`, `/v1/bundle/:hash`, `/health` | K-18 | Board endpoint returns all ten assets with regimes, marks, depth and terms, under 300 ms warm |
| K-22 | Kerb Board page, public, no wallet | K-19, K-21 | Ten assets, sortable, regime glyphs and words, provenance markers, stale and source-down states |
| K-23 | Asset page: impact curve chart, mark provenance, terms history, instrument profile, next transition | K-21 | KOx and HKEXCx pages complete, chart from real observations |
| K-24 | `/proof` v1: build period, onchain, data sections | K-20 | All values generated live, every address links to OKLink |

**Gate D4 = T0 COMPLETE.** If everything stopped here, this is already a submittable Build a Market entry: a live mainnet risk plane on X Layer with a public product on top. Say so in `PROJECT_STATE.md`.

---

## D5 - Tuesday 22 Sep

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| K-25 | `contracts/KerbCredit.sol`: supply, withdraw, deposit, withdrawCollateral, borrow with mode, repay, interest accrual | K-16 | Unit tests for each path, rounding tests, pause tests |
| K-26 | Cure and Default liquidation paths, `cureStatus`, close factor, bonuses | K-25 | Tests: cure before window reverts, cure size exact to target, default only below `LT`, both emit full events |
| K-27 | Invariant and fuzz suite | K-26 | The eight invariants in `docs/ARCHITECTURE.md` hold under fuzzing; run recorded |
| K-28 | `KerbMirror` testnet collateral with a capped faucet, plus testnet USDG wiring (Paxos testnet USDG, else `MockUSDG` labelled) | K-25 | Two mirror assets deployed and mintable, loan asset resolved, rung recorded |
| K-29 | Deploy Kerb Credit to testnet, list KOx and HKEXCx mirrors, seed supply | K-27, K-28 | Addresses recorded, one full lifecycle executed by script: supply, deposit, borrow Carry, repay |
| K-30 | `KerbClockDemo` with a compressed calendar for filming | K-15 | One demo week per hour, badged in the UI wherever it is read |

**Gate D5:** a scripted end-to-end lifecycle passes on testnet, including one cure.

---

## D6 - Wednesday 23 Sep

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| K-31 | Market UI: supply, deposit, borrow with the Carry or Session Max choice, positions, cure countdown, health | K-29 | A stranger can complete a borrow on testnet without instructions, mobile included |
| K-32 | Borrow confirmation panel showing regime, next cure deadline, exact cure amount, and the difference between modes | K-31 | Panel renders correct numbers pulled from `effectiveTerms` and `cureStatus` |
| K-33 | Cure execution UI, permissionless, with a clear explanation of who can call it and why | K-31 | Cure executed from the UI on testnet, tx linked on `/proof` |
| K-34 | `/methodology` page: KTS-0.1 rendered with the worked example and recompute instructions | K-14 | Page matches the spec file; no number on it is invented |
| K-35 | `/proof` v2: data and risk sections, recompute command, limitations including jurisdiction and testnet statements | K-24, K-14 | A reader can go from a displayed number to its bundle in two clicks |
| K-36 | Slither run, fix or document every finding, `SECURITY.md` | K-27 | Clean or explicitly justified, output committed |
| K-37 | Optional gate: mainnet Kerb Credit guarded launch | K-36, written operator approval, caps set | Only if invariants and Slither are green. Otherwise skipped and recorded as skipped |

**Gate D6 = T1 COMPLETE.** Feature work stops after this day except for the T2 list.

---

## D7 - Thursday 24 Sep

**Feature freeze at 12:00 UTC.** The X Liquidity campaign ends at 07:00 UTC, so the collector must be untouched and healthy from 00:00 UTC.

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| K-38 | Capture and analyse the campaign-end window, write Market-Time Report #1 from measured data only | K-05, K-21 | Report published at `/reports/1` with the raw observations linked; no claim without a number behind it |
| K-39 | `kerb verify` CLI | K-14 | `kerb verify <reportId>` recomputes and prints a diff, documented in the README |
| K-40 | Kerb Desk on OKX AI (A2MCP), tools and pricing, listing submitted | T1 green | Endpoint live, self-test passes, listing submitted, agent ID recorded. Skip without regret if T1 slipped |
| K-41 | SDK snippet and `/developers` page, offer read-only Terms to one other Dev Day team | K-21 | Snippet works from a clean project; outreach message sent |
| K-42 | Full QA matrix pass from `AGENTS.md` section 9 | everything | Every row ticked or explicitly marked not applicable with a reason |
| K-43 | Record the demo video, 2 to 4 minutes, target 3:15 | K-31, K-35 | Follows `docs/planning/DEMO.md`, no fake data, both live and recorded fallbacks captured |
| K-44 | README: thesis, screenshot, how it works, addresses, KTS link, run locally, tests, limitations | everything | A stranger can understand and run it |

**Gate D7:** video recorded, README complete, all links working from a logged-out browser on another network.

---

## D8 - Friday 25 Sep

No new features. Only verification, packaging and submission.

| ID | Task | Acceptance |
|---|---|---|
| K-45 | Cold verification: open every link from a different network and a logged-out browser, including explorer links, video link, repo link | All 200s |
| K-46 | Fill the submission form: team, track Build a Market, participation route, summary, repo, video, product link, declaration | Submitted by 18:00 UTC |
| K-47 | Post-submission: confirm the receipt email, park the collector so it keeps running, update `PROJECT_STATE.md` to final | Receipt saved |
| K-48 | Optional after submission: Market-Time Report #2, second cure demo, rehearsal for the finale | Only if submitted and green |

---

## Dependency spine

```
K-01 -> K-02 -> K-03 -> K-04 -> K-05 -> K-06        (data, D1)
K-07/08 + K-09/10 + K-11/12 -> K-13 -> K-14         (engine, D2-D3)
K-15 -> K-16 -> K-17 -> K-18 -> K-20                (risk plane, D3-D4)
K-21 -> K-22/23/24                                  (public product, D4)
K-25 -> K-26 -> K-27 -> K-28 -> K-29 -> K-31/32/33  (credit, D5-D6)
K-34/35/36 -> K-38..K-44 -> K-45/46                 (proof, evidence, submission)
```

---

## Standing kill list

Do not build before submission, no matter how tempting or how easy the agent says it is:

an AI risk score, a chatbot, a trading terminal, a portfolio tracker, a points or referral program, a token, a governance module, an upgrade proxy, a perp or options venue, a second chain, a bridge, a mobile app, social or comment features, a notification service beyond a single webhook, a custom charting library, a 3D landing animation, an email system, an admin CMS, a liquidator bot that spends money.

If one of these appears in a diff, revert it and log the incident.

---

## Daily discipline

- Start of day: re-read `AGENTS.md`, read `PROJECT_STATE.md`, check `/health` and the collector gap since the last run.
- Every three hours: confirm observations are still writing. A gap in the record is the only unrecoverable failure in this project.
- End of day: checkpoint block in `PROJECT_STATE.md`, one line in `BUILD_PERIOD.md`, commit and push.
- Any time you are about to write a number a user will see: ask which provenance label it carries. If the answer is none, stop.
