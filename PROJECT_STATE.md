# PROJECT_STATE.md
## Living state. Update at every checkpoint. A new agent must be able to resume from this file alone.

Last updated: 18 Sep 2026, start of build.

---

## 1. Where we are

| Item | Status |
|---|---|
| Phase | 0 not started |
| Tier | T0 in progress |
| Collector | not running |
| Mainnet risk plane | not deployed |
| Testnet credit plane | not deployed |
| Web | not started |
| Kerb Desk (OKX AI) | not started, P1 |
| Participation route | undecided, deadline 24 Sep |
| Demo video | not recorded |

---

## 2. Addresses and links (fill as they exist, never guess)

| Thing | Network | Address / URL | Verified |
|---|---|---|---|
| KerbClock | X Layer mainnet 196 | | |
| KerbTerms | X Layer mainnet 196 | | |
| KerbClock | X Layer testnet 1952 | | |
| KerbTerms | X Layer testnet 1952 | | |
| KerbCredit | X Layer testnet 1952 | | |
| KerbClockDemo | X Layer testnet 1952 | | |
| kKOx mirror | X Layer testnet 1952 | | |
| kHKEXCx mirror | X Layer testnet 1952 | | |
| USDG | X Layer mainnet | 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8 | yes |
| USDG | X Layer testnet | 0xF0863D7A29a55d0c4263c11bFac754312ff078DF | yes |
| Builder Code (mainnet) | dev portal | | |
| Builder Code (testnet) | registerAuto on 0x00a3b805dbf39e5d54f9d09c130ff2132b4a0a21 | | |
| Repo | | github.com/talk2francis/kerb | |
| App | | | |
| API | | | |

---

## 3. Assets under observation

| Symbol | Underlying | Market | Pool | Quote | Pool address | First observation |
|---|---|---|---|---|---|---|
| KOx | KO | XNYS | Uniswap V3 | USDG | | |
| HKEXCx | HKEX | XHKG | Uniswap V3 | USDG | | |
| BRK.Bx | BRK.B | XNYS | Uniswap V3 | USDG | | |
| MIXUx | Mixue | XHKG | Uniswap V3 | USDG | | |
| KUAIx | Kuaishou | XHKG | Uniswap V3 | USDG | | |
| ICEx | ICE | XNYS | Uniswap V3 | USDG | | |
| SHEINx | SHEIN | | Uniswap V3 | USDG | | |
| COINx | COIN | XNAS | Uniswap V3 | xETH | | |
| BMNRx | BMNR | XNAS | Uniswap V3 | xETH | | |
| SLVx | Silver | XCOM | Uniswap V3 | USDC | | |

Market codes and underlying identifiers must be confirmed by the adapter against the issuer's data, not assumed from the ticker.

---

## 4. Degradation rungs currently in force

| Subsystem | Rung | Note |
|---|---|---|
| Reference price | | |
| Executable depth | | |
| Loan asset on testnet | | |
| Credit market deployment | | |
| Corporate action data | | |

---

## 5. Decisions

Format: date, decision, reason, alternatives considered, consequence.

| Date | Decision | Reason |
|---|---|---|
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
| | | |

---

## 8. Open blockers

| Blocker | Hypotheses tested | Current rung | Owner |
|---|---|---|---|
| | | | |

---

## 9. Checkpoint history

Paste each phase CHECKPOINT block here, newest first, so a fresh agent can read the build backwards.
