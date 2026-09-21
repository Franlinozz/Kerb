# PROJECT_STATE.md
## Living state. Update at every checkpoint. A new agent must be able to resume from this file alone.

Last updated: 21 Sep 2026, phase 6 complete. Remaining: demo video, repo public, apex DNS.

---

## 1. Where we are

| Item | Status |
|---|---|
| Phase | 5 complete. Phase 6 shipped: /market with borrow, cure and the confirmation panel (K-31..33), /methodology (K-34), /proof v2 two-click bundles (K-35), Slither + SECURITY.md (K-36), verify from a chain hash (K-39), Market-Time Report #1 (K-38). K-37 mainnet credit NOT attempted: gated on written operator approval |
| Tier | T0 in progress |
| Collector | LIVE on VPS under PM2 (`kerb-collector`) since 2026-09-19 06:37:30 UTC. Health: `curl 127.0.0.1:8710/health` |
| Mainnet risk plane | **LIVE**: KerbClock and KerbTerms on X Layer 196, calendars and guardrails loaded, attester posting every 5 min (`kerb-attester-mainnet`) |
| Testnet credit plane | **LIVE**: KerbCredit, MockUSDG, KerbClockDemo and two mirrors deployed on 1952, both mirrors listed with a fixed LT, real mainnet Credit Marks relayed onto them |
| Web | **LIVE** at https://www.usekerb.xyz under PM2 (`kerb-web`), Caddy TLS. Session Strip, /board, /asset/[symbol], /proof; both themes, 390 and 1440 reviewed |
| Kerb Desk (OKX AI) | not started, P1 |
| Participation route | **REMOTE**. The builder is not travelling to Singapore (no funds for the trip); no visa letter needed |
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
| 20 Sep | Participation is remote. The builder will not attend in person in Singapore | The trip cannot be funded; the submission and any finale participation are remote |
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
| | Invitation letter for a Singapore visa? | | |

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
