# V3-BUILD-PROMPTS.md
## Kerb V3: paste-ready phases, 23 to 25 September 2026

Paste one phase at a time. Wait for its CHECKPOINT. Check it against the acceptance lines. Then paste the next. Every prompt assumes `docs/v3/*` is committed and `AGENTS-V3-ADDENDUM.md` is appended to `AGENTS.md` as section 13.

**Two lanes** (two Claude Code sessions, or Claude Code plus Codex): Lane A backend, contracts, infra. Lane B frontend.
**One agent:** run in this order: V3-00, V3-01, V3-02, V3-03 (start it by Wed 13:00 UTC so registration lands by 18:00), V3-04, V3-05, V3-06, V3-07, then during Thu 05:00 to 09:00 staging-only work (V3-08, Report #2 page prep), then V3-09, V3-10, V3-11, V3-12.

| Phase | Lane | Target (UTC) | Priority |
|---|---|---|---|
| V3-00 Kickoff, current truth, truth sweep | A | Wed morning | A0 |
| V3-01 Freshness guarantee | B (+A for the warmer) | Wed morning | A0 |
| V3-02 Standing demo position | A | Wed morning | A0 |
| V3-03 Kerb for Agents (x402, OKX.AI, MCP) | A | Wed afternoon, **register by 18:00** | A1 |
| V3-04 Term attribution | A engine and API, then B UI | Wed evening | A1 |
| V3-05 Onchain consumers | A | Wed night, deploy Thu after 09:00 | A1 |
| V3-06 Exit evidence | A API, B UI | Wed night or Thu | A2 |
| V3-07 Consumers and positioning surfaces | B | Thu | A1 |
| V3-08 Last Call alerts | B (+A optional) | Thu, cut first | A2 |
| V3-09 Report #2 and dataset | A, then B | Thu after 09:00 | A0 |
| V3-10 Hardening, freeze 22:00 | both | Thu 16:00 to 22:00 | A0 |
| V3-11 Certification, tag v3.0.0 | both | Fri 00:00 to 04:00 | A0 |
| V3-12 Film and submit | operator + both | Fri 06:00 to 16:00 | A0 |

No production deploys Thu 05:00 to 09:00 UTC or Fri 06:00 to 10:30 UTC.

---

# V3-00. Kickoff, current truth, truth sweep (Lane A, ~1.5 h)

```
V3-00. Read AGENTS.md sections 1 to 13 and docs/v3/00_START_HERE.md, V3-ASCENSION.md (sections 1, 13, 16), V3-LIVE-AUDIT.md, V3-POSITIONING.md (section 3). You are starting Kerb V3. Do not write feature code in this phase.

1. Commit docs/v3/ as provided and the AGENTS.md section 13 append. Commit: "docs(v3): ascension pack".

2. CHECKPOINT 0, current truth. Report, without printing any secret:
   - HEAD, git status, latest CI run and result, current production release directory and commit.
   - /health: observation age, last post age per chain.
   - Last 3 mainnet Terms posts (tx, asset, age) and that their Builder Code decodes.
   - Keeper: PM2 state of kerb-demo-keeper, wallet 0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4 balance on 1952.
   - Report #2: the crontab entries for Thu 24 Sep captures (times in UTC), the generator's dry-run status.
   - Deployer balance on 196 (for the V3-05 deploy). Attester balance on 196 and 1952 (days of gas left).
   - OKX Developer Portal credentials present in the VPS env (yes or no only) and whether the existing key's project lists Payments permission, if that can be read.
   - Pinning: last 24 h retrievable counts from /v1/proof.
   - Production freshness: request /board, /credit, /proof with curl after 5 minutes of no traffic and report the generatedAt or asOf age in the returned HTML. This measures L-01.
   Stop if anything here contradicts V3-ASCENSION.md section 1 materially, and say what.

3. Truth sweep per V3-LIVE-AUDIT.md L-04. Edit copy strings, comments and docs only; no behaviour changes. Include the Home "each pinned in a bundle" line, docs/planning/SUBMISSION.md (private repo, overbroad competitor sentence, "USDG as the loan asset", "pinned input bundle"), apps/web/src/lib/art.ts line 3, PROJECT_STATE.md rows about The Seal. Replace SUBMISSION.md's summary with V3-POSITIONING.md section 6.

4. Add scripts/claims-check.sh: fail on the denylist in V3-LIVE-AUDIT.md L-04 across README.md, SECURITY.md, docs/ (excluding docs/v2/, docs/v3/ and docs/planning/KERB-MASTER-PLAN.md history), apps/web/src, apps/api/src. Wire it into CI next to the em dash check.

5. Add a V3 section to PROJECT_STATE.md: the phase table from docs/v3/V3-BUILD-PROMPTS.md with status, the operator actions table from docs/v3/00_START_HERE.md with an Answer column, and a Requests table.

CHECKPOINT 1: the CHECKPOINT 0 report, every file changed with old and new statement, claims-check output, CI result. STOP.
```

---

# V3-01. Freshness guarantee (Lane B, Lane A for the warmer, ~3 h)

```
V3-01. Read docs/v3/V3-LIVE-AUDIT.md L-01, L-02, L-05, L-09. This is the most important defect in production: a judge who opens /board cold sees data hours old.

LANE B
1. useLive: add an asOf extractor per call site (Board: generatedAt; clock: at; terms: observedAt; stats and proof: generatedAt or now; demo clock: now). Set initialDataUpdatedAt from it and staleTime 5 s, so a stale initial payload refetches on mount.
2. Freshness guard component used by every live surface (Board KPI band and table, Home preview and callouts, Credit cards and curable table, Proof tiles, Methodology live example, Asset KPI band): if the initial payload is older than 90 s, dim the values and show "Refreshing live data" until the refetch lands; on failure show "Last known, {age} old" with a Retry button. Never show a past countdown: a target in the past renders "Refreshing" for at most 5 s, then "Last known".
3. Replace the Board's "Updated ... refreshes every 30 seconds" with the true state from the query.
4. L-02: export the transition union from the calendar package (or @kerb/types), type both word maps in lib/time.ts as Record<TransitionType, string>, add LUNCH_BREAK, POST_CLOSE, SESSION_BREAK, SESSION_END, EARLY_CLOSE words per the audit. Add a DOM check in E2E: no /\b[A-Z]+_[A-Z_]+\b/ token visible on any route.
5. Stamp data-asof on each page root from the server payload.
6. E2E freshness.idle.spec.ts per L-01 acceptance, runnable in CI with the fixture API and a fixture clock, and against production with e2e:live.
7. L-09: Home and Proof headline counts both read /v1/stats and show their asOf in the ProvMark card.

LANE A
8. scripts/web-warmer.ts and PM2 process kerb-web-warmer: every 10 s request /, /board, /proof, /methodology, /research, /developers and the ten /asset pages, and /credit every 5 s, through the local Caddy with the production Host header, timeout 5 s, concurrency at most 2, jitter 0 to 1 s. Log only failures. Add to ecosystem.config.cjs. Deploy it outside the protected window.
9. Measure /v1/board cold and warm latency (10 samples each) and report it.

Deploy to staging, run the idle test on staging, then deploy to production (not Thu 05:00 to 09:00). After deploy, measure first-paint asOf age on every live route 10 times over 30 minutes.

CHECKPOINT: the production age table (route, min, median, max), E2E results, screenshots of the Refreshing and Last known states, enum test output. STOP.
```

---

# V3-02. Standing demo position (Lane A, ~1.5 h plus operator funding)

```
V3-02. Read apps/attester/scripts/demo-keeper.ts, AGENTS.md 12.6 gate 6 and 13.6 gate 9, V3-LIVE-AUDIT.md L-03.

1. Audit the keeper before anything runs. Confirm and, where missing, add:
   - hard refusal of any chain id other than 1952 (already present; keep it first);
   - at most one open keeper position; restart-idempotent (reads chain state, never local state, to decide);
   - debt never above 2,000 mUSDG, sized between Carry and Session Max so the position needs a cure when Last Call opens;
   - CLOSED phase: repay and withdraw only if the position still exists; handle "already cured" and "already repaid";
   - RPC 403 and timeout handling with bounded retries and no duplicate sends (check pending nonce);
   - every action and tx hash appended to data/keeper.log;
   - a /v1/credit/1952/keeper status line the UI can read (address, state, last action, next action time). Read-only.
2. Unit or fork tests: wrong chain throws, duplicate open prevented after restart, debt bound, cure recovery path, repay path when partially cured.
3. Ask the operator: "Claim 0.02 test OKB from the X Layer faucet to 0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4 and reply go keeper." Wait. Do not fund it yourself unless the operator says to fund it from the deployer.
4. On go: start kerb-demo-keeper. Observe three demo cycles. In at least one, cure the keeper's position from a second wallet in a real browser using the existing flow script adapted to the current UI (Curable now, Cure). Confirm the keeper re-arms next cycle.
5. Request to Lane B (PROJECT_STATE Requests): replace the Credit empty-state copy with V3-POSITIONING.md section 2 "Credit empty state", reading the keeper status endpoint.

CHECKPOINT: test results, keeper.log excerpt covering three cycles with tx hashes, the stranger-cure tx, screenshot of the standing position in Curable now. If unfunded: the exact operator action and the dormant, honest state. STOP.
```

---

# V3-03. Kerb for Agents: x402 on X Layer, OKX.AI listing, MCP (Lane A, ~5 h)

```
V3-03. Read docs/v3/SPEC-AGENTS.md in full, and AGENTS.md 13.6 gates 10 and 11, 13.7, 13.9. There is no language model in this service. It sells a computed answer from posted terms; public terms stay free.

1. Create apps/agents (TypeScript, Express, port 8740, PM2 kerb-agents). Install the OKX Payment SDK packages named in SPEC-AGENTS.md section 5 at pinned versions after checking the npm registry. Read the internal API at 127.0.0.1:8720 only.
2. Implement credit-check and exit-check per sections 3 and 4, with the valuation helper shared with the engine and a parity test against the testnet KerbCredit valuation. why comes from the attribution module; until V3-04 lands, return the current margin sentences computed from the latest report and mark them "now".
3. x402 per section 5 on eip155:1952 first. No settlement on any non-2xx (test with a mocked facilitator). Facilitator credentials only from the VPS env. The service holds no private key.
4. agent_calls append-only table (migration with the same trigger pattern as the store) and data/agents/payments.jsonl. GET /v1/agents/stats on the main API (reads the table and a listing-status config value).
5. MCP server per section 7 at /mcp (streamable HTTP, stateless, free tools, 60 per minute per IP).
6. Caddy: handle /agents/* and /mcp* on api.usekerb.xyz to 127.0.0.1:8740. Reload Caddy only outside protected windows.
7. Self-check: curl -i -X POST https://api.usekerb.xyz/agents/credit-check returns 402 with a PAYMENT-REQUIRED header. Paste the header (not any secret) into the checkpoint.
8. Registration (section 8), by Wed 23 Sep 18:00 UTC. Ask the operator to complete the Onchain OS install and Agentic Wallet email login in their session if not done. Then drive: "Help me register an A2MCP ASP on OKX.AI using OKX Agent Identity from Onchain OS" with the name, description, price 0.01 and endpoint from section 8; then "Help me list my ASP on OKX.AI using Onchain OS". Record times and status in PROJECT_STATE and the listing-status config.
9. Testnet payment (section 9 step 1): a test Agentic Wallet with faucet test USDT0 pays for one credit-check. Record the settlement tx.
10. Ask the operator for "go x402 mainnet" and about 2 USDT0 in their Agentic Wallet on X Layer mainnet. On go: switch KERB_X402_NETWORK to eip155:196, deploy, have the operator's agent pay for one credit-check on HKEXCx, record the settlement tx and a screen recording of the terminal (it is a video shot).

CHECKPOINT: test list with results, the 402 header, registration status with timestamps, testnet settlement tx, mainnet settlement tx (or the exact dependency), /v1/agents/stats output, MCP tools/list output. STOP.
```

---

# V3-04. Term attribution (Lane A engine and API, then Lane B UI, ~5 h total)

```
V3-04 LANE A. Read docs/v3/SPEC-TERM-ATTRIBUTION.md sections 1 to 7 and 9.
1. apps/engine/src/attribution.ts: attribute(prev, next, params) and explainNow(report, params), pure, no I/O, not in the posting path.
2. Tests: synthetic per cause, exact additive split, golden tests on stored bundles (KOx across 21 Sep 20:00 UTC, a Hong Kong lunch, a depth move, a capped loosening, the 0.1 to 0.2 switch at 21 Sep 19:38 UTC), sum parity within 0.01 points.
3. Incremental job (API timer or PM2 kerb-attribution) appending to a new append-only table term_changes; backfill 72 h after Thu 09:00 UTC if it would load the API during the protected window, otherwise now.
4. API: GET /v1/terms/:chain/:asset/why and /v1/terms/:chain/:asset/changes?hours=72, cached by latest inputsHash, documented in docs/API.md with captured responses.
5. Wire why into apps/agents credit-check.
CHECKPOINT A: tests, three real "why" outputs (one US, one HK, SLVx), ten real change events across at least two causes. STOP LANE A.

V3-04 LANE B. Read SPEC-TERM-ATTRIBUTION.md section 8 and the Kerbstone design system.
6. Asset: "Why these terms" block under the KPI band; "What changed" 72 h timeline with chips under the Terms history chart; chart markers with the same sentence on hover.
7. Credit: one computed line under each mode card. Home: the Carry and Session Max section uses the Carry now-sentence.
8. Board: hover card on the Terms cell only.
9. E2E: no "{" placeholder in the DOM, every sentence has a ProvMark, timeline renders or its empty state.
CHECKPOINT B: screenshots in Night and Day at 1440 and 390 for KOx and HKEXCx, E2E results. STOP.
```

---

# V3-05. Onchain consumers (Lane A, ~4 h)

```
V3-05. Read docs/v3/SPEC-ONCHAIN-CONSUMERS.md in full and AGENTS.md 13.6 gate 12. These contracts hold nothing and own nothing. The existing contracts are frozen.

1. Before writing KerbQuote, read KerbCredit's collateral valuation and borrowing-power code and reuse its arithmetic exactly. Write down, in the checkpoint, the formula you are matching.
2. contracts/src/consumers/: KerbQuote, KerbMarkFeed, KerbMarkFeedFactory, minimal interfaces for the reads they need.
3. Tests per section 5, including the mainnet fork tests and the parity test against a local KerbCredit. forge test green, gas snapshot.
4. Deploy on X Layer testnet 1952 against the testnet KerbTerms and KerbClock; Sourcify verify; live parity check.
5. Ask the operator for "go consumers mainnet". On go, and outside the protected window: deploy KerbQuote and the factory on 196 with the deployer key and the Builder Code suffix, create feeds for all ten assets, Sourcify verify every contract, add a consumers group to config/deployments.json, surface them in /v1/proof.
6. Record a cast call line that returns quoteToken for 10 BRK.Bx at Carry on mainnet, with its output (a video shot and a README line).

CHECKPOINT: the matched formula, test results, testnet and mainnet addresses with Sourcify links, deploy tx hashes, cast output. STOP.
```

---

# V3-06. Exit evidence (Lane A API, Lane B UI, ~3 h)

```
V3-06. The OKX DEX cross-check already runs and bounds capacity when it is lower. It is shown on the Asset Liquidity tab as one sentence and a chart marker. Make it evidence.

LANE A
1. Extend the V3-04 job to append one row per post to a new append-only table exit_checks: asset, at, simulated C(1%), quoted C(1%) (or unavailable with reason), delta, bound (tick-walk or okx-quote), source age.
2. GET /v1/exit/:chain/:asset?hours=72: the latest check plus a 72 h summary (checks, times OKX bound the capacity, median and max divergence, unavailable count with reasons). Documented with a captured response.

LANE B
3. Asset, Liquidity tab, a first panel "Exit check": Kerb tick-walk C(1%), OKX DEX quote at the same notional, difference, capacity used (the smaller), bounded by, observed age, route. Below it the 72 h summary as one line and a small strip of dots (one per check, filled when OKX bound it). Stale quote shows stale; unavailable shows the reason; never zero.
4. Proof, Limitations row "Executable depth": add "cross-checked {n} times in 24 h; OKX bound the capacity {k} times".
5. E2E: normal, unavailable and stale fixture states.

CHECKPOINT: screenshots at 1440 and 390, a real captured /v1/exit response, E2E results. STOP.
```

---

# V3-07. Consumers and positioning surfaces (Lane B, ~4 h)

```
V3-07. Read docs/v3/V3-POSITIONING.md in full and AGENTS.md 13.7. Use Kerbstone tokens and existing components; no new navigation.

1. Home: new hero lede; fixed "How a term is made" lede; the new "One term, four consumers" section with live evidence lines (Kerb Credit from the positions feed, Agents from /v1/agents/stats, Contracts from config deployments, Developers static count). A card without live evidence shows its line without a number, never a placeholder.
2. Developers: tabs SDK, REST, Solidity, Agents. Solidity gains "Use Kerb from your contract" with the KerbQuote snippet, a live client-side read of quoteToken(BRK.Bx, 10, Carry) with block number, the cast line, and the feed table. Agents tab per SPEC-AGENTS.md section 10. SDK tab: npm install if @kerb/sdk is published, otherwise the curl and degit paths, stated truthfully.
3. Proof: Agents tile; Consumers group in Contracts; exit-check line from V3-06.
4. Credit: keeper-aware empty state and the keeper status line; "(mirror listing)" beside mirror LTs (L-11).
5. Research index lede line about Report #2.
6. README top per V3-POSITIONING.md section 5 and the FAQ in section 4 with the listed sources. Every claim in README gets a CLAIM_EVIDENCE row.
7. Metadata description: "The market-time risk layer for tokenized stocks on X Layer. Never lend more than you can liquidate."
8. claims-check passes; em dash check passes.

CHECKPOINT: screenshots of Home, Developers (all four tabs), Proof, Credit empty state, in Night and Day at 1440 and 390; claims-check output; README diff. STOP.
```

---

# V3-08. Last Call alerts (Lane B, Lane A optional, ~2 h, cut first)

```
V3-08. The covenant's last mile: a Session Max borrower should be told Last Call is coming.
1. Credit position panel, Session Max only: "Notify me when Last Call opens". Browser Notification API with permission request on click, scheduled from the demo clock (or the real clock when not demo), fires at window open and 5 minutes before close, cancels on cure or repay. Works in the open tab; the UI says so.
2. Optional, only if the operator provides a Telegram bot token: apps/agents adds /alerts with a Telegram bot (/watch 0xaddr, /stop), polling the positions feed every 30 s, messages at Last Call open, cure deadline minus 5 minutes, cured, repaid. Rate limited, no secrets logged.
3. E2E with a mocked Notification.
CHECKPOINT: screenshots, E2E, and a real notification screenshot. STOP.
```

---

# V3-09. Report #2 and the dataset (Lane A after Thu 09:00 UTC, then Lane B)

```
V3-09 LANE A. Nothing touches production between Thu 05:00 and 09:00 UTC.
1. After 09:00: check the capture files for 06:30, 06:55, 07:05, 07:30, 08:30 exist and are complete; check collector gaps in the window; report both.
2. Generate Report #2 with the existing generator from stored observations only, window from 23 Sep 07:00 UTC to the latest complete hour, marked partial until 25 Sep 07:00. Findings state only what the numbers show; "held", "fell", "rose", "mixed" or "insufficient evidence". Include C(1%) and C(3%) in USDG before and after 07:00 on 24 Sep per asset, regime at each capture, open-against-closed comparison, gaps, sources, limitations, reproduce command.
3. Publish via /v1/market-time/2 by 18:00 UTC. Schedule a regeneration at Fri 25 07:05 UTC with the full window (cron), marked final. The API keeps both versions (append, never overwrite).
4. Dataset: GET /v1/datasets/depth-hourly.csv and .json: hourly C(1%), C(3%), in-range L, regime and observation count per asset since the first observation, gaps as explicit rows. Documented.
5. Post the headline number to PROJECT_STATE and CLAIM_EVIDENCE.

V3-09 LANE B.
6. Research: Report #2 becomes the featured card automatically; its page renders the before and after table; a "Download the dataset" link on the index and both report pages; the Research lede line from V3-POSITIONING.
7. Home "Measured, not modelled": third KPI rotates to Report #2's headline once published.

CHECKPOINT: Report #2 URL, headline finding in one sentence, capture completeness table, gap list, dataset row counts, screenshots. STOP.
```

---

# V3-10. Hardening, then feature freeze at Thu 22:00 UTC (both)

```
V3-10. Read docs/v3/V3-CRUCIBLE.md sections A to J. No new features after this prompt except finishing a started A1 item.

LANE B
1. E2E additions: freshness idle, enum regex, no "{" placeholders, Day header visible on every route, Agents tab states, Solidity live read, exit-check states, Research #2 flip, keeper empty state. Full suite green in CI and with e2e:live.
2. axe on every route in both themes (zero serious or critical); keyboard pass on Credit including Cure from Curable now; Lighthouse mobile on every route (record scores; fix anything under 85 performance).
3. Dead-button sweep script across every route in both themes.
4. Screenshots of every route at 390, 768, 1440 in Night and Day to data/screens/v3/.

LANE A
5. Security: agents endpoints input validation, rate limits, no stack traces, no settlement on non-2xx, facilitator credentials absent from git history (secret scan of full history), MCP rate limit. New tables have append-only triggers (test that UPDATE and DELETE fail).
6. Forge suite, TypeScript suite, claims-check, em dash check, CI green on main.
7. Deploy everything to production outside protected windows; tag v3.0.0-rc1; record in RELEASE_STATE.md.

At 22:00 UTC write "FEATURE FREEZE" in PROJECT_STATE.md with the commit hash. After it: bug fixes, claims, evidence, docs, video only.

CHECKPOINT: CI URL, test counts, E2E count, axe summary, Lighthouse table, dead-button result, secret scan result, rc1 commit. STOP.
```

---

# V3-11. Certification (both, Fri 00:00 to 04:00 UTC)

```
V3-11. Run docs/v3/V3-CRUCIBLE.md end to end. Mark nothing complete without the evidence it asks for. Fix S0 and S1 only.
1. Update docs/release/: FINAL_AUDIT.md, HARDENING_PLAN.md (V3 items), CLAIM_EVIDENCE.md (every sentence on the site, README and the form summary), RELEASE_STATE.md (commit, tag, URLs, every address including consumers, agents endpoint, listing status, keeper state), JUDGE_CHECKLIST.md, DEMO_VERIFICATION.md (each shot in docs/v3/V3-DEMO.md: expected output, tested status, fallback), SUBMISSION_CHECKLIST.md.
2. Tag v3.0.0 at 04:00 UTC. Code freeze.
3. Film prep: browser profile A (fresh wallet with test OKB, faucet collateral and mUSDG pre-minted, a Session Max position opened in the demo cycle before the take), profile B (a second wallet for the stranger cure), a terminal with the Onchain OS agent ready for the paid call, a terminal with kerb verify and the cast call ready. Compute the demo Last Call times between 06:30 and 10:30 UTC and write them into DEMO_VERIFICATION.md.
4. Generate the 1:1 team display picture: the Kerb mark in bone on #0B0C0A, 1024 x 1024 PNG, docs/release/team-display.png.
CHECKPOINT: Crucible table with evidence paths, tag, demo timing table, display picture path. STOP.
```

---

# V3-12. Film and submit (operator with both lanes supporting, Fri 25)

```
V3-12. The operator films per docs/v3/V3-DEMO.md and submits per docs/v3/V3-SUBMISSION.md. Agents: no deploys 06:00 to 10:30 UTC. Watch /health and the keeper during filming and report any anomaly immediately.
After the video is uploaded: put the link in README (top line), docs/release/RELEASE_STATE.md, and the Developers page footer; verify it plays logged out; run e2e:live one last time; confirm the form fields against V3-SUBMISSION.md; save the receipt to docs/release/. Final PROJECT_STATE entry. Leave collector, attester, keeper, agents and warmer running.
CHECKPOINT: video URL and duration, final commit, receipt path, e2e:live result. DONE.
```

---

## If an agent drifts

```
Stop. Re-read AGENTS.md sections 2, 3, 12 and 13. Only the phase you were given is in scope.
Frozen: KerbClock, KerbTerms, KerbCredit and the posting path, the collector, KTS 0.2 parameters, git history, the design system.
One truth: no claim without a CLAIM_EVIDENCE row. No em dashes. No raw enums. No stale value shown as current.
Protected windows: Thu 05:00 to 09:00 UTC and Fri 06:00 to 10:30 UTC, no production deploys.
Report the CHECKPOINT block for what actually exists now.
```
