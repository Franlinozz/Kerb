# ARCHITECTURE.md
## Kerb system design

---

## 1. System map

```
  xStocks public API        X Layer RPC (mainnet)         OKX DEX quote API      Chainlink Data Streams
  assets, wrappers,         Uniswap V3 pool state,        sell quotes at         24/5 equity reports
  multipliers, corporate    token contracts, multipliers  fixed notionals        (if credentials)
  actions, prices
          \                        |                            |                      /
           +------------------ apps/collector (VPS, PM2, fake mode by default) -------+
                                          |
                        append-only observation store (never deleted, bundled + pinned)
                                          |
                        apps/engine : KTS-0.1 pure functions
                        Clock | Mark | Depth (packages/v3math) | Capacity
                                          |
                        apps/attester : canonicalise -> hash -> pin -> EIP-712 sign -> post
                                          |
 +---------------------------- X Layer mainnet (chain 196) ---------------------------------+
 |  KerbClock            KerbTerms (guardrailed registry of signed reports)                  |
 |  events: RegimeChanged, TermsPosted, GuardrailUpdated                                     |
 +--------------------------------------------------------------------------------------------+
 +---------------------------- X Layer testnet (chain 1952) ---------------------------------+
 |  KerbClock  KerbTerms  KerbCredit (USDG testnet)  KerbMirror (mirror collateral)          |
 |  events: Supply, Withdraw, Deposit, Borrow, Repay, Cure, Liquidate                         |
 +--------------------------------------------------------------------------------------------+
          |                              |                                |
   apps/indexer -> Postgres         apps/api (REST + SDK)          apps/desk (OKX AI A2MCP, P1)
          |
   apps/web : Board, Asset, Market, Methodology, Reports, Proof, Developers
```

Chain is canonical. Postgres is a rebuildable view. The append-only observation store and the pinned input bundles are the only irreplaceable data, and they are never deleted.

---

## 2. Network facts (verified 18 Sep 2026)

| Item | Value |
|---|---|
| X Layer mainnet | chain id `196`, RPC `https://rpc.xlayer.tech`, explorer `https://www.oklink.com/xlayer`, gas token OKB |
| X Layer testnet | chain id `1952`, RPC `https://testrpc.xlayer.tech`, explorer `https://www.oklink.com/x-layer-testnet`, faucet `https://www.okx.com/xlayer/faucet` |
| USDG mainnet | `0x4ae46a509F6b1D9056937BA4500cb143933D2dc8` |
| USDG testnet | `0xF0863D7A29a55d0c4263c11bFac754312ff078DF` |
| Builder Codes | viem `>= 2.45.0`, `Attribution.toDataSuffix({ codes: ["<code>"] })` from `ox/erc8021`, set as `dataSuffix` on the wallet client. Mainnet code from the OKX developer portal. Testnet: call `registerAuto` on `0x00a3b805dbf39e5d54f9d09c130ff2132b4a0a21` |
| Target assets (live Uniswap V3 pools on X Layer, TVL observed 18 Sep) | BRK.Bx/USDG ~$127K, HKEXCx/USDG ~$79K, COINx/xETH ~$68K, KUAIx/USDG ~$62K, ICEx/USDG ~$62K, MIXUx/USDG ~$54K, KOx/USDG ~$52K, SHEINx/USDG ~$46K, BMNRx/xETH ~$138K, SLVx/USDC ~$27K |

Pool addresses are not assumed. The collector discovers them and the config file records each address with an explorer link and the timestamp it was verified.

**Primary demo assets**: `KOx` (US large cap, USDG quote, clean calendar), `HKEXCx` (Hong Kong, daily lunch break, the contrast that proves the per-asset clock), `BRK.Bx` (deepest USDG pool). `SLVx` and the xETH-quoted pairs exercise multi-hop depth and a non-equity calendar.

---

## 3. Contracts

Solidity, Foundry, OpenZeppelin. No upgradeability. No `delegatecall`. All external state-changing functions guarded and event-emitting.

### 3.1 KerbClock

Holds calendars and resolves regimes deterministically from chain time.

```solidity
enum Regime { DEEP, NORMAL, THIN, PRE_TRANSITION, REFERENCE_CLOSED, ACTION, HALTED, STALE, RECOVERY }

struct MarketCalendar {
    bytes8  marketCode;      // "XNYS", "XHKG", "XCOM"
    int32   utcOffsetMin;    // base offset
    bool    observesDst;
    uint32[7] sessionMask;   // packed session windows per weekday, minutes from local midnight
    // holidays and early closes held in mappings, set by timelocked admin
}

function calendarRegime(bytes32 assetId, uint64 ts) external view returns (Regime);
function nextTransition(bytes32 assetId, uint64 ts) external view returns (uint8 kind, uint64 at);
function nextWeakening(bytes32 assetId, uint64 ts) external view returns (uint8 kind, uint64 at);
function cureWindowOpen(bytes32 assetId, uint64 ts) external view returns (bool, uint64 closesAt);

function setCalendar(bytes8 marketCode, MarketCalendar calldata c) external onlyTimelock;
function setHolidays(bytes8 marketCode, uint32[] calldata days) external onlyTimelock;
function setAssetMarket(bytes32 assetId, bytes8 marketCode, uint32 cureWindowSec) external onlyTimelock;
function setHalt(bytes32 assetId, bool halted, uint64 expiry) external onlyAttester;   // always expiring
```

A separate `KerbClockDemo` deployment on testnet compresses one trading week into one hour for filming. It is a different contract name, emits `DEMO_CALENDAR` in its constructor event, and the UI badges anything reading it.

### 3.2 KerbTerms

Guardrailed registry of signed KTS reports. Holds no funds.

```solidity
struct Terms {
    uint64  observedAt;
    uint16  regime;
    uint128 creditMark;        // 1e18
    uint64  carryLTV;          // 1e18 fraction
    uint64  sessionMaxLTV;     // 1e18 fraction
    uint128 debtCeiling;       // loan-asset units
    uint128 maxPositionDebt;
    uint128 executableDepth1;  // C(1%)
    bytes32 inputsHash;
    bytes32 engineVersion;
}

struct Guardrails {
    uint64 ltvMin; uint64 ltvMax;
    uint128 ceilingMin; uint128 ceilingMax;
    uint64 maxLoosenStepBps;
    uint32 loosenCooldownSec;
    uint32 maxReportAgeSec;
    uint64 LT;                 // fixed liquidation threshold, timelocked
}

function postTerms(bytes32 assetId, Terms calldata t, bytes calldata sig) external;   // attester only
function latest(bytes32 assetId) external view returns (Terms memory);
function effectiveTerms(bytes32 assetId) external view
    returns (uint64 carryLTV, uint64 sessionMaxLTV, uint128 creditMark, uint16 regime, bool usable);
function setGuardrails(bytes32 assetId, Guardrails calldata g) external onlyTimelock;
function setAttester(address a, bool ok) external onlyAdmin;
```

Rules enforced in `postTerms`:
- signature recovers to an enabled attester over EIP-712 `TermsReport`
- `observedAt` strictly increasing and within `maxReportAgeSec` of `block.timestamp`
- every value clamped into guardrails, revert if outside absolute bounds
- tightening applies immediately, loosening requires `loosenCooldownSec` since the last increase and no more than `maxLoosenStepBps`
- `inputsHash != 0`

`effectiveTerms` returns `usable = false` when the latest report is older than `maxReportAgeSec` or the regime is `STALE` or `HALTED`. Consumers must treat `usable == false` as "no new risk may be taken", never as "liquidate everything".

### 3.3 KerbCredit

Isolated market: one loan asset (USDG), a whitelist of collateral assets, shares-based accounting.

```solidity
struct Position {
    uint128 collateralShares;
    uint128 debtShares;
    uint64  carryTarget;       // recorded at draw time
    uint8   mode;              // 0 = Carry, 1 = Session Max
    uint64  lastCureAt;
}

function supply(uint256 assets) external;                 // loan asset in
function withdraw(uint256 shares) external;
function deposit(bytes32 assetId, uint256 amount) external;   // collateral in
function withdrawCollateral(bytes32 assetId, uint256 amount) external;
function borrow(bytes32 assetId, uint256 amount, uint8 mode) external;
function repay(bytes32 assetId, uint256 amount) external;

function cure(address user, bytes32 assetId, uint256 repayAmount) external;      // partial, small bonus
function liquidate(address user, bytes32 assetId, uint256 repayAmount) external; // LT breach, standard bonus

function healthFactor(address user, bytes32 assetId) external view returns (uint256);
function cureStatus(address user, bytes32 assetId) external view
    returns (bool eligible, uint64 deadline, uint256 requiredRepay);
```

Invariants enforced by tests:
1. `totalDebt <= totalSupplied + reserves` at all times.
2. No borrow leaves `positionLTV > modeLTV` at the mark used in the same transaction.
3. No borrow leaves `assetDebt > debtCeiling` or `positionDebt > maxPositionDebt`.
4. `cure` may never repay more than the amount required to reach `min(carryTarget, currentCarryLTV)`.
5. `liquidate` may only run when `HF < 1` at `LT`, and never seizes more than the close factor allows.
6. Repay and `withdrawCollateral`-to-safety work in every state including paused and `STALE`.
7. Rounding always favours the protocol.
8. Interest accrual is monotonic and independent of call frequency within one block.

Interest: two-slope kink model on utilisation, reserve factor to a reserve address. Session premium on the portion of debt above the Carry target is P1 and is specified as a separate rate index, off by default.

Collateral valuation: `wrapper.convertToAssets(shares) * creditMark`. Legacy v1 wrappers are rejected by an explicit allowlist and a unit test proves a v1 wrapper deposit reverts.

Pausing: guardian may pause `borrow` and `deposit` only. `repay`, `withdraw` of collateral that keeps the position safe, `cure` and `liquidate` are never pausable.

### 3.4 KerbMirror (testnet only)

`KerbMirror` is an ERC-20 test collateral token, one deployment per mirrored asset (`kKOx`, `kHKEXCx`), mintable by a faucet function with a per-address cap. It has no economic claim on anything and says so in `name()` and on every UI surface: **Mirror asset, testnet only, no claim on any security**. Its price is the real mainnet Credit Mark for the corresponding asset, relayed by the attester into the testnet `KerbTerms`.

This is the honest way to demonstrate the credit lifecycle without the builder holding a restricted asset: real risk data, real testnet dollars, test collateral.

Mirror listings carry a liquidation threshold three points above mainnet (kKOx 68% against KOx 65%, kHKEXCx 63% against HKEXCx 60%): the testnet guardrail ceiling has to sit above the Session Max relayed from mainnet, or the contract clamps Session Max down to Carry and the cure covenant can never trigger, and the threshold sits six points above that ceiling so a position drawn to it is not liquidatable on the next small move of the compressed demo cycle. A listed threshold has no setter, so it stays fixed. The reasoning and the listing values are in `apps/attester/scripts/list-collateral.ts`.

---

## 4. Services

| Service | Job | Cadence | Notes |
|---|---|---|---|
| `collector` | Poll pool state, prices, multipliers, corporate actions, calendars. Write append-only observations | 60s pools, 30s prices, 10m schedules | Fake-provider mode by default in dev; `KERB_LIVE=1` to go live |
| `engine` | Pure KTS computation from a bundle | on demand | No I/O inside the computation path |
| `attester` | Canonicalise, hash, pin, sign, post | every 5 min and on regime change | Two keys: signer and poster. Skips posting if nothing changed beyond epsilon, always posts on regime change |
| `indexer` | Chain events to Postgres | every block batch | Idempotent, reorg-aware by block hash |
| `api` | REST, SDK backing, report and bundle serving | - | `GET /v1/terms/:chain/:asset`, `/v1/reports/:id`, `/v1/bundle/:hash`, `/v1/board`, `/health` |
| `desk` (P1) | OKX AI A2MCP tools with x402 settlement | - | Tools: `kerb_session`, `kerb_mark`, `kerb_depth`, `kerb_terms`, `kerb_position` |
| `web` | The product | - | Next.js, viem, wagmi with Builder Code data suffix |

Alerting: collector freshness, attester gas balance, RPC health, last successful post age. A single `/health` endpoint aggregates them and `/proof` displays the same numbers publicly.

---

## 5. Data model

Append-only, never deleted:

- `obs_pool_state(id, ts, chain_id, pool, sqrt_price_x96, tick, liquidity, ticks_blob_cid, source, content_hash)`
- `obs_price(id, ts, asset_id, source, value, raw_blob_cid, content_hash)`
- `obs_multiplier(id, ts, asset_id, multiplier, source, content_hash)`
- `obs_quote(id, ts, asset_id, notional, quote_out, source, content_hash)`
- `input_bundles(hash, cid, ts, asset_id, size)`

Derived, rebuildable:

- `assets`, `deployments`, `calendars`, `regime_events`
- `terms_reports(report_id, asset_id, ts, regime, credit_mark, carry_ltv, session_max_ltv, debt_ceiling, c1, inputs_hash, tx_hash, chain_id)`
- `positions`, `cures`, `liquidations`, `desk_calls`, `reports_md`

Retention: raw observations forever, bundled daily to IPFS with the day's manifest hash written to `KerbTerms` as a single `DayBundle` event. If Postgres dies, the chain plus IPFS rebuild everything that matters.

---

## 6. Provenance labels

Every number rendered anywhere carries one:

| Label | Meaning | UI treatment |
|---|---|---|
| `Verified` | Checked onchain in this transaction or by a verifiable report | Solid dot |
| `Observed` | Read from a named source, with timestamp and content hash | Hollow dot with source on hover |
| `Attested` | Signed by the Kerb attester inside contract guardrails | Half dot with signer and tx |
| `Computed` | Produced by KTS from pinned inputs | Bracketed, links to recompute |

A number with no label is a bug. A number whose label cannot be clicked through to evidence is a bug.

---

## 7. Security model

**Keys**

| Key | Location | Powers | Cannot |
|---|---|---|---|
| Admin / guardian | Operator's local machine only | Set attester set, pause borrow and deposit, timelocked guardrail and `LT` changes | Nothing automated touches it |
| Attester | VPS, encrypted at rest | Sign KTS reports, set expiring halt flags | Move funds, change guardrails, unpause |
| Poster | VPS | Pay gas to submit signed reports | Anything else |

**Threats and controls**

| Threat | Control |
|---|---|
| Attester key compromise | Reports bounded by guardrails; tighten-fast loosen-slow; expiring halts; guardian pause; rotation procedure documented and tested |
| Pool price manipulation | Credit Mark takes `min(reference, pool)`; TWAP where available; dispersion guard forces `STALE`; borrowing pauses on `STALE` |
| Thin-pool liquidation spiral | Debt ceiling capped by `C(1%)`; per-position cap; cure happens in deep regimes |
| Wrapper exchange-rate inflation | Current wrapper only, v1 rejected, exchange rate never used as a price |
| Corporate action or rebase surprise | `ACTION` regime around multiplier activation, new borrowing paused |
| Reentrancy and rounding | CEI ordering, `ReentrancyGuard`, rounding against the user, invariant fuzzing |
| Oracle staleness | `maxReportAgeSec` gate on borrow, never on repay |
| Operator error on mainnet | Mainnet credit behind a written approval gate with caps; deploy scripts print a confirmation summary and require an explicit env flag |
| Secret leakage | Allowlisted runner env, no secrets in logs or error payloads, `.env.example` only in git |
| Demo confusion | Demo calendar contract is separately named and badged; mirror tokens say so in their name |

**Explicit non-goals**: Kerb holds no custody outside the credit contract, does not bridge, does not upgrade, and does not claim to be audited.

---

## 8. The `/proof` page specification

Five sections, all generated from live state, no hardcoded values:

1. **Build period.** Repo link, first commit timestamp, commits per day, `BUILD_PERIOD.md` rendered, test counts from the last CI run.
2. **Onchain.** Every deployed address with explorer links, latest Terms transactions, a decoded Builder Code suffix from one of them, deployment block numbers, verification status.
3. **Data.** Last observation time per source, number of observations stored, the most recent day-bundle CID, a link to a raw bundle.
4. **Risk.** Pick any recent report: show its inputs hash, its bundle, and the command that recomputes it. Show the recompute result if the verifier has run.
5. **Limitations.** Which degradation rung each subsystem is on, what is testnet, what is mirror collateral, jurisdiction restriction statement, unaudited notice.

---

## 9. Design system

**Concept.** The interface runs on market time. The signature element is the Session Strip: the trading week as a band with session segments, a live cursor, the current regime named in words, and a countdown to the next transition. It appears on every page and is the first thing a judge sees.

**Colour (dark default).**

| Token | Hex | Use |
|---|---|---|
| `--surface` | `#121A24` | Base, blue slate rather than neutral black |
| `--text` | `#E6EAF0` | Primary text |
| `--tone-deep` | `#CFD8E3` | DEEP regime tone |
| `--tone-normal` | `#9FB0C2` | NORMAL |
| `--tone-thin` | `#7F8DA0` | THIN |
| `--tone-closed` | `#2B3646` | REFERENCE_CLOSED |
| `--accent-lastcall` | `#F0B43C` | Last Call and action-needed only |
| `--danger` | `#D9443F` | Liquidatable, always with text and glyph |

Light theme is first class: `--surface #EDF0F4`, `--text #15202C`, same tones inverted in luminance.

**Regime glyphs**, always beside the word: `DEEP` filled circle, `NORMAL` three-quarter, `THIN` half, `PRE_TRANSITION` triangle, `REFERENCE_CLOSED` hollow circle, `ACTION` square, `HALTED` filled square, `STALE` dash, `RECOVERY` arc. Never colour alone.

**Type.** Archivo variable, width axis expanded for the clock and countdown, tabular figures everywhere numbers align. JetBrains Mono only for addresses and hashes.

**Layout.** Left aligned, tables rather than card grids, numbers right aligned, every number with its provenance marker. One orchestrated motion in the whole product: the regime transition on the strip. Reduced motion swaps instantly.

**Copy.** Sentence case, plain verbs, buttons name their action and toasts use the same verb in the past tense. Errors say what happened and what to do next. Empty states invite an action.

---

## 10. Environment

```
# chain
KERB_CHAIN_ID=196
KERB_RPC_MAINNET=https://rpc.xlayer.tech
KERB_RPC_TESTNET=https://testrpc.xlayer.tech
KERB_BUILDER_CODE=

# contracts (filled by deploy scripts)
KERB_CLOCK_MAINNET= KERB_TERMS_MAINNET=
KERB_CLOCK_TESTNET= KERB_TERMS_TESTNET= KERB_CREDIT_TESTNET=

# assets
KERB_USDG_MAINNET=0x4ae46a509F6b1D9056937BA4500cb143933D2dc8
KERB_USDG_TESTNET=0xF0863D7A29a55d0c4263c11bFac754312ff078DF

# sources
XSTOCKS_API_BASE= OKX_DEX_API_KEY= OKX_DEX_API_SECRET= OKX_DEX_API_PASSPHRASE=
CHAINLINK_STREAMS_ID= CHAINLINK_STREAMS_SECRET=
PINATA_JWT=

# keys (never both on the same machine as the admin key)
KERB_ATTESTER_KEY= KERB_POSTER_KEY=

# modes
KERB_LIVE=0            # 1 enables live sources
KERB_DEMO_CLOCK=0      # 1 points the UI at the compressed demo calendar
```
