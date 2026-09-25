# PROJECT_STATE.md
## Living state. Update at every checkpoint. A new agent must be able to resume from this file alone.

Last updated: 23 Sep 2026. V1 and V2 complete (V2 live since the 22 Sep cutover, tag `v2.0.0`). V3 started 23 Sep: see the V3 section directly below.

---

## V3 (23 to 25 Sep 2026)

V3 makes Kerb Terms consumed by more than Kerb Credit (agents through x402, contracts through KerbQuote, developers through SDK and MCP), fixes stale first paint, and ships Report #2, the video and the form. Plan: `docs/v3/V3-BUILD-PROMPTS.md`; rules: AGENTS.md section 13. One agent (Claude Code) runs both lanes, single-agent order. Feature freeze Thu 24 Sep 22:00 UTC; code freeze and tag `v3.0.0` Fri 25 Sep 04:00 UTC. Protected windows: Thu 24 Sep 05:00 to 09:00 UTC and Fri 25 Sep 06:00 to 10:30 UTC, no production deploys.

### V3-00 CHECKPOINT 0 (23 Sep 2026, 10:50 UTC)

| Item | Reading |
|---|---|
| HEAD, CI | `51d3da2` (operator's pack upload), tree clean apart from untracked V2 screenshots and window captures; CI run 35848804786 success |
| Production web | live and staging both `9292a51` (`/root/kerb-deploy/*/releases/20260922T16*-9292a51`) |
| /health | newest observation 13 s old (87,255 pool rows); last post 196 at 10:43:44, 1952 at 10:43:57 |
| Last mainnet posts | MIXUx `0x12c14c0d…2347`, KUAIx `0x881ce830…c525`, COINx `0x1ec734ad…133f`, each about 1 min old, Builder Code decodes to `kt0hl6xyhlx8xmt` on all three |
| Keeper | `kerb-demo-keeper` not in PM2 (never started); `0xacCd…C0f4` holds 0 on 1952 and 196 |
| Report #2 | crontab in Europe/Berlin (UTC+2): window-watch Thu 05:00 UTC, campaign-pre 06:30 and 06:55, campaign-post 07:05, 07:30 and 08:30, window-end Fri 07:00; generator Thu 09:30 and 19:00, Fri 07:15 UTC. `--dry-run` wrote `data/reports/market-time-2.dry.json` (partial) |
| Deployer `0x0d63…53F2` | 196: 0.01688 OKB; 1952: 0.02545 OKB |
| Poster `0x1b95…0816` (pays attester gas) | 196: 0.00869 OKB, burned 0.00235 in the last 24 h, hard stop at 0.002, so about 2.8 days: stops around Sat 26 Sep 07:00 UTC. 1952: 0.02267, burned 0.00261 a day, about 7.9 days. The attester key itself holds nothing (signs only) |
| OKX Developer Portal credentials | yes (`OKX_DEX_API_*` in collector and secrets env); Payments permission cannot be read from the VPS |
| Pinning | last 24 h: 2,735 of 2,735 bundles retrievable, 0 from IPFS, 2,735 from the API |
| First paint (L-01) | first cold request 10:49:58 UTC: /board `generatedAt` 08:33:03 (2 h 17 m old), /credit terms `observedAt` 08:12:57 (2 h 37 m old); the next request 11 s later was fresh. /proof was 2 min old (recently visited). L-01 confirmed |

### Phases

| Phase | Lane | Target (UTC) | Priority | Status |
|---|---|---|---|---|
| V3-00 Kickoff, current truth, truth sweep | A | Wed morning | A0 | done 23 Sep: CHECKPOINT 0 below, truth sweep, `scripts/claims-check.sh` in CI |
| V3-01 Freshness guarantee | B (+A warmer) | Wed morning | A0 | **done 23 Sep**, live `3423fab`: first paint 9 to 32 s old (was 2 h 17 m), warmer `kerb-web-warmer` running, E2E `freshness.idle.spec.ts` green in CI incl. the lagged-render case (`--grep @lag`, run alone) |
| V3-02 Standing demo position | A | Wed morning | A0 | **running 23 Sep** (operator: go keeper, 0.025 test OKB): cycle 1 opened 11:32 UTC (borrow `0x6b3bf5f1…86ca`), stranger cure in a real browser on www 12:00 UTC (`0x5468b5ed…89ca`, data/keeper-cure-2026-09-23.json); 3-cycle observation continuing |
| V3-03 Kerb for Agents (x402, OKX.AI, MCP) | A | Wed afternoon, register by 18:00 | A1 | **x402 on MAINNET 23 Sep** (operator: go x402 mainnet); first paid call settled `0xb0befc3e64d4ba3e62bd2ab0b5be95ca720a1b2b787df0c6f6cf075a314e982e`, payer Kerb's own wallet `0xeB3e…2e8E` funded 0.10 USDT0 from the deployer. Not registered on OKX.AI (operator). Earlier: `kerb-agents` behind api.usekerb.xyz, public 402 verified, MCP 6 tools, facilitator accepts the existing OKX key on 196 and 1952. Listing skipped (operator). Settled payment waits on test USDT0 or the mainnet go (Requests) |
| V3-04 Term attribution | A then B | Wed evening | A1 | **done and live 23 Sep**: engine attribution (exact split, zero residual on 2,186 real changes), `kerb-attribution` job + `term_changes`, `/why` and `/changes`, UI on Asset, Credit, Home, Board; golden tests on 5 real pairs. Rung 1 |
| V3-05 Onchain consumers | A | Wed night, deploy Thu after 09:00 | A1 | **MAINNET 23 Sep 17:1x UTC** (operator: go consumers mainnet): KerbQuote `0x223d5e2a97d751403300b55aa92c88a42920e52a`, factory `0x6aababf6d83fcfb81459f8ffee3f6dd9b83d7f6f`, ten feeds, all Sourcify exact, 0.00014 OKB; cast quoteToken(BRK.Bx,10,Carry) max borrow 2,842.51 USDG at block 71414524. Rung 1. Testnet earlier: KerbQuote `0xfd688bc3…1c05`, factory `0xc363050c…be6b`, ten feeds, demo-clock KerbQuote `0x3caa62ff…6815`, all Sourcify exact; parity with KerbCredit fuzzed and live (block 41707514); mainnet fork tests green. Rung 3 until "go consumers mainnet" (about 0.00015 OKB) |
| V3-06 Exit evidence | A then B | Wed night or Thu | A2 | **done and live 23 Sep**: `exit_checks` per post, `/v1/exit`, Asset Exit check panel with strip, Proof counts |
| V3-07 Consumers and positioning surfaces | B | Thu | A1 | **done 23 Sep**: Home consumers, Developers four tabs with live KerbQuote read, Proof Agents tile and Consumers group, keeper-aware Credit, README first screen + FAQ, CLAIM_EVIDENCE rows |
| V3-08 Last Call alerts | B (+A) | Thu, cut first | A2 | **done 23 Sep** (browser notifications, open tab; no Telegram bot, no token given) |
| V3-09 Report #2 and dataset | A then B | Thu after 09:00 | A0 | prepared 23 Sep: generator gives per-asset verdicts, versions every run, marks partial/final; dataset `/v1/datasets/depth-hourly.{csv,json}` (hourly cron at :25, skips Thu 05-09 UTC); Research links, Home KPI label. Data half runs Thu after 09:00 |
| V3-10 Hardening, freeze 22:00 | both | Thu 16:00 to 22:00 | A0 | **done early, 23 Sep evening**: secret scan clean; append-only triggers refuse UPDATE/DELETE/TRUNCATE; 75 E2E pass on production (axe on every route, both themes); dead-button sweep 340 buttons, 0 dead (one timing false positive rechecked by hand); Lighthouse mobile on production: every route 85 to 100 performance, 98 to 100 accessibility, 96 to 100 best practices (GitHub run, after deferring the tour); 108 screenshots at 390/768/1440 both themes in data/screens/v3/final, no horizontal overflow. Feature freeze still Thu 22:00 UTC |
| V3-11 Certification, tag v3.0.0 | both | Fri 00:00 to 04:00 | A0 | not started |
| V3-12 Film and submit | operator + both | Fri 06:00 to 16:00 | A0 | not started |

### Operator actions

| # | Action | Deadline | Answer |
|---|---|---|---|
| 1 | Claim 0.02 test OKB from the X Layer faucet to the keeper `0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4`, write "go keeper" | Wed 23, when V3-02 asks | done: 0.025 test OKB, go keeper (23 Sep) |
| 2 | Onchain OS install and Agentic Wallet email login | Wed 23, early | |
| 3 | Confirm the OKX Developer Portal key (existing DEX key or a new one with Payments) and a receive-only X Layer address for payments | Wed 23 | resolved by test 23 Sep: the existing DEX key is accepted by the facilitator (getSupported lists 196 and 1952); payTo is the deployer address (the service holds no key) |
| 4 | Register the A2MCP ASP and request listing (agent drives, operator approves) | Wed 23 by 18:00 UTC | skipped by the operator (23 Sep); Kerb for Agents ladder rung 2 or 3, stated as such |
| 5 | About 2 USDT0 on X Layer mainnet in the Agentic Wallet | Thu 24 | |
| 6 | "go consumers mainnet" for KerbQuote and KerbMarkFeed | Thu 24 | |
| 7 | Hands off production Thu 24 05:00 to 09:00 UTC | Thu 24 | |
| 8 | Record the video, Fri 25 07:30 to 08:00 UTC | Fri 25 | |
| 9 | Fill and submit the form from `docs/v3/V3-SUBMISSION.md` | Fri 25 by 16:00 UTC | |
| 10 | Top up the mainnet poster `0x1b9587AD7e0bd6E1AC3588799999C62d0f0f0816` (added by V3-00, see CHECKPOINT 0) | before Fri 25 | done: 0.01 OKB from the deployer on the operator's word, `0x15b13b49…7ce3`; poster 0.01865 OKB, about 7 days |

### Requests

| Date | From | To | Request | Status |
|---|---|---|---|---|
| 23 Sep | A | B | Credit empty state: replace "Kerb does not keep a standing demo position" with V3-POSITIONING section 2 copy, reading `/v1/credit/1952/keeper` | done (V3-07) |
| 23 Sep | A | operator | x402 settled payment: either test USDT0 from the faucet to a payer wallet, or "go x402 mainnet" plus about 0.10 USDT0 moved from the deployer (holds 3.73) to a throwaway payer | open |

### V3 additions requested by the operator (23 Sep, beyond the pack)

| What | Where | Evidence |
|---|---|---|
| Your account: holdings, supplied liquidity, positions with LTV, health and Last Call, the address's own dated history, paid agent calls; any address via `?addr=` | `/account`, API `/v1/credit/1952/account/:address` | data/screens/v3/profile; linked from the wallet menu and footer, not the top navigation (13.10) |
| Docs: concepts, borrow and cure, REST and SDK, contracts, agents, verify, live addresses, limits, glossary | `/docs` | linked from Home, Developers and footer |
| Home motion: scroll reveal (script-added), layers light in data order, a pulse into the four consumers; off under reduced motion | Home | |
| Full credit cycle on production in a real browser: fresh wallets, Session Max borrow, Last Call, stranger cure, repay, withdraw | www.usekerb.xyz | `data/credit-flow-2026-09-23.json` |

### V3 deviations

| Date | Deviation | Why |
|---|---|---|
| 23 Sep | Docs added to the top navigation, and /faq, /whitepaper, /legal/* added | Operator request after a walkthrough (discoverability); AGENTS.md 13.10 lists new top-level navigation as killed, the operator overrides it |
| 23 Sep | An AI copilot was considered and declined; a deterministic guided tour, the FAQ and the "why" sentences serve onboarding | Guardrail 2 and 13.10: no model near the numbers; documented in docs/release/V3-GAP-AUDIT.md section 6 |
| 23 Sep | A first USDT0 funding send reverted (`0x29bf2074…`, empty recipient from a key-generation parse error); only gas was spent, no USDT0 moved; resent correctly | Script error, caught by the receipt status |
| 23 Sep | The paid mainnet call was made by a script with Kerb's own wallet, not an Onchain OS Agentic Wallet | OKX.AI and Onchain OS skipped by the operator; any x402 client is an agent to the endpoint, and the claim says it was our wallet |
| 23 Sep | The engine report's provenance note ("Produced by KTS-0.1 from the pinned input bundle") is left as it is; claims-check exempts that exact string | It is inside every posted report's byte-identical recompute (`apps/engine/test/recompute.test.ts` fails if it changes), so it is frozen engine output; UI and docs now say "published" |
| 23 Sep | One test row (`network = 't'`, id 1) sits in `agent_calls`: the append-only trigger was checked with a real insert and, correctly, refused the delete. `/v1/agents/stats` counts only `eip155:*` networks | Append-only by design; rolled forward, not deleted |
| 23 Sep | The agents value `amount` in asset tokens (one xStock), not wrapper shares: the Credit Mark prices the asset token (engine mark.ts); fixed the same day | Found while writing KerbQuote |
| 23 Sep | The live KerbQuote read and cast line use `quote(assetId, ...)`: on testnet the terms are keyed by the mainnet assetId, so `quoteToken` (which derives it from block.chainid) finds nothing there | Works on both chains; `quoteToken` stays for mainnet contracts |
| 23 Sep | README FAQ cites The Block, Aave and Chainlink sources by name without links; only the Morpho URL was given in the pack | No link is guessed |
| 23 Sep | The warmer requests the Next server on 127.0.0.1:3300 with the production Host header, not through Caddy | The ISR cache lives in Next; going through Caddy adds TLS and nothing else |
| 23 Sep | An empty paid request (no parameters) gets the 402 rather than a 400 | x402 clients and directories probe that way; a paid empty request is a 400 and is never settled |
| 23 Sep | `docs/planning/BUILD_PLAN.md` is exempt from claims-check like the master plan | It is the dated V1 plan and records what was intended on 18 Sep |

---

## V2 (21 to 25 Sep 2026)

V2 rebuilds how Kerb is experienced and makes one gated engine change (KTS-0.2). Plan: `docs/v2/V2-BUILD-PROMPTS.md`; rules: AGENTS.md section 12. One agent (Claude Code) runs both the backend and the frontend lane, by operator instruction.

### Phases

| Phase | Lane | Status |
|---|---|---|
| V2-K Kickoff and staging | backend | done 21 Sep: docs committed, staging built and served on 3301; public hostname waits on the `v2` DNS record |
| V2-00 Repo hygiene, CI, verification | backend | done 21 Sep: root clean, 38 em dashes to 0 with a CI check, CI green, five testnet contracts Sourcify exact match, mirror LT explained, pinning options below |
| V2-01 KTS-0.2 horizon-bound margins (gated, Tue 22 Sep 18:00 UTC) | backend | LIVE 21 Sep 19:38 UTC on operator's go: first 0.2 posts mainnet 0x6212668a35862bb6753ffb84ec9843665df3b3bff9fed5999bb65a5fca139577, testnet 0x4f43fb62a91c0ebf48ab081c460ca55eb613b07c5d61612cd643e431e5eec053. Confirmed across the 20:00 UTC New York close: KOx Carry 55.60% to 51.57%, Session Max 61.20% to 54.47% ([0x70acaeaa](https://www.oklink.com/xlayer/tx/0x70acaeaa192d81e4fa9a5f58d6aebd1b560df55dc0e2f8f704fec614d0f6d9c5) then [0xfcc7616f](https://www.oklink.com/xlayer/tx/0xfcc7616f8aca33137359880b38c67de3624b12d271410b64481841712dfd6f40)) |
| V2-02 API support for V2 | backend | done 21 Sep: board additions and summary, /v1/tape, /v1/stats, demo-clock, positions feed (rung 1, indexed from events), docs/API.md |
| V2-03 Art batch and brand assets | backend + operator pick | done 22 Sep with the operator's own plates (no API cost): five placed, mapped by content (docs/v2/ART.md); The Seal (upload 09) approved by the operator and placed on Proof 22 Sep in `787f66e`; AVIF and WebP derivatives, phone crop, blur placeholders |
| V2-04 Kerbstone foundation and app shell | frontend | done 21 Sep on staging: tokens and layers, fonts loaded, three themes, header, drawer, wallet sheet, error map, toasts, TxStepper, footer, 20 primitives, system routes, redirects, metadata; 60 screenshots in data/screens/v2/shell |
| V2-05 Time components | frontend | done 22 Sep: SessionRail full, compact, lanes and demo on tested geometry; countdown refetches at every transition (E2E across a mocked transition, video data/screens/v2/rail/transition-mocked.webm); MarketClocks from the API; the Tape; page rails about their subject (/credit shows the demo clock) |
| V2-06 Home | frontend | done 22 Sep: Kerbstone hero with the approved Night and Day plates, live callouts, Tape, lanes, measured KPIs, how a term is made, Carry against Session Max with the LTV ladder, Board preview, verify band. 10-second test passed (fresh model named tokenized-stock lending tied to market liquidity). Lighthouse mobile: performance 64 accessibility 96 best-practices 100; performance below the 85 target, hydration cost carried to V2-11 |
| V2-07 Board and Asset | frontend | done 22 Sep: Board with KPI band, URL filters, row-selected rail, sparklines, compact ladders, phone cards; Asset with KPI band, ladder with the KTS-0.2 margin line, tabs (overview from live values, impact curve, mark waterfall, 72 h terms history, onchain); 7 E2E tests pass |
| V2-08 Credit, the hero workflow | both | done 22 Sep on staging. Four real browser runs on X Layer testnet, every receipt checked: run 1 (old build; withdraw ran out of gas, which found the gas estimate bug), run 2 full lifecycle `data/credit-flow-2026-09-22.json` (shown on /proof), keyboard only `-keyboard.json` (Tab, Enter and arrows; no pointer), Day theme `-day.json` (its withdraw found the MAX rounding bug; finished through the UI after the fix). Fixed from the runs: gas padding, MAX exact and rounded down, a Last Call panel that says a cure already happened, wallet state gated until hydration (React 418 gone in the Day run). Screenshots of every reachable state in both themes: data/screens/v2/credit-states and credit-states-day. Liquidatable cannot be produced on testnet without moving a price; its panel is covered by review only. Keeper waits for the operator (rung 3 stated on the page) |
| V2-09 Research and Report #2 | both | frontend done 22 Sep (index with Scheduled row and countdown, report page with diverging bars, window strip with real gap positions from `/v1/market-time/:id/gaps`); data half (Report #2) runs Thu 24 Sep after 09:00 UTC. Captures are scheduled in root's crontab (local time, UTC+2): window-start Wed 07:00 UTC, window-watch Thu 05:00 to 09:00 UTC, campaign-pre 06:30 and 06:55, campaign-post 07:05, 07:30 and 08:30, window-end Fri 07:00 UTC; tested under cron's environment 22 Sep. Report #2 (`apps/engine/scripts/market-time-report-2.ts`, dry-run on the 21 Sep record) generates Thu 09:30 and 19:00 UTC and Fri 07:15 UTC, marked partial until the window closes. Report #1 C(1%) appendix done 22 Sep (`scripts/c1-appendix.ts`), original figures unchanged |
| V2-10 Methodology, Proof, Developers | frontend | done 22 Sep: contents rail with scroll-spy, live regime rule, 0.2 margins, wrapping parameters; Proof status matrix with live recompute against chain and per-row Builder Codes; Developers tabs with live responses; 5 E2E tests (no overflow at 390 and 1440, no bare "no"). The Seal plate was approved and placed on Proof 22 Sep (`787f66e`) |
| V2-11 Hardening and cutover (freeze Thu 24 Sep 20:00 UTC) | both | **done 22 Sep; cut over 16:00 to 16:02 UTC**, tag `v2.0.0` (`c8a72c0`). CI green with E2E required; 47 E2E (functional, links, shell, axe on 10 routes in both themes) pass on production via `e2e:live`; Lighthouse mobile on production 94 to 100 (a11y 99 to 100, best practices 96 to 100); 277 buttons, none dead; secret scan clean; golden path on the release build with fresh wallets, 13 txs all successful. Real-user walkthrough (`apps/web/scripts/walkthrough.mjs`, 90 page checks and 12 interactions) run on production, findings fixed and redeployed (`9292a51`). Caddy holds requests through a release swap (no 502). Rollback: `bash scripts/deploy-web.sh rollback live` |
| V2-12 Certification, video, submission | both + operator | not started |

### Operator decisions owed

| Decision | Needed by | Answer |
|---|---|---|
| DNS: A record `v2.usekerb.xyz` -> 62.171.182.75 (staging) | now | done; cert issued after a Caddy reload |
| Move the live site onto release directories (see V2 cutover, step 0) | before any live web deploy | **yes**; done 21 Sep 19:40 UTC, kerb-web now serves /root/kerb-deploy/live/current |
| Art batch cost approval, then the pick per plate (V2-03) | Mon 21 Sep | operator generated the plates; all six placed; P4 The Seal (upload 09) approved 22 Sep and placed on Proof in `787f66e` |
| KTS-0.2 go or no-go (V2-01) | Tue 22 Sep 18:00 UTC | **go**, written by the operator 21 Sep |
| Pinning: upgrade Pinata, switch provider, or keep API-served bundles (V2-00) | V2-00 | **C**, keep API-served bundles (operator, 21 Sep) |
| Mirror LT: align or explain (V2-00) | V2-00 | explained (API disclaimer, docs/ARCHITECTURE.md). Aligning is not possible without a redeploy: a listed threshold has no setter and relisting reverts `AlreadyListed` |
| Demo position keeper with a fresh testnet-only wallet (V2-08) | Wed 23 Sep | written, not started (`apps/attester/scripts/demo-keeper.ts`, PM2 entry `kerb-demo-keeper`); wallet 0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4 unfunded. Needs: approval to start, and 0.01 test OKB from the faucet (or approval to fund it from the deployer) |
| Video: operator's voice or captions only (V2-12) | Fri 25 Sep | |

### Requests

One agent asking the other lane for something. One line each.

| Date | From | To | Request | Status |
|---|---|---|---|---|

### Pinning, 21 Sep

Measured from the attester logs since their last rotation: mainnet 337 pinned of 1,543 posts, testnet 350 of 1,680, so about 21% overall and **0% since 01:56 UTC on 21 Sep**. `/v1/proof` over the last 24 hours: 498 of 2,140 distinct bundles on IPFS, 1,033 served by the API, 1,531 retrievable in total. The exact failure, reproduced with a one-file probe: `POST /pinning/pinJSONToIPFS` answers **403 `{"reason":"FORBIDDEN","details":"Account blocked due to plan usage limit"}`**; `/data/userPinnedDataTotal` reports 507 pins against the free plan's 500. Authentication itself still succeeds. Kerb produces about 2,100 distinct bundles a day.

| Option | Cost (not verified today, confirm at checkout) | Effect |
|---|---|---|
| A. Upgrade Pinata | about USD 20 a month on the first paid tier (50,000 files) | Pinning resumes at once with the same JWT and the same CIDs; at 2,100 a day that tier lasts about three weeks |
| B. Switch provider (Filebase, Storacha, 4EVERLAND) | free tiers exist but cap storage or files; a new account and key; a code change in `apps/engine/src/pin.ts` | Same CIDs (raw CIDv1 is provider-independent); some engineering and a new credential |
| C. Keep API-served bundles | none | Already live since K-43: every bundle is written to disk before posting and `/v1/bundle/:hash` serves it; `kerb verify` falls back to the API. `/v1/proof` now says so in the required words |

Recommendation: C now (zero cost, already true), and A only if the operator wants IPFS in the video.

### V2 cutover

Web builds never happen in a directory a live process serves from. `scripts/deploy-web.sh` builds each release in its own git worktree under `/root/kerb-deploy/<target>/releases/`, starts it on a spare port (`PORT + 9`) and checks `/`, `/board`, `/proof` and a stylesheet, and only then moves the `current` link and restarts the process. A failed build removes its own worktree and leaves the running site untouched. The previous release stays linked as `previous`.

| Target | Host | PM2 process | Port | Served from |
|---|---|---|---|---|
| staging | v2.usekerb.xyz (noindex) | kerb-web-v2 | 3301 | /root/kerb-deploy/staging/current/apps/web |
| live | usekerb.xyz, www.usekerb.xyz | kerb-web | 3300 | /root/kerb-deploy/live/current/apps/web (step 0 done 21 Sep) |

Staging deploy (any time):

```
bash scripts/deploy-web.sh staging main
```

Step 0, one time, moves the live site onto release directories (a few seconds of restart, same code):

```
bash scripts/deploy-web.sh live <ref-currently-live>      # builds and checks on :3309; its final restart is harmless
# in ecosystem.config.cjs set kerb-web cwd to "/root/kerb-deploy/live/current/apps/web"
pm2 delete kerb-web && pm2 start ecosystem.config.cjs --only kerb-web && pm2 save
curl -sI https://www.usekerb.xyz | head -1
```

Cutover (V2-11, Thu 24 Sep 20:00 UTC), after staging has passed the V2-11 checks:

```
git tag v2-cutover <sha-on-staging> && git push origin v2-cutover
bash scripts/deploy-web.sh live v2-cutover
curl -sI https://www.usekerb.xyz | head -1
```

Rollback (seconds, no rebuild):

```
bash scripts/deploy-web.sh rollback live
```

If step 0 has not been done, the rollback for a cutover is the V1 checkout itself: in ecosystem.config.cjs point kerb-web back at `__dirname + "/apps/web"` (which still holds the V1 `.next` build), then `pm2 delete kerb-web && pm2 start ecosystem.config.cjs --only kerb-web && pm2 save`.

---

## 1. Where we are

| Item | Status |
|---|---|
| Phase | 6 complete and evidenced end to end. Phase 7 is a 24 Sep phase: undated items done, dated items scheduled. Previously: /market with borrow, cure and the confirmation panel (K-31..33), /methodology (K-34), /proof v2 two-click bundles (K-35), Slither + SECURITY.md (K-36), verify from a chain hash (K-39), Market-Time Report #1 (K-38). K-37 mainnet credit NOT attempted: gated on written operator approval |
| Tier | T0 in progress |
| Collector | LIVE on VPS under PM2 (`kerb-collector`) since 2026-09-19 06:37:30 UTC. Health: `curl 127.0.0.1:8710/health` |
| Mainnet risk plane | **LIVE**: KerbClock and KerbTerms on X Layer 196, calendars and guardrails loaded, attester posting every 5 min (`kerb-attester-mainnet`) |
| Testnet credit plane | **LIVE**: KerbCredit, MockUSDG, KerbClockDemo and two mirrors deployed on 1952, both mirrors listed with a fixed LT, real mainnet Credit Marks relayed onto them |
| Web | **LIVE** at https://www.usekerb.xyz under PM2 (`kerb-web`), Caddy TLS. Session Strip, /board, /asset/[symbol], /proof; both themes, 390 and 1440 reviewed |
| Kerb Desk (OKX AI) | not started, P1 |
| Participation route | **REMOTE** |
| Demo video | not recorded (final-stage item, by the operator's instruction) |

---

## 2. Addresses and links (fill as they exist, never guess)

| Thing | Network | Address / URL | Verified |
|---|---|---|---|
| KerbClock | X Layer mainnet 196 | [0xf765d374e0ce576860a463f0d796ad45c62161b8](https://www.oklink.com/xlayer/address/0xf765d374e0ce576860a463f0d796ad45c62161b8) (block 71146758) | Sourcify exact match |
| KerbTerms | X Layer mainnet 196 | [0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5](https://www.oklink.com/xlayer/address/0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5) (block 71146760) | Sourcify exact match |
| KerbClock | X Layer testnet 1952 | [0x6c1de992e3219980138d7e51b67ecc523618bc5c](https://www.oklink.com/x-layer-testnet/address/0x6c1de992e3219980138d7e51b67ecc523618bc5c) (block 41420913) | Sourcify exact match |
| KerbTerms | X Layer testnet 1952 | [0x5a4942f55e37994370745ef984a21321edb75f7e](https://www.oklink.com/x-layer-testnet/address/0x5a4942f55e37994370745ef984a21321edb75f7e) (block 41420914) | Sourcify exact match |
| KerbCredit | X Layer testnet 1952 | [0xa1314645cd6c07e651359aba540e2600090b98a8](https://www.oklink.com/x-layer-testnet/address/0xa1314645cd6c07e651359aba540e2600090b98a8) (block 41483834) | source in repo, not yet verified |
| KerbClockDemo | X Layer testnet 1952 | [0xd2483b2d8bd759f87fadb21117498a5db36bcb0f](https://www.oklink.com/x-layer-testnet/address/0xd2483b2d8bd759f87fadb21117498a5db36bcb0f) (block 41483604). One compressed week per hour: 50 min session, last 10 min are Last Call | testnet only, never mainnet |
| kKOx mirror | X Layer testnet 1952 | [0x11827f0f59d516e3778951fde36bd0d961af4a16](https://www.oklink.com/x-layer-testnet/address/0x11827f0f59d516e3778951fde36bd0d961af4a16) (block 41483608), assetId 0x254b3d27…d8abb383 | MIRROR TESTNET, no claim on any security |
| kHKEXCx mirror | X Layer testnet 1952 | [0x80da4036ee45e6d66a27dba415a4ce23eb9360f2](https://www.oklink.com/x-layer-testnet/address/0x80da4036ee45e6d66a27dba415a4ce23eb9360f2) (block 41483611), assetId 0x848d3f1b…98b394bb | MIRROR TESTNET, no claim on any security |
| USDG | X Layer mainnet | 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8 | yes |
| USDG | X Layer testnet | 0xF0863D7A29a55d0c4263c11bFac754312ff078DF | real, but **not obtainable**: mint is permissioned and there is no faucet |
| MockUSDG (loan asset, testnet) | X Layer testnet 1952 | [0x91fcf99262214c32f6fe342d94c7b0dfb2dba679](https://www.oklink.com/x-layer-testnet/address/0x91fcf99262214c32f6fe342d94c7b0dfb2dba679) (block 41483601) | rung 2, labelled "MOCK TESTNET USDG (not USDG)" |
| Builder Code (mainnet) | dev portal | `kt0hl6xyhlx8xmt`, payout 0x0d63f9eeb86813230b72017444cea16cd4a453f2, registered 20 Sep 21:43 UTC, tx [0x84630999...](https://www.oklink.com/xlayer/tx/0x84630999c43302a99eaf9eda22fe22f4a1eaf3f61f2ac6ed5fcfc00558f19611) | registered |
| Builder Code | suffix `kt0hl6xyhlx8xmt` attached to every Kerb transaction from 20 Sep 20:55 UTC; posts before that carry the placeholder `kerb` | registry 0x00a3b805dbf39e5d54f9d09c130ff2132b4a0a21 | registered via the OKX developer portal |
| Repo | | github.com/Franlinozz/Kerb | yes |
| App | | [https://usekerb.xyz](https://usekerb.xyz) | LIVE on the apex and on www, TLS from Let's Encrypt. Operator added the A record 21 Sep; Caddy obtained the certificate on reload |
| API | | [https://api.usekerb.xyz](https://api.usekerb.xyz) | LIVE. /health, /v1/board, /v1/terms, /v1/clock, /v1/report, /v1/proof, /v1/reports, /v1/bundle | |

---

## 3. Assets under observation

| Symbol | Underlying | Market | Pool | Quote | Pool address | First observation |
|---|---|---|---|---|---|---|
| KOx | KO | XNYS | Uniswap V3 0.05% (on the V2 wrapper wKOx) | USDG | [0x273DA512f76129ED59a2D93D68dFe198423a3114](https://www.oklink.com/xlayer/address/0x273DA512f76129ED59a2D93D68dFe198423a3114) | 2026-09-19 06:37 UTC |
| HKEXCx | 388 (HKEX) | XHKG | Uniswap V3 0.05% (on the V2 wrapper wHKEXCx) | USDG | [0x293A6167Bed3A474b99f450dE817BC4474087Ed4](https://www.oklink.com/xlayer/address/0x293A6167Bed3A474b99f450dE817BC4474087Ed4) | 2026-09-19 06:37 UTC |
| BRK.Bx | BRK.B | XNYS | Uniswap V3 0.05% (on the V2 wrapper wBRK.Bx) | USDG | [0x34Fa7515d3364648F558aa876F73feC12e2bA507](https://www.oklink.com/xlayer/address/0x34Fa7515d3364648F558aa876F73feC12e2bA507) | 2026-09-19 06:37 UTC |
| MIXUx | 2097 (Mixue) | XHKG | Uniswap V3 0.05% (on the V2 wrapper wMIXUx) | USDG | [0x94D64ac04AC580a72fd481bCd1Ca7d83Bd4ac3b8](https://www.oklink.com/xlayer/address/0x94D64ac04AC580a72fd481bCd1Ca7d83Bd4ac3b8) | 2026-09-19 06:37 UTC |
| KUAIx | 1024 (Kuaishou) | XHKG | Uniswap V3 0.05% (on the V2 wrapper wKUAIx) | USDG | [0x9D5d95416412643004af849e012c894D4689a0f2](https://www.oklink.com/xlayer/address/0x9D5d95416412643004af849e012c894D4689a0f2) | 2026-09-19 06:37 UTC |
| ICEx | ICE | XNYS | Uniswap V3 0.05% (on the V2 wrapper wICEx) | USDG | [0x8D0167755eD35c534FE59DCf5a49EC6aed56736f](https://www.oklink.com/xlayer/address/0x8D0167755eD35c534FE59DCf5a49EC6aed56736f) | 2026-09-19 06:37 UTC |
| SHEINx | 625 (SHEIN) | XHKG | Uniswap V3 0.05% (on the V2 wrapper wSHEINx) | USDG | [0xF1ef85ce4691E94a32064b59E766c42183B44497](https://www.oklink.com/xlayer/address/0xF1ef85ce4691E94a32064b59E766c42183B44497) | 2026-09-19 06:37 UTC |
| COINx | COIN | XNAS | Uniswap V3 0.05% (on the V2 wrapper wCOINx) | xETH | [0x70131C43684B9Ba44677345f9b05f16E2b555edF](https://www.oklink.com/xlayer/address/0x70131C43684B9Ba44677345f9b05f16E2b555edF) | 2026-09-19 06:37 UTC |
| BMNRx | BMNR | XNYS | Uniswap V3 0.05% (on the V2 wrapper wBMNRx) | xETH | [0xcd5a3694a98986598D1F73A27438ba4BBbfa729b](https://www.oklink.com/xlayer/address/0xcd5a3694a98986598D1F73A27438ba4BBbfa729b) | 2026-09-19 06:37 UTC |
| SLVx | SLV (iShares Silver Trust) | ARCX | Uniswap V3 0.05% (on the V2 wrapper wSLVx) | USDC | [0xd510189E8b3684A101e0552835f3B6C2dE4af4a6](https://www.oklink.com/xlayer/address/0xd510189E8b3684A101e0552835f3B6C2dE4af4a6) | 2026-09-19 06:37 UTC |

Leg-two routes: xETH/USDG `0x6E18CEbFb9C5BBcf127b97a6daB026E941FfF6D5` (0.05%), USDC/USDG `0xbB9a35F790EA6eA9763b99e885f33BCF95860d40` (0.01%). Extra venues also observed: COINx/USDC, COINx/USDG (dust), BMNRx/USDG (dust). Full detail in `config/assets.json`.

Market codes and underlying identifiers must be confirmed by the adapter against the issuer's data, not assumed from the ticker.

---

## 4. Degradation rungs currently in force

| Subsystem | Rung | Note |
|---|---|---|
| Reference price | 2 (issuer data) plus a third-party check | xStocks price-data (returns quote:null for 7 of 10 on weekends) plus Yahoo chart as an independent Observed reference. Pyth Hermes now requires an API key (401); Chainlink Data Streams needs credentials |
| Executable depth | **1** | Exact tick-walk on the real pools (matches QuoterV2 to the wei), cross-checked against OKX DEX v6 aggregator quotes at the notional ladder; the conservative value is taken whenever divergence exceeds 25% |
| Loan asset on testnet | 2 | Real Paxos testnet USDG exists at 0xF086… but its `mint` is permissioned (an unauthorised caller reverts by name) and it exposes no faucet, drip or claim. `MockUSDG` is deployed in its place and says so in its own name; the real mainnet USDG stays wired into the mainnet config |
| Credit market deployment | 2 | Testnet live with mirror collateral; the mainnet risk plane is live. Mainnet KerbCredit needs written operator approval, green invariants and a clean Slither run (K-36, K-37) |
| Corporate action data | 1 partial + 2 | xStocks multiplier endpoint gives current, next and activation time; full corporate-actions endpoint needs an API key. Onchain multiplier() and wrapper convertToAssets polled every 10m |

---

## 5. Decisions

Format: date, decision, reason, alternatives considered, consequence.

| Date | Decision | Reason |
|---|---|---|
| 20 Sep | Mainnet deployment of KerbClock and KerbTerms approved in writing by the operator and executed. Cost 0.000279 OKB of a 0.0321 OKB balance. Neither contract holds funds | AGENTS.md gate 1 satisfied: plan and cost presented, approval given in chat |
| 20 Sep | Participation is remote | The submission and any finale participation are remote |
| 20 Sep | Bundles are pinned to IPFS through Pinata from 20 Sep 20:55 UTC | Operator supplied a JWT; a live probe confirmed Pinata returns the identical CIDv1 raw-codec hash the engine computes locally, so pinning does not change bundle identity |
| 18 Sep | Build a Market is the primary track | The product is a market and a risk primitive on X Layer; OKX AI participates only through the optional Kerb Desk |
| 18 Sep | Liquidation threshold is fixed, sessions move capacity and the cure covenant | Moving a liquidation line under a live borrower is indefensible and a technical judge will probe it first |
| 18 Sep | Depth is computed from Uniswap V3 pool state by tick-walk, not from an aggregator estimate | Reproducible, defensible, and the hardest component to copy |
| 18 Sep | Credit plane on testnet with mirror collateral | Backed lists Nigeria as non-serviceable; the builder does not acquire or route around the restriction |
| 18 Sep | Builder Codes are P0 | X Layer documents the ERC-8021 integration with viem and both mainnet and testnet registration paths |
| | | |

---

## 6. Telegram answers from OKX

| Date | Question | Answer | Source |
|---|---|---|---|
| | Testnet credit plane plus mainnet data plane acceptable for Build a Market? | | |
| | Official xStocks testnet deployment on X Layer? | | |
| | Canonical wrapper addresses and preferred reference source? | | |
| | Exchange OS or Trade Zone sandbox access? | | |
| | Finale 6 Oct or 7 Oct? | | |

---

## 7. Deviations log

One line each, every time the build departs from the plan.

| Date | Deviation | Why |
|---|---|---|
| 19 Sep | Collector started 06:37 UTC Sat, not before Fri 20:00 UTC close. The record has no data from Fri 20:00 to Sat 06:37 UTC | Build began after the close; nothing before 06:37 can be recreated and none will be backfilled |
| 19 Sep | Doc files renamed to the canonical names the pack uses (AGENTS.md, KERB-MASTER-PLAN.md, ARCHITECTURE.md, BUILD_PLAN.md, PROJECT_STATE.md, DEMO.md, SUBMISSION.md) | The committed files had different casing from every cross-reference |
| 19 Sep | Pools trade the xStocks V2 wrapper (wKOx etc.), not the rebasing token. Config records both; `poolToken: wrapper` | Found onchain; the base-token pools are empty or absent |
| 19 Sep | SLVx underlying is the iShares Silver Trust ETF on ARCX (NYSE Arca, US equity hours), not XCOM. SHEINx is XHKG. BMNRx is XNYS per issuer | Issuer data (xStocks exchange MIC), per PROJECT_STATE instruction to confirm against issuer |
| 19 Sep | Independent reference is Yahoo chart (unofficial, no SLA), not Pyth | Pyth Hermes price endpoints return 401 without a key. Pyth feed IDs kept in config; Pyth switches on when PYTH_API_KEY is set |
| 19 Sep | HK underlying prices recorded in HKD with a separate USD/HKD FX observation; conversion belongs to the engine (Computed) | Keep observations raw |
| 19 Sep | ARCHITECTURE.md does not spell out the AssetAdapter interface; it is derived from KTS-0.1 section 3.1 plus the halt flags from 4.2 | Gap in the spec |
| 19 Sep | Raw payload blobs are stored gzipped in Postgres (`blobs`, id `keccak256:0x...`) until IPFS pinning (K-14) | Smallest thing that records today |
| 19 Sep | Extra tables `obs_source_error` and `collector_cycles` (append-only) | Failures must be recorded, and gaps must be measurable |
| 20 Sep | Contracts deployed with `timelock` set to the deployer so calendars and guardrails could be loaded, then handed over with `setTimelock`. The role is no longer immutable | A real timelock cannot load 60+ calendar entries behind a delay during a hackathon; the handover path is tested |
| 20 Sep | XNAS, ARCX and XCOM share the XNYS calendar onchain (identical sessions and holidays). Each asset's true MIC is still reported offchain | Avoids storing the same 25 holidays three times |
| 20 Sep | Source verification is on Sourcify (exact match), not OKLink | OKLink's verification API needs an API key the operator has not supplied |
| 20 Sep | The Builder Code registry has no `registerAuto`; the real entry point is `register(string,address,address)` and it is permissioned | Verified onchain; the code `kerb` is unregistered but valid, and the ERC-8021 suffix is attached regardless |
| 20 Sep | STALE is decided from the age of the sources the mark actually used, not the oldest source of any kind | The xStocks feed returns no quote at weekends; it must not force every US asset STALE while an independent reference is fresh |
| 20 Sep | The OKX DEX quote API needs `OK-ACCESS-PROJECT` and a browser-style User-Agent; without either it answers 403 before checking the signature. v5 is deprecated, v6 is the live path | Found by testing the operator's credentials; recorded so the next person does not lose an hour to it |
| 20 Sep | The domain is **usekerb.xyz**; `userkerb.xyz` is not registered | Confirmed by RDAP and by the registrar's nameservers |
| 20 Sep | Historical bar data comes from Yahoo and is NOT redistributed: bundles pin derived stress statistics plus a keccak digest of the series (data/SOURCES.md) | Yahoo's terms do not permit redistribution; a licensed source needs an operator-supplied key |
| 20 Sep | BMNRx, MIXUx and SHEINx have less than five years of history (SHEINx listed Sep 2026, 14 bars). They use the most conservative gap quantile available and report historySufficient=false | The instruments have not existed for five years; Kerb does not invent history |
| 20 Sep | The Credit Mark is a two-pass computation: pass one measures dispersion with a zero haircut, pass two applies the resolved regime's haircut | KTS 6 needs the regime and KTS 4.2 rule 2 needs the dispersion |
| 20 Sep | `nextWeakening` horizon H is measured in underlying sessions spanned, and the gap quantile uses the matching close-to-close window | KTS 7.1 asks for "comparable intervals"; sessions are the comparable unit and this is stated as a v0.1 limitation |
| 20 Sep | Bundles carry an IPFS CIDv1 computed locally (raw codec, sha2-256); pinning is attempted only when PINATA_JWT is set, and the report records pinned vs unpinned | No Pinata credentials yet |
| 20 Sep | Multi-leg paths price the mark along the full path to the loan asset, not at the first leg | An xETH-quoted pool price is not a USD price; comparing it to a USD reference forced false STALE regimes |
| 20 Sep | A sale that cannot be filled reports amountOut 0 and no realised price | Reporting an intermediate leg's output as an outcome would be a fabricated number |
| 19 Sep | Collector tick coverage raised from +/-30% to +/-60% of spot at 07:2x UTC; earlier snapshots cover +/-30% | Large-notional curve points were ambiguous (range end vs no liquidity) |
| 19 Sep | Dust venues (own C(1%) below `minVenueC1` = 100 USDG) are excluded before aggregation, with the reason recorded | Otherwise a dust pool triggers the 0.8 fragmentation factor and lowers depth below the best single venue (seen on BMNRx) |
| 19 Sep | `nextWeakening` is defined as the next exit from the main (regular) session; `nextReferenceClosed` is reported separately | KTS-0.1 section 9 sample mixes the two; the cure deadline in the section 13 worked example is the regular close |
| 19 Sep | Default cure windows: US and XCOM 3600s, XHKG 1800s (so the HK lunch Last Call fits inside the 150-minute morning) | Configuration, versioned with the calendar |
| 19 Sep | Calendar covers 2025-12-01 to 2027-12-31 and refuses outside it. HK 2027 lunar dates are derived, not yet externally cross-checked | Pyth's HK schedule only lists 2026 |
| 20 Sep | **VPS ran out of memory at 16:45:56 UTC and the kernel OOM killer took down all five kerb PM2 processes.** They had never been written into the PM2 dump, so nothing resurrected them. Observation record gap 16:43:00 to 19:59:20 UTC, 3h16m22s, the largest in the build; none of it is recreatable and none will be backfilled. Restarted 19:59 UTC and `pm2 save` now persists all five | Kerb shares the box with the marque stack; memory pressure during a build killed the recorders and nothing was watching |
| 21 Sep | The web app was sending transactions with no ERC-8021 Builder Code suffix. AGENTS.md puts the suffix on every client that sends a transaction; only the attester had it | Fixed, and verified on chain: a faucet transaction signed in the browser, 0xd78958aa88a9dab92bffc112968b6e5ba2c95a2dd4d0def71795c21529740a88, decodes to `kt0hl6xyhlx8xmt` |
| 21 Sep | A cure sent from the UI repays 99.9% of the required amount rather than 100% | A report landing between the panel's read and the block makes the exact figure too large and `cure()` reverts with CureTooLarge. Cure is explicitly allowed to be partial, so the position lands a hair above target instead of not being cured at all. Measured: 55.013% against a 55% target. The panel says so |
| 21 Sep | The cure button sent the amount read when the panel last refreshed. A report landing in between makes that figure too large and `cure()` reverts with CureTooLarge | It now re-reads `cureStatus` at click time and leaves 0.1% of headroom. Cure is allowed to be partial, so erring low is safe; erring high is not |
| 21 Sep | The mirror relay ran only when invoked by hand, so mirror terms aged past `maxReportAgeSec` and `effectiveTerms` correctly became unusable | Moved into PM2 as `kerb-mirror-relay` on a 5-minute loop. The contract behaviour was right; a demonstration market that stops accepting borrows just reads as broken |
| 21 Sep | **Kerb Desk (P1, phase 7 item 3) is SKIPPED.** It needs an OKX AI account, an agent registration, a priced listing and settlement configuration | AGENTS.md gate 2 makes anything that bills an operator decision, and the phase prompt allows skipping it explicitly. Everything in P0 is green; this is the one optional item deliberately not taken |
| 21 Sep | K-37, the optional mainnet Kerb Credit launch, is SKIPPED and recorded as skipped | AGENTS.md rule 9 requires written operator approval plus green invariants and a clean Slither run. The invariants and Slither are green; the approval has not been asked for, because a mainnet credit market holding real money is not something to launch in a hackathon week. The mainnet risk plane holds no user funds |
| 21 Sep | Slither's two `missing-zero-check` findings on `KerbClock.setAdmin` and `KerbTerms.setAdmin` are documented rather than fixed | Both are `onlyTimelock` and cannot move funds; the contracts are already deployed and verified on mainnet, and redeploying the risk plane to add a require on a timelock-only setter costs more than it buys. Recorded in SECURITY.md |
| 21 Sep | The testnet loan asset is `MockUSDG`, not the real Paxos testnet USDG. Three ways in were tested: `mint(address,uint256)` exists but reverts for an unauthorised caller, and `faucet`, `drip`, `claim` and `supplyController` do not exist on the proxy | Degradation ladder rung 2. The substitute is labelled in its name, symbol and a DISCLAIMER constant |
| 21 Sep | Mirror guardrails use ltvMax 62% (KOx) and 57% (HKEXCx) with fixed LTs of 68% and 63%, above the real mainnet values | The first listing set ltvMax at the published Carry, which clamped Session Max down to equal Carry and made the cure covenant impossible to trigger. The LT must also clear Session Max or a position at its ceiling would be liquidatable the instant it opened |
| 21 Sep | The cure amount grosses up for the collateral the cure itself seizes: R = (debt - target*value) / (1 - target*(1+bonus)) | Repaying only the shortfall leaves the position above target, because the bonus is paid out of the same collateral. Caught by the unit tests, which is what they are for |
| 20 Sep | Builder Code changed from the placeholder `kerb` to the registered code `kt0hl6xyhlx8xmt` at 20:55 UTC. The 155 posts before that carry `kerb` in their calldata suffix | The portal registration only completed on 20 Sep 21:43 local; the earlier suffix is left on chain as it was recorded and is not rewritten |
| 20 Sep | Five kerb PM2 processes now run with `oom_score_adj=-800` (inherited from the PM2 daemon), and an 8 GB swap file `/root/.kerb-swap` was added on top of marque's 4 GB, with `vm.min_free_kbytes` raised to 256 MB | The recorders must never be the process the kernel chooses to kill; heavy builds in a shell are the correct victim |
| 21 Sep | `PROJECT_STATE.md` and `BUILD_PERIOD.md` stay at the repo root, outside the V2-00 root list | Every phase prompt names them at the root, and `/v1/proof` reads `BUILD_PERIOD.md` from there |
| 21 Sep | New attester bundles under `data/reports/bundles/` are git-ignored; the ten committed ones stay as fixtures | The API serves them from disk; about 2,100 a day would swamp the repo |
| 21 Sep | KTS-0.2 reads g(H) by calendar hours (square root of time under a day, variance interpolation between whole-session gaps beyond), not by sessions spanned. Written into docs/v2/KTS-0.2.md section 2.1 and stated in every 0.2 report | 0.1 counts almost every horizon, a weekend included, as one session, which would give Carry and Session Max the same gap and leave them flat again |
| 21 Sep | `kerb verify` recomputes from the engine config pinned inside the bundle, not from today's params file (on branch kts-0.2) | Otherwise every 0.1 bundle would stop verifying the moment the params file moved to 0.2 |
| 21 Sep | General Sans font files are not in git; `apps/web/scripts/fetch-fonts.mjs` fetches them from Fontshare at build time | The ITF Free Font License 2.0 allows self-hosting but forbids redistribution, including through a public repository |
| 21 Sep | Font stacks in tokens.css start with the next/font CSS variable before "General Sans" | next/font serves loaded faces under generated family names; the rest of section 3 is pasted as written |
| 21 Sep | Screenshots are committed as WebP (quality 72), not PNG | 60 full-page PNGs per phase came to 18 MB |
| 21 Sep | Footer Studio links carry no X handle yet | None is confirmed for Kerb or Xyndicate Labs; asked the operator |
| 22 Sep | Art mapped by what each image shows, not upload order: upload 3 is a Day kerb step (not The Record), and no upload shows The Seal | Visual inspection of all ten uploads; docs/v2/ART.md |
| 22 Sep | Home "How a term is made" has no art plate | The operator's art pass forbids the forest variant and asks for one plate per page; P1 already opens Home |
| 22 Sep | Terms history is two charts on one time axis, not one chart with a secondary scale | A dual-axis chart misleads; dollars and LTVs are drawn separately over the same regime bands |
| 22 Sep | The wallet layer (wagmi, viem) loads as an island in the header and wraps only /credit | It was hydrating on every reading page; Lighthouse TBT |
| 22 Sep | 404 copy is the operator's "No market here." rather than the design system's line | The operator's art brief, written later, replaces it |
| 19 Sep | One row with mode='test' in obs_source_error from verifying the append-only trigger; it cannot be deleted by design | Trigger verification |

---

## 8. Open blockers

| Blocker | Hypotheses tested | Current rung | Owner |
|---|---|---|---|
| ~~OKX DEX quote API credentials~~ RESOLVED 20 Sep | Needed key, secret, passphrase AND project id, plus a real User-Agent | Depth now rung 1 | done |
| Pyth Hermes price data needs an API key | v2 latest, legacy api/latest_price_feeds, hermes-beta and benchmarks all return 401 | Yahoo in use | Operator (optional) |
| ~~Pinata JWT~~ RESOLVED 20 Sep | Live probe: pinned CID == locally computed CID | pinning live | done |
| ~~Builder Code registration~~ RESOLVED 20 Sep | Portal registration, code `kt0hl6xyhlx8xmt` | attached to every tx | done |
| Root `usekerb.xyz` A record | www and api resolve to 62.171.182.75; the apex does not resolve at all | site not reachable on the apex | Operator |
| OKLink API key for source verification | Sourcify exact match used instead | rung 2 | Operator (optional) |

---

## 9. Checkpoint history

Paste each phase CHECKPOINT block here, newest first, so a fresh agent can read the build backwards.

```
V2-01 CHECKPOINT (21 Sep 2026)
Built: KTS-0.2 horizon-bound margins (computeCapacityV02, gapForHours), dispatch on bundle.kts,
       verify from the bundle's own pinned config, margins in /v1/report and on /v1/board rows,
       params 2026-09-22.1 (stressMultiplier 2.5, minCarryMargin 0.05, minSessionMargin 0.03).
Evidence: 93 engine tests (6 horizon cases + invariant sweep). Replay 3,286 real bundles over 72 h,
       0 guardrail breaches (data/reports/kts-0.2-replay.json, .svg). Fork: 1,357 of 1,359 posted
       through the real mainnet KerbTerms, 0 contract reverts, 2 local-node transport failures
       (data/reports/kts-0.2-fork*.json). kerb verify: stored 0.1 and fresh 0.2 bundles byte-identical;
       live 0.2 post 0x4f43fb62... reproduces (Session Max clamped tighter onchain by the loosen step).
       First 0.2 posts: mainnet 0x6212668a35862bb6753ffb84ec9843665df3b3bff9fed5999bb65a5fca139577.
       Regime change on chain, KOx at the 20:00 UTC close: Carry 55.60% -> 51.57%, Session Max 61.20% -> 54.47%
       (0x70acaeaa192d81e4fa9a5f58d6aebd1b560df55dc0e2f8f704fec614d0f6d9c5 -> 0xfcc7616f8aca33137359880b38c67de3624b12d271410b64481841712dfd6f40).
Decision: operator wrote "go KTS 0.2" on 21 Sep.
Deviations: g(H) by calendar hours (KTS-0.2 section 2.1); verify reads config from the bundle.
Next: V2-02
```

```
PHASE 6 CHECKPOINT, REVISED (21 Sep 2026)

The first pass shipped roughly 60% of this phase. Re-reading the prompt against the code found
real gaps, since closed. Recorded here rather than quietly fixed, because the gap list is the
useful part.

Gaps found and closed:
  1. The web app sent transactions with NO ERC-8021 Builder Code. AGENTS.md puts the suffix on
     every client that sends a transaction; only the attester had it. This was a P0 miss.
     Verified on chain twice: a faucet from the browser
     (0xd78958aa88a9dab92bffc112968b6e5ba2c95a2dd4d0def71795c21529740a88) and the cure below.
  2. No supply or withdraw for lenders: the whole lender side was missing from the UI.
  3. No positions list and no position card.
  4. The mode choice was a pair of radio buttons, not the plainly-worded question the phase asks
     for, and it compared the two modes in percentages rather than in loan-asset amounts.
  5. No parameter table on /methodology.
  6. No /reports index.
  7. The mirror relay ran only by hand, so mirror terms aged out and the market read as broken.

Evidence:
  Cure executed FROM THE UI by a second account, in a real browser:
    0x91c401511bf9839965318559a504f5c574aee37c19a0eec95baaddfb2590bbf9
    block 41514829, gas 153,904, LTV 60.00% -> 55.013% against a 55% Carry target,
    debt 3,347.24 -> 2,716.44 mUSDG, calldata carries Builder Code kt0hl6xyhlx8xmt.
  Slither 0.11.6: 67 results, none High, every one dispositioned in SECURITY.md.
  Eight pages shot at 390 and 1440 in both themes, reviewed, no console errors.
  Full AGENTS.md section 9 QA matrix in QA.md, every row evidenced or explicitly N/A.

Defects the screenshot loop caught in this pass:
  - "Connect a wallet" rendered four times on /market, once beside every action panel.
  - The /developers SDK snippet used Number(raw)/1e18, a float on a value path.

Deviations: a cure sent from the UI repays 99.9% of the required amount, so a report landing
  between the read and the block cannot revert it. The position lands a hair above target and
  the panel says so.

Blocked: none.
Next: phase 7 dated items on 24 Sep.
```

```
PHASE 6 CHECKPOINT (21 Sep 2026)
Built: /market with the borrow flow and the KTS section 8 confirmation panel (regime, what Carry gives
       versus Session Max, the cure deadline, and the exact cure amount at the current mark, computed
       with the same gross-up the contract uses); a permissionless cure panel that takes any address;
       wallet, wrong-chain, signing, pending, rejected and reverted all named as states rather than
       swallowed. /methodology, KTS-0.1 worked through on live measured numbers. /proof v2: every
       published number reaches its own pinned bundle in two clicks. /reports/1, Market-Time Report #1.
Evidence: 494 TypeScript and 106 Solidity tests green. Slither 0.11.6: 67 results, NONE HIGH, every
       finding dispositioned in SECURITY.md with raw output under data/security/.
       `kerb verify <inputsHash>` now resolves the pinned CID, fetches the bytes from IPFS, checks they
       hash to that CID, recomputes the report and compares it with what is on chain. Verified live:
       0x52d881266eed633ab208714f497e22bc9be6aab25e1b1013ff555e055ecce688 reproduces the posted terms,
       with debtCeiling correctly identified as clamped tighter onchain by the loosen cooldown.
       Market-Time Report #1: 42.25h, 35,130 readings, 15 pools. In-range liquidity fell on 7 of 10
       asset pools across a closed weekend, largest fall MIXUx -49.12%, largest rise SLVx +4.94%.
       The 3h16m hole in the record is reported in the report's own window, not interpolated across.
       24 screenshots at 390 and 1440 in both themes, all reviewed, no console errors.
Rung: unchanged. Depth 1, reference 2 + Yahoo, IPFS pinning live, Builder Code registered,
       credit market deployment 2 (testnet with mirror collateral).
Deviations: none new beyond section 7.
Blocked: apex usekerb.xyz A record (operator). K-37 mainnet KerbCredit NOT attempted and recorded as
       skipped: it needs written operator approval, and the risk plane on mainnet holds no user funds.
Next: demo video (final-stage), repo public before submission, regenerate the report on the day
```

```
PHASE 5 CHECKPOINT (21 Sep 2026)
Built: KerbCredit (isolated market, shares both sides, two-slope kink interest with a reserve factor,
       Carry and Session Max modes, the cure covenant, default liquidation at a FIXED liquidation
       threshold, guardian pausing that can never block repay/cure/liquidate/withdraw-to-safety),
       KerbMirror, KerbClockDemo, MockUSDG, the credit read API and the /market page.
Addresses (X Layer testnet 1952):
       KerbCredit    0xa1314645cd6c07e651359aba540e2600090b98a8  block 41483834
       MockUSDG      0x91fcf99262214c32f6fe342d94c7b0dfb2dba679  block 41483601
       KerbClockDemo 0xd2483b2d8bd759f87fadb21117498a5db36bcb0f  block 41483604
       kKOx mirror   0x11827f0f59d516e3778951fde36bd0d961af4a16  assetId 0x254b3d27...d8abb383
       kHKEXCx       0x80da4036ee45e6d66a27dba415a4ce23eb9360f2  assetId 0x848d3f1b...98b394bb
Tests: 106 Solidity (41 KerbCredit unit, 8 invariants under a guided handler at 16,384 calls per run,
       5 handler-coverage, 4 fork against real mainnet state, 7 demo clock, 6 mirror, 28 KerbTerms,
       12 + 2 KerbClock) and 493 TypeScript. All green.
Invariants: debt <= supply + reserves; shares and assets agree on both sides; collateral fully backed;
       token solvency; no position owes more collateral than it holds; cure never exceeds debt; the debt
       index only rises. Ceilings and the healthy-position rule are asserted in the handler at the moment
       of each successful borrow, cure and liquidation, where the pre-state is still known.
Lifecycle on chain (one compressed demo week per hour):
       supply             0xb97782bf0c8c382e3703b5e0f5828cfc3d04e3d8241e87baa7f32cb887dd017e   gas  81,092
       trim collateral    0xa9f6c5fca7c2a9293d0e55b27d2b1c968dfb7568deb35eab6001fe6aa0a092b2   gas 124,378
       borrow Session Max 0x561ec1a9a436aaf58606c9dce3d23088637bad7bc153707efc1e1a72d91ef653   gas 185,804
       cure (by another)  0xc1d0be1ae6330f99e668cd3b4b71253185f1e1d414205200a6e87013959c92d5   gas 171,004
       repay              0x927cca44d7bc4e112a4c1ea93eb8f1fbfe980bc683a258f4647228a56e502224   gas  86,407
       withdraw           0xa9f4ca3e77f6ed4bd2df782fbe389bf7ee1d177f45b82e2ca20b7b599d6836eb   gas  53,183
Cure computed vs executed: 1202.094527 mUSDG computed, 1202.092123 executed, a difference of
       0.002404 mUSDG. Position LTV 64.1666751989508183% -> 55.0000525402915174% against a 55% target:
       it lands a hair ABOVE target, never below, because repayment burns debt shares rounded down.
       Rounding favours the protocol, as required.
Rung: loan asset on testnet 2 (real Paxos testnet USDG has a permissioned mint and no faucet),
      credit market deployment 2 (testnet with mirror collateral, mainnet risk plane live),
      depth 1, reference 2 + Yahoo, IPFS pinning live, Builder Code registered
Deviations: see section 7 (MockUSDG, mirror guardrails leaving room above Carry, the cure gross-up)
Blocked: apex usekerb.xyz A record (operator). Mainnet KerbCredit is gated on K-36 Slither and written
      operator approval, and is not attempted.
Next: K-32 borrow confirmation panel, K-33 cure from the UI, K-34 methodology, K-36 Slither
```

```
PHASE 4B CHECKPOINT (20 Sep 2026)
Built: apps/web on Next.js: the Session Strip (trading week band, live cursor, Last Call window, regime in
       words with its glyph, one orchestrated motion on regime change, nothing under reduced motion),
       / landing, /board (sortable, every number with its provenance marker, source health), 
       /asset/[symbol] (impact curve from real pool observations, mark provenance, cross-check, clock,
       terms history), /proof (generated entirely from live state).
       New API surface: /v1/clock, /v1/report, /v1/proof.
Evidence: live at https://www.usekerb.xyz (TLS via Caddy, PM2 kerb-web); API at https://api.usekerb.xyz.
          16 screenshots at 390 and 1440 in both themes in apps/web/shots, all reviewed, no console errors.
          493 TypeScript tests (19 new for the display arithmetic) and 42 Foundry tests pass.
Defects found by looking at the screenshots and fixed:
          1. /v1/terms declared WAD for debt ceiling and executable depth, which are posted in loan-asset
             units: every such number rendered as 0.00 and every SDK consumer would have been wrong by 1e12.
             Fixed at the API with a regression test against the board's own numbers.
          2. The REFERENCE_CLOSED glyph used the session-band tone and was invisible at 10px in both themes.
          3. The impact curve's last point sat on the frame; the C(1%) label overflowed on narrow curves.
          4. Tables at 390 wrapped and truncated instead of scrolling; now single-line with a fade and a
             worded hint.
          5. shortHash(h, 7, 0) printed the whole hash, because slice(-0) is slice(0). Regression test added.
Rung: unchanged from 4A, except IPFS pinning now live (rung 1) and the Builder Code registered
Deviations: apps/web is the frontend agent's directory but the API additions it needed were made in
            apps/api by the same agent, recorded here per AGENTS.md section 5
Blocked: apex usekerb.xyz A record (operator)
Next: phase 5, Kerb Credit
```

```
PHASE 4A CHECKPOINT (20 Sep 2026, written 20 Sep 21:00 UTC after the OOM recovery; the phase itself
completed 15:44 UTC and the session hit its usage limit before the block could be written)
Built: X Layer MAINNET risk plane (KerbClock + KerbTerms on chain 196, Sourcify verified, calendars and
       guardrails loaded, mainnet attester posting all ten assets every 5 min), apps/indexer, apps/api, packages/sdk
Evidence: KerbClock 0xf765d374e0ce576860a463f0d796ad45c62161b8 (block 71146758),
          KerbTerms 0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5 (block 71146760). Deploy cost 0.000279 OKB.
          First mainnet TermsPosted 2026-09-20T15:00:53Z. 96 mainnet + 228 testnet posts for 0.000504 OKB total.
          Indexer: 7 tests pass, including restart-from-cursor and duplicate-delivery idempotency.
          API latency over 10 samples each: /health p50 24ms, /v1/board p50 2ms p90 3ms, /v1/terms p50 7ms.
          Commits e2865b1 (K-20), a923601 (K-21).
Rung: depth 1, reference 2 + Yahoo, IPFS pinning LIVE from 20:55 UTC, Builder Code registered and attached
Deviations: see section 7, including the 3h16m22s observation gap caused by the OOM kill at 16:45:56 UTC
Blocked: root usekerb.xyz A record (operator), OKLink API key and Pyth key (both optional)
Next: phase 4B (web), then phase 5 (KerbCredit)
```

```
PHASE 3 CHECKPOINT (20 Sep 2026)
Built: KerbClock + KerbTerms (X Layer testnet, Sourcify verified), calendars and guardrails loaded onchain,
       attester posting under PM2, ERC-8021 Builder Code suffix on every transaction
Evidence: 42 contract tests. Clock equivalence: 1,000 timestamps across XNYS and XHKG, contract == TypeScript.
          KerbClock 0x6c1de992e3219980138d7e51b67ecc523618bc5c, KerbTerms 0x5a4942f55e37994370745ef984a21321edb75f7e.
          44 TermsPosted transactions in the first 2.66h; Builder Code "kerb" decoded from calldata
          (tail 6b657262040080218021802180218021802180218021).
          Gas: ~0.00076 OKB/day, poster 0x1b9587AD7e0bd6E1AC3588799999C62d0f0f0816 holds 0.0299 OKB (~39 days).
Rung: depth 2, reference 2 + Yahoo, IPFS CID computed but unpinned, Builder Code suffix attached but unregistered
Deviations: see section 7 (timelock handover, shared US calendar, Sourcify, registerAuto, STALE source rule)
Blocked: OKX DEX credentials, Pinata JWT, OKLink API key, Builder Code portal registration, mainnet deploy approval
Next: phase 4
```

```
PHASE 2 CHECKPOINT (20 Sep 2026)
Built: Credit Mark, stress statistics from 15,985 ingested daily bars, KTS capacity, regime machine with
       tighten-fast/loosen-slow, input bundles (canonical + keccak + CIDv1 + optional Pinata), kerb report/verify
Evidence: 433 tests. Ten historical bundles recompute BYTE-IDENTICALLY (test/recompute.test.ts).
          Reports for KOx, HKEXCx, BRK.Bx, SLVx in data/reports/kts/. CIDs computed locally, pinning pending a JWT.
Rung: depth 2 (no OKX DEX credentials), reference 2 + Yahoo third-party, corporate actions 1-partial + 2,
      IPFS pinning: CID computed, not pinned (no PINATA_JWT)
Deviations: see section 7 (history not redistributed, short-history assets, two-pass mark, path-priced mark)
Blocked: OKX DEX credentials, Pinata JWT, licensed history source (all operator)
Next: phase 3
```

```
PHASE 1 CHECKPOINT (19 Sep 2026)
Built: packages/v3math exact tick-walk (QuoterV2-exact), C(i) bisection, multi-hop + aggregation; OKX DEX cross-check client; packages/calendar XNYS/XNAS/ARCX/XHKG/XCOM 2026-27 + Clock resolver; apps/engine depth assembly + depth-report
Evidence: 365 tests (types 14, calendar 132, adapters 13, v3math 192, collector 6, engine 8); data/reports/phase1-depth-2026-09-19.txt; C(1%) USDG: BRK.Bx 27663, KOx 16864, HKEXCx 12808, KUAIx 12600, BMNRx 12455, MIXUx 11072, COINx 8449, SHEINx 7526, ICEx 7273, SLVx 4063
Rung: depth 2 (no OKX DEX credentials); reference 2 + Yahoo; corporate actions 1-partial + 2
Deviations: see section 7 (dust venues, coverage +/-60%, nextWeakening definition, cure windows, calendar coverage)
Blocked: OKX DEX API credentials (operator)
Next: phase 2
```

```
PHASE 0 CHECKPOINT (19 Sep 2026)
Built: workspace scaffold, types, chain config + chain:ping, asset discovery (10/10 resolved), XStocksAdapter, append-only collector live under PM2 with /health
Evidence: first live observation 2026-09-19T06:37:30Z; 15 pools/min, 11 Yahoo + 3 xStocks prices/30s, 20 multiplier rows/10m; commits e2ba73e..5b90786
Rung: reference 2 (+ Yahoo third-party), depth not yet computed, corporate actions 1-partial + 2
Deviations: late start (no data Fri 20:00 to Sat 06:37 UTC), wrapper pools, SLVx on ARCX, Pyth needs key
Blocked: none
Next: phase 1
```

### 24 Sep 16:10 UTC
- Report #2 corrected (captures sorted by capturedAt): C(1%) held at the 07:00 cliff for all 10; by 08:30, 5 of 10 fell 10% or more (HKEXCx -82.80%), KOx +100.13%; HK close at 08:00 UTC noted as a confounder. Status partial; final regenerates Fri 07:15 UTC. Research page has a "C(1%) later" column; Home KPI shows the largest fall.
- npm: `kerb-sdk@0.1.0` published (`npm i kerb-sdk`), Developers updated. L-07 done.
- Telegram: @KerbAlertsBot live, linked from Credit (Last Call line), Docs and FAQ.
- Live and staging serve 4fe7061. OKX.AI: waiting on operator login (session d2b2e7c3).

### 25 Sep 01:15 UTC
- OKX.AI: ASP agent #13887 "Kerb" registered on X Layer (tx 0x942ea858…58e6) with two A2MCP services (Kerb Credit Check, Kerb Exit Check, 0.01 USDT per call); avatar set to the operator's logo (tx 0x22576fbd…baa); listing submitted, status under review (OKX: up to 48 h, notices to the linked email). config/agents.json listingStatus = under_review; flip to listed only on OKX's approval email.
- Owner wallet: OKX Agentic Wallet 0xce283b5c2b850ab8c4a6e635ea5add0c9a52d0ef. okx-a2a daemon installed (systemd user autostart) because listing requires A2A readiness.
- Brand: operator's mark and wordmark (docs/brand-assets) live in header, drawer, footer, large footer word, favicon, apple icon, OG cards, README banner; team-display.png is now the new mark. Live = d8ea531.

### 25 Sep 03:00 UTC, V3-11 certification
- Operator requests done: Developers and Docs menus; tour rebuilt (anchored spotlight, chapters, live facts, closing card); system diagram (README, Home, Docs); README rebuilt with screens and evidence; llms.txt, sitemap, robots.
- Fixed during certification: `kerb verify` works with no database (chain read); keeper kKOx fallback (none opened since 24 Sep 09:04); settled-call count excludes four unconfirmed review calls; Research #2 KPIs lead with 08:30; proof age clamp.
- Crucible: FINAL_AUDIT.md, verdict SHIP, 0 critical blockers. Evidence in data/release/crucible-2026-09-25/.
- Demo Last Call times 06:53:58, 07:53:58, 08:53:58, 09:53:58 UTC (DEMO_VERIFICATION.md). No deploys 06:00 to 10:30 UTC.
- CODE FREEZE, tag v3.0.0.
