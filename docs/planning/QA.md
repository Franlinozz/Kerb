# QA matrix

Every row from AGENTS.md section 9, ticked with the evidence that backs it or marked not
applicable with a reason. Regenerate the test evidence with `./scripts/test-report.sh`.

Last run: 494 TypeScript tests, 106 Solidity tests, 0 failures.

## Engine and data

| Row | State | Evidence |
|---|---|---|
| Source down | ✅ | `records a source error instead of a row when a source fails`; `/health` and `/board` report a source as not reporting rather than dropping it |
| Source stale | ✅ | `excludes stale references and says why`; `stale observations are excluded; with none eligible depth is zero`; `fails loudly when no reference is fresh` |
| Sources disagreeing beyond threshold | ✅ | `takes the median reference and the conservative min(reference, pool)`; dispersion guard with `applies a bigger haircut in a weaker regime` |
| Pool with zero liquidity | ✅ | `zero-liquidity pool: nothing fills, exhausted at the observed range` |
| Pool with a single tick of liquidity | ✅ | `single initialised tick: liquidity ends at that tick and the rest does not fill` |
| Non-USD quote path | ✅ | `xETH-quoted asset routes through xETH/USDG and records the path`; `converts a non-USD reference with a fresh FX observation`; `excludes a non-USD reference when FX is missing or stale, rather than guessing a rate` |
| Multiplier change mid-observation | ✅ | `records issuer and onchain multipliers per asset`; `divides the pool price by the wrapper exchange rate to price the asset token`; `rejects a non-positive wrapper exchange rate instead of dividing by it` |
| Calendar holiday | ✅ | `holiday half day in HK closes early and names itself`; `early close is labelled`; 132 calendar tests over ≥40 timestamps |
| DST boundary | ✅ | Covered in the calendar suite; the onchain clock agrees with the resolver on 1,000 random timestamps across XNYS and XHKG |
| HKEX lunch break boundary | ✅ | `HK lunch is a first-class weakening boundary`; `HK morning: the lunch break is the next weakening and the 30 minute cure window opens` |
| Clock crossing UTC midnight | ✅ | `US close then post close`; `weekend: reference closed, last main open recorded, horizon to the next close's following open` |
| Duplicate observation | ✅ | Indexer is idempotent by transaction hash: `restarts from the stored cursor and only picks up new blocks` |
| Out-of-order observation | ✅ | `KerbTerms` rejects a non-increasing `observedAt` (`ObservedAtNotIncreasing`); the store is append-only and ordered by `ts` |
| Indexer restart | ✅ | `restarts from the stored cursor and only picks up new blocks` |
| Reorg | ✅ | `unwinds and re-indexes when a block hash no longer matches` |

## Contracts

| Row | State | Evidence |
|---|---|---|
| Borrow above Carry in Session Max mode | ✅ | `test_borrowAboveCarryIsAllowedInSessionMaxMode` |
| Borrow above Session Max (must revert) | ✅ | `test_borrowAboveSessionMaxReverts` |
| Cure before window opens (revert) | ✅ | `test_cureBeforeTheWindowOpensReverts` |
| Cure after window with correct partial size | ✅ | `test_cureAcceptsAPartialAmount` |
| Cure to exactly the Carry target | ✅ | `test_cureRepaysExactlyToTheCarryTarget`, and executed on chain: LTV 64.1667% → 55.00005% against a 55% target |
| Default liquidation at threshold | ✅ | `test_liquidateAtTheFixedThreshold`, `test_liquidateOnlyWhenHealthIsBelowOne` |
| Close factor respected | ✅ | `test_liquidateRespectsTheCloseFactor` |
| Repay while paused | ✅ | `test_repayWorksWhilePaused` |
| Withdraw while paused | ✅ | `test_withdrawingCollateralToSafetyWorksWhilePaused`, and `test_withdrawingCollateralThatWouldUnsafeThePositionReverts` |
| Attester posting beyond guardrail (revert) | ✅ | `clamps into the guardrails and records what was clamped`; every revert path in the KerbTerms suite |
| Attester loosening before cooldown (revert) | ✅ | `holds increases entirely while the loosen cooldown is running`; `caps loosening to maxLoosenStepBps against the posted values`; `does not cap tightening` |
| Stale report (revert borrow, allow repay) | ✅ | `test_borrowRevertsWhenTermsAreStale`, `test_repayWorksWhenTermsAreStale` |
| Debt ceiling reached | ✅ | `test_borrowRespectsTheDebtCeiling` |
| Supply cap reached | ✅ | `test_borrowRespectsTheMaxPositionDebt`, `test_withdrawCannotTakeBorrowedLiquidity` |
| Rounding never favours the user | ✅ | `test_supplyAndWithdrawRoundInTheProtocolsFavour`, `testFuzz_repayNeverClearsMoreDebtThanItPays`, and the solvency invariants |
| Reentrancy attempt | ✅ | `test_reentrancyOnCollateralTransferIsBlocked` |

## UI

| Row | State | Evidence |
|---|---|---|
| Wallet disconnected | ✅ | `ChainGuard` renders "Connect a wallet… Everything on this page is readable without one"; captured in the market screenshots |
| Wrong chain | ✅ | `ChainGuard` names the chain and offers the switch rather than showing numbers the user would not transact against |
| Transaction rejected | ✅ | `useTx` maps a user rejection to "You rejected the transaction in your wallet. Nothing was sent." |
| Transaction reverted | ✅ | `useTx` surfaces the contract's own custom error, e.g. `ExceedsModeLTV(...)`. Exercised for real: a stale cure amount reverted and the panel reported it, which is what led to the refetch-at-click fix |
| Transaction pending | ✅ | `useTx` distinguishes "Confirm in your wallet" from "Sent. Waiting for the block." |
| Stale data banner | ✅ | `/board` raises a stale banner and the asset page marks terms unusable; sources that stop are listed as not reporting |
| Empty board | ✅ | `BoardTable` renders "No assets are being tracked yet…"; `/reports` and the position lookup have their own empty states |
| Single asset board | ✅ | The table is driven entirely by the row array; the landing page renders exactly three rows from the same component |
| Mobile borrow flow | ✅ | Every page shot at 390 and reviewed; the mode choice stacks, tables scroll with a worded hint rather than truncating |
| Both themes | ✅ | Every page shot in dark and light at both widths |
| Reduced motion | ✅ | The one orchestrated motion is defined only inside `@media (prefers-reduced-motion: no-preference)`, so a reduced-motion visitor gets the state change with no animation at all |

## Not applicable

| Row | Why |
|---|---|
| Mainnet Kerb Credit paths | `KerbCredit` is deliberately not deployed to mainnet. AGENTS.md rule 9 gates it on written operator approval; the mainnet deployment is the risk plane only and holds no user funds |
| Audit findings | These contracts are unaudited and say so. Slither is run instead, with every finding dispositioned in `SECURITY.md` |
