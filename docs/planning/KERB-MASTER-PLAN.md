# KERB
### The market-time risk layer for tokenized securities
### Credit on the market's clock

Master plan v2.0. Written 18 Sep 2026 for Francis / Xyndicate Labs.
Supersedes the 10 Sep plan. Build period: now to 25 Sep 23:59 UTC.

---

## 0. What changed since v1, and why this version is harder to beat

| v1 (10 Sep) | v2 (now) | Reason |
|---|---|---|
| "Weekend-safe lending for xStocks" | "Liquidity regime risk for tokenized securities" | Traditional markets are moving toward 23/5 and 24/7. A weekend company expires. A liquidity-quality company does not. |
| US equity calendar | Per-asset calendar across US, Hong Kong and commodities | The tokenized assets actually live on X Layer right now include Hong Kong names (HKEXCx, MIXUx, KUAIx) and a metal (SLVx). The HKEX lunch break gives a real regime transition every weekday of the build. |
| Depth estimated from an aggregator API | Depth computed from Uniswap V3 pool state by walking ticks, cross-checked against the OKX DEX quote API | The pools are on X Layer and readable. Deterministic, reproducible, not a black box. This is the hardest part of Kerb to copy. |
| Session-varying liquidation threshold | **Liquidation threshold is fixed. Sessions move borrowing capacity and a precommitted cure covenant.** | Moving the liquidation line under a live borrower is indefensible. The fix below (Carry, Session Max, Cure) is the single biggest design upgrade in this document. |
| Francis buys xStocks to demo | Francis never holds the restricted asset. Real mainnet risk plane, test-money credit market | Backed lists Nigeria as non-serviceable. Handling a jurisdiction boundary honestly reads as maturity, not weakness. |
| Builder Codes "if it exists" | Builder Codes P0 | X Layer publishes an ERC-8021 integration guide using viem `dataSuffix`, with mainnet registration in the dev portal and a testnet `registerAuto` contract. It is close to free. |
| No regulatory anchor | SEC Innovation Exemption, 17 Sep 2026 | The exemption's conditions are Kerb's spec: halts synchronized with the underlying, symbol and volume caps calibrated by LULD tier, permissioned AMM liquidity pools, auditable onchain contracts. |

Hard truth about v1: it was a good hackathon idea attached to a small company. This version is the same hackathon build with a company under it that does not evaporate when Nasdaq extends its hours.

---

## 1. The thesis

**Asset tokenization makes ownership programmable. It does not make liquidity uniform.**

The same token has completely different liquidation characteristics depending on when you have to sell it, where you have to sell it, and what condition the market is in when you do. A tokenized Coca-Cola share at 15:00 New York time and the same token at 03:00 on Sunday are not the same credit collateral, yet every lending protocol in production treats them as identical.

As markets converge on continuous trading, the risk question stops being "is the market open?" and becomes:

> **What liquidation conditions exist right now, and how much credit can they safely support?**

Kerb answers that, reproducibly, onchain.

- **Kerb Terms** is the primitive: per-asset, per-regime credit capacity published onchain with the inputs that produced it.
- **Kerb Credit** is the first consumer: an isolated credit market that puts real economics behind those terms.
- **Kerb Risk Infrastructure** is where the company goes: other lenders, curators, Exchange OS venue operators, wallets, tokenization providers and agents read Terms instead of each rebuilding equity market risk logic.

Engineering principle, printed on every surface:

# Never lend more than you can liquidate.

---

## 2. Why this is a company, not a hackathon trick

**The moat is not the Solidity.** Contracts are copyable. The moat is the accumulating record of

`asset x underlying market x session x executable depth x stress x credit x outcome`

across tokenized markets. Every observation cycle writes a row. After a month it is a dataset nobody else has. After a year it is the calibration source for tokenized-equity credit, and it improves precisely as the category grows.

**Who eventually pays**

| Customer | What they buy | Why they keep paying |
|---|---|---|
| Borrower | Credit without selling the position | Interest, and no one else prices the session |
| Lender | Yield backed by collateral with a published exit path | The coverage ratio is visible, not asserted |
| Lending curator (isolated markets, vaults) | Collateral parameters and live caps | Cheaper than staffing a risk desk |
| Venue operator (Exchange OS deployers, TSVs) | Market-time risk config and halt-sync telemetry | The SEC exemption makes halt sync and volume caps a condition of operating |
| Wallet or broker | Regime warnings before a user takes a position | Support cost and user trust |
| Tokenization provider | Their asset becoming safely usable in DeFi | Distribution for the asset |
| Agent or automated system | Machine-readable constraints per call | One bad overnight trade costs more than a lifetime of call fees |

**Revenue engines, in the order they become real**

1. Protocol revenue: reserve factor on Kerb Credit interest. Never a cut of liquidation penalties, because Kerb must not profit from forcing liquidations.
2. Data and API revenue: Terms history, webhooks, extra assets, SLAs. Current Terms stay publicly readable onchain.
3. Risk operations revenue: hosted risk configuration and monitoring for third-party venues and markets.
4. Machine revenue: per-call agent access through OKX AI.

**The flywheel.** More credit usage produces more observed depth and liquidation data, which improves calibration, which makes Terms more valuable, which brings integrations, which widen asset and venue coverage, which improve the liquidity map, which allows safer capital efficiency, which brings more credit usage.

---

## 3. Why X Layer, and why now

Everything Kerb needs is already on X Layer, and almost nowhere else in one place:

- **The assets.** xStocks is deployed on X Layer with a fast-listing mechanism. The live incentivised pools right now include US names (KOx, BRK.Bx, ICEx, COINx, BMNRx), Hong Kong names (HKEXCx, MIXUx, KUAIx, SHEINx) and a metal (SLVx). Multi-market, multi-calendar, one chain.
- **The dollar.** USDG is live on X Layer mainnet `0x4ae46a509F6b1D9056937BA4500cb143933D2dc8` and on X Layer testnet `0xF0863D7A29a55d0c4263c11bFac754312ff078DF`. Real test money for a real test market.
- **The pools.** Uniswap V3 pools on X Layer with visible TVL, so executable depth is computable from chain state rather than guessed.
- **The oracle.** Chainlink Data Streams on X Layer cover US equities on a 24/5 clock. That coverage gap is itself a regime input.
- **The venue layer.** Exchange OS lets builders deploy spot, perp and outcome venues with their own oracle and risk configuration. Every one of those venues faces the question Kerb answers.
- **Attribution.** X Layer Builder Codes (ERC-8021) give measurable onchain attribution, which is literally what "contribution to the OKX ecosystem" means in the judging criteria.

Timing: on 17 September 2026 the SEC issued a five-year Innovation Exemption for Tokenized Securities Venues trading tokenized NMS stock through permissioned AMM liquidity pools, with conditions including symbol limits, volume caps calibrated by LULD tier, auditable onchain smart contracts, and trading halts synchronized with the underlying stock. The same day it ran a roundtable on preparations for 24-hour trading covering overnight liquidity, surveillance, settlement and resiliency.

Read those conditions as an engineering brief. Halt synchronization is the Clock. Volume caps by tier are capacity limits. AMM pools are where the exit actually happens. Kerb is the machine-readable layer for all three.

---

## 4. The mechanism (the part judges must remember)

### 4.1 One number: Safe Credit Capacity

```
Safe Credit Capacity = MIN(
    stress capacity,      // survives a stressed adverse move before the next liquid window
    liquidity capacity,   // can actually be exited into real pools at acceptable impact
    protocol cap          // absolute exposure limit regardless of the maths
)
```

Everything else is either an input to that number or a consequence of it.

### 4.2 Two credit modes, chosen by the borrower

The interface asks one question a normal person understands:

> **How long do you want this loan to survive without you touching it?**

**Carry.** Lower borrowing power, sized to survive the next weaker liquidity regime with no action from the borrower. Carry positions never receive a cure event.

**Session Max.** Higher borrowing power while conditions are strong. Taking it is a precommitment: before the next material liquidity transition, the position must return to its Carry target. You repay, add collateral, or the protocol partially deleverages you by exactly the amount required, while liquidity is still deep.

### 4.3 Two liquidation types, and a line that never moves

| | Trigger | Size | Penalty | When |
|---|---|---|---|---|
| **Cure** | Position above its recorded Carry target when the Last Call window closes | Partial, exactly enough to reach the Carry target | Small (illustratively 1.5%) | Inside a deep or normal regime, before conditions weaken |
| **Default** | Health factor breaches the fixed liquidation threshold | Standard partial (close factor) | Standard (illustratively 7%) | Any time |

**The liquidation threshold is fixed per asset at listing and changes only through a timelocked governance action.** Sessions never move the hard line under a live borrower. Sessions move (a) how much new credit you can draw and (b) the cure covenant you accepted when you drew it. That distinction is the difference between a risk product and a rug, and it is the first thing a technical judge will probe.

### 4.4 Last Call

Last Call is not "the hour before Friday close". It is:

> **The pre-transition cure window that opens before Kerb expects liquidation conditions to materially weaken.**

Sometimes that is the Friday close. Sometimes a holiday. Sometimes the HKEX lunch break. Sometimes a scheduled corporate action. Eventually, when observed depth deteriorates with no calendar boundary at all. The hackathon implementation is calendar-led plus a depth trigger. The architecture does not assume a calendar.

### 4.5 The regime state machine

Per asset, not per chain, not per country:

```
DEEP             strong underlying session, executable depth above target, sources fresh
NORMAL           underlying open, adequate depth
THIN             open but depth or spread materially degraded (this is what survives 24/7 markets)
PRE_TRANSITION   Last Call window before a known weakening (close, lunch break, holiday, action)
REFERENCE_CLOSED underlying market closed, token still trading
ACTION           corporate action or multiplier activation window
HALTED           underlying halted, or token halt flag set
STALE            sources disagree or are too old; borrowing pauses, repayment never does
RECOVERY         post-open cooldown before capacity is allowed to loosen
```

Three independent inputs decide the regime: the per-asset market calendar, observed executable depth from X Layer pools, and source freshness and dispersion. Calendar alone is never sufficient, which is exactly why Kerb still works when NYSE goes 23/5.

---

## 5. The hackathon build: one complete vertical

The company is broad. The submission is narrow. One vertical, end to end, excellent.

```
real X Layer tokenized equity (KOx, HKEXCx, BRK.Bx ...)
  -> Kerb discovers instrument, wrapper and underlying market
  -> per-asset Clock resolves the current regime
  -> Depth engine walks the real Uniswap V3 pool on X Layer -> price impact curve
  -> Credit Mark built from independent reference plus pool state, with a band
  -> KTS engine produces Terms (Carry LTV, Session Max LTV, debt ceiling, next transition)
  -> Terms posted on X Layer MAINNET with inputs hash (no user funds)
  -> Kerb Credit (X Layer testnet, real testnet USDG, mirror collateral) consumes the same Terms
  -> user supplies USDG, deposits collateral, picks Carry or Session Max, borrows
  -> Last Call opens -> partial cure -> position crosses into the weak regime safely
  -> /proof lets anyone verify every number, transaction and input
```

### Deployment split, and why it is honest

| Plane | Where | What is real |
|---|---|---|
| Risk plane | **X Layer mainnet** | Real pools, real assets, real marks, real Terms transactions, real Builder Code attribution |
| Credit plane | **X Layer testnet** | Real testnet USDG from Paxos, real Kerb contracts, mirror collateral priced off the mainnet marks |

Backed lists Nigeria among non-serviceable countries, so the builder does not acquire or hold the restricted collateral asset and does not route around that restriction. State it plainly on `/proof` and in the README. A judge who sees a team handle a jurisdiction boundary correctly trusts every other number on the page more.

**Mainnet Kerb Credit is an optional gate**, not a default: only if invariants and Slither are clean by D6, only with your written approval, only with caps you set, supply side seeded by you in USDG.

---

## 6. Feature system

### P0, must ship
1. Asset adapter layer with xStocks as the first implementation. Never hardcode a ticker.
2. Per-asset Clock: US, HKEX (including the 12:00 to 13:00 HKT lunch break), commodity calendars, holidays, DST.
3. Depth engine: Uniswap V3 tick-walk on X Layer pools, price impact curve, executable depth at 1% and 3%, two-leg paths for non-USD quote pools (COINx/xETH, BMNRx/xETH, SLVx/USDC).
4. Credit Mark with provenance labels and a dispersion guard.
5. KTS-0.1 engine producing Carry LTV, Session Max LTV, debt ceiling, coverage ratio, next transition, inputs hash.
6. `KerbClock` and `KerbTerms` on X Layer mainnet, guardrailed, attester-signed reports.
7. `KerbCredit` on X Layer testnet: supply, withdraw, deposit, borrow (Carry or Session Max), repay, cure liquidation, default liquidation.
8. Kerb Board: public, real data, no wallet needed.
9. `/proof`: build-period evidence, onchain evidence, data evidence, risk recomputation, limitations.
10. Builder Codes on every app transaction, mainnet and testnet.
11. Demo video 2 to 4 minutes, public repo, clear README.

### P1, win levers (only when P0 is boringly stable)
- Market-Time Report #1 covering the X Liquidity campaign end on 24 Sep 07:00 UTC (Section 7).
- Kerb Desk: OKX AI A2MCP paid service exposing session, mark, depth, terms and position checks.
- One external consumer reading `effectiveTerms(asset)` or `GET /v1/terms/:chain/:asset`.
- `kerb verify` CLI that recomputes a published report from its pinned inputs.
- Corporate action safety: pause interactions around multiplier activation windows.

### P2, architecture only, do not build now
Kerb Autopilot on Agentic Wallet (deterministic user policy, no model in the decision path), Exchange OS adapter, additional chains, issuer-sponsored asset adapters for the post-exemption TSV world, asset provenance profiles beyond the basic instrument card.

### Explicitly not building before submission
An AI risk score. A trading terminal. A portfolio tracker. A points program. A token. A perp venue. Cross-chain anything. A DAO. A mobile app. Social features. A second collateral chain. Anything that needs an audit to be safe.

---

## 7. Evidence nobody else can manufacture

Three real, dated, external events land inside this window. Kerb is the only kind of product that turns them into proof.

1. **HKEX lunch break, every weekday, roughly 04:00 to 05:00 UTC.** A recurring liquidity transition on a real asset on X Layer, filmable any day, no waiting for the weekend.
2. **Weekend closure, Fri 18 Sep 20:00 UTC to Mon 21 Sep 13:30 UTC.** Full closed-reference regime with the token still trading. Collectors must be capturing before 20:00 UTC today.
3. **The X Liquidity campaign ends 24 Sep 07:00 UTC (15:00 UTC+8).** Roughly $240K of incentives across those exact pools stops. If incentivised liquidity leaves, executable depth drops while the underlying market is unchanged. A textbook liquidity regime shift with a known timestamp, one day before submission, on pools Kerb will have measured for six days.

Measure it, do not predict it. Whatever happens, publish what happened with the raw observations attached. If depth does not move, that is also a finding, and it is still the only dataset of its kind.

---

## 8. Product surfaces

| Route | Purpose | Notes |
|---|---|---|
| `/` | Ten seconds to comprehension. Live regime strip plus the top Board rows | No wallet required |
| `/board` | Every tracked asset: regime, Credit Mark, executable depth at 1%, Carry LTV, Session Max LTV, next transition | The public utility that exists even for people who never borrow |
| `/asset/[symbol]` | Underlying market and session, impact curve, mark provenance, terms history, instrument profile | The instrument profile is the surviving piece of the old Originline idea: underlying, product issuer, wrapper, corporate-action method, redemption model, source links |
| `/market` | Supply USDG, deposit collateral, borrow as Carry or Session Max, positions, cure countdown | Testnet by default, clearly badged |
| `/methodology` | KTS-0.1 in full with a worked example and recompute instructions | The standard is public |
| `/reports` | Market-Time Reports | Distribution surface |
| `/proof` | The trust console | Highest ROI page in the repo |
| `/developers` | REST, SDK snippet, ABIs, Kerb Desk | Integration path |

**Design direction.** One typeface family (Archivo, width axis used for the clock and countdown), tabular figures, mono only for hashes and addresses. Dark default on a blue-slate base, with a session-tone system where light level encodes regime strength, and a single reserved accent for Last Call. The Session Strip (the trading week as a band with a live cursor and next transition) is the signature element and appears on every page. No card grids, no neon, no all-caps eyebrows, no arrows glued to buttons. Tokens in `docs/ARCHITECTURE.md`.

---

## 9. Track alignment, line by line

Build a Market minimum requirements:

| Requirement | Kerb |
|---|---|
| Deploy a working integration on X Layer | `KerbClock` and `KerbTerms` on X Layer mainnet, `KerbCredit` on X Layer testnet, all verified |
| Integrate tokenized stocks, RWA, launchpad or meme components | xStocks tokenized equities on X Layer as collateral and measurement subject, USDG as the loan asset |
| Provide contract addresses and technical links | `/proof` plus a README table, all explorer-linked |
| Show the working flow in your demo video | Full supply, borrow, Last Call, cure, verify path in three minutes |

Judging criteria:

| Criterion | Answer |
|---|---|
| Innovation | Session-aware credit capacity, Carry versus Session Max with a precommitted cure, depth computed from pool state rather than assumed |
| Product completeness | Board, market, methodology, proof, reports, developer surface, all live |
| User value | Borrow without selling, and without waking up liquidated by a market you could not see |
| Technical execution | Deterministic engine, reproducible reports, invariant-tested contracts, onchain attribution |
| Meaningful X Layer / OKX AI integration | Mainnet contracts, real X Layer pools, USDG, Builder Codes, optional OKX AI paid service |
| Growth potential | Terms is infrastructure other markets consume, and the dataset compounds |
| Contribution to OKX ecosystem | Makes X Layer's tokenized equities safely usable as collateral, which is the unlock the RWA push needs |

---

## 10. Competitive position

| Competitor | What they do | Why Kerb is not that |
|---|---|---|
| Aave, Morpho, Kamino, Jupiter Lend | Static collateral parameters per market, oracle-priced | They price the asset. Kerb underwrites the liquidation path and prices the session. |
| Chainlink, Pyth, RedStone | Reference prices, 24/5 equity coverage | They deliver a price. Kerb delivers credit capacity and treats oracle coverage gaps as an input. |
| Chaos Labs, LlamaRisk | Risk parameter recommendations on a governance cadence | Offchain, slow, per-protocol. Kerb publishes onchain, per session, reproducible by anyone. |


---

## 11. Traction plan during the build

- **Ship the Board public by D3.** Useful without an account, shareable, indexable, and the fallback submission if the credit market slips.
- **Publish Market-Time Report #1 on 24 Sep**, the same day as the campaign cliff, into the builder Telegram and X. Measured numbers only.
- **List Kerb Desk on OKX AI** only if P0 is stable by D6. Finance category. Real per-call settlement on X Layer is real revenue.
- Never fabricate users, never self-call to inflate counts, never present an estimate as a measurement.

---

## 12. Risk register

| Risk | Level | Mitigation |
|---|---|---|
| Collectors not running before the Friday close | Critical | Task one, before the repo is pretty and before any contract is written |
| Uniswap V3 factory or pool addresses on X Layer not found quickly | Critical | Discover from the OKX Earn product pages and the OKX DEX token list, confirm onchain by reading `token0/token1/fee/slot0`, then pin verified addresses in config with an explorer link each |
| Contract bug with real funds | High | Testnet default, mainnet credit only behind written approval and caps, invariants, fork tests, Slither, no upgradeability, guardian can pause borrows only |
| Attester key compromise | High | Key holds no funds, reports bounded by contract guardrails, tighten immediately and loosen only after cooldown, admin key stays local |
| Scope creep kills the demo | High | Tier gates in `docs/planning/BUILD_PLAN.md`, feature freeze 24 Sep, the P2 list is forbidden |
| Testnet USDG unobtainable | Medium | Ask Paxos and the Telegram group early; fallback is a clearly labelled `MockUSDG` on testnet with the real USDG address still wired for mainnet |
| Depth numbers look small | Medium | That is the finding. Small executable depth against large nominal TVL is the overhang story, and Kerb is the only product that shows it |
| Judges read it as another lending fork | Medium | Lead every surface with the Board and the coverage ratio, never with a supply table |
| Regulatory framing | Medium | No advice, no yield promises, non-US notice, "unaudited, guarded launch" labels, honest jurisdiction statement |

---

## 13. What must be true for this to win

1. The Board is live, real and unmistakably not a mock, by D3.
2. Last Call and cure work end to end, on a clock, in under 40 seconds of video.
3. `/proof` lets a skeptical engineer verify a number from raw inputs in under two minutes.
4. The demo is about three minutes and opens on live data, not a logo.
5. Nothing on any surface is fake, and every limitation is stated before a judge can find it.

---

## 14. Submission copy (draft, finalise on D7 from the real build)

**One line.** Kerb is a session-aware credit market for tokenized securities on X Layer.

**Short.** Tokenized equities trade around the clock, but their liquidation conditions do not stay constant around the clock. Kerb converts market session, conservative valuation and measured X Layer exit liquidity into reproducible onchain credit terms, then lends against them. Borrowers choose conservative Carry credit or higher Session Max credit that precommits to Last Call, a partial cure executed while liquidity is still deep.

**Company line.** Kerb Credit is the first consumer of Kerb Terms, which is designed to become the market-time risk layer other lenders and X Layer venue operators read instead of rebuilding.

**Closing line for the video.** Most protocols ask what an asset is worth. Kerb asks whether you could liquidate it when you need to. Credit on the market's clock.

---

## 15. The files in this pack

| File | Use |
|---|---|
| `docs/planning/KERB-MASTER-PLAN.md` | This document. Product DNA. Read once per session. |
| `AGENTS.md` | Repo constitution. Hard rules, gates, degradation ladders, definition of done. |
| `docs/KTS-0.1.md` | The Kerb Terms Standard: regime machine, formulas, report schema, reproducibility. |
| `docs/ARCHITECTURE.md` | Contracts, services, data model, security model, design tokens. |
| `docs/planning/BUILD_PLAN.md` | Task IDs, dependencies, acceptance criteria, day gates, kill list. |
| `KERB-BUILD-PROMPTS.md` | Paste-ready phase prompts for Codex and Claude Code. |
| `docs/planning/DEMO.md` | Storyboard, script, shot list, fallbacks. |
| `docs/planning/SUBMISSION.md` | Form answers, README skeleton, proof checklist, final-day runbook. |
| `PROJECT_STATE.md` | Living state and decision log. Update at every checkpoint. |
