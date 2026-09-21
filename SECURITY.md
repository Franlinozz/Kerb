# SECURITY.md

## Status

**These contracts are unaudited.** The mainnet deployment is the risk plane only: `KerbClock` and
`KerbTerms` hold no user funds and cannot move any. `KerbCredit`, which does handle money, runs on
X Layer testnet against clearly labelled mirror collateral. A mainnet `KerbCredit` deployment is
gated on written operator approval, green invariants and this report (AGENTS.md rule 9).

## Reporting

Security issues: open a GitHub issue on `Franlinozz/Kerb`, or contact the operator directly. There
is no bug bounty.

## What protects what

| Key | Holds | Can do | Cannot do |
|---|---|---|---|
| Admin / timelock | Operator's local machine | Set calendars, guardrails, attesters; list collateral | Move user funds |
| Attester | VPS | Sign Market-Time Reports; set expiring halt flags | Move funds, change guardrails, unpause |
| Poster | VPS | Pay gas to submit signed reports | Anything the signature does not already authorise |
| Guardian | Operator | Pause **borrow** and **deposit** | Pause repay, cure, liquidate, or a collateral withdrawal that leaves the position safe |

The liquidation threshold is fixed when collateral is listed and has **no setter**. No report, no
session and no passage of time moves it. Moving a liquidation line under a live borrower is the
failure mode this protocol exists to avoid.

## Slither

Run: `slither . --filter-paths "lib|test" --exclude-dependencies`
Version 0.11.6, 21 Sep 2026, 32 contracts, 102 detectors, **67 results, none High**.
Full output: `data/security/slither-2026-09-21.json` and `.txt`.

| Impact | Detector | Count | Disposition |
|---|---|---|---|
| Medium | `incorrect-equality` | 19 | **Accepted.** Every one is an exact `== 0` guard on internal accounting (`amount == 0`, `debtShares == 0`, `totalSupplied == 0`), not an equality against a token balance, a timestamp or an external value. Zero is the exact quantity being tested for, so a strict comparison is the correct one. |
| Medium | `unused-return` | 7 | **Accepted.** Deliberate partial tuple destructuring, e.g. `(bool open, ) = clock.cureWindowOpen(...)` where the close time is not needed at that call site. `ECDSA.tryRecover` is destructured to `(signer, err, )` and `err` **is** checked before the signer is trusted. |
| Medium | `divide-before-multiply` | 6 | **Accepted.** All six are inside `_daysFromCivil` / `_civilFromDays`, Howard Hinnant's civil-date algorithm, where the integer division is exact by construction. Correctness is enforced by the 1,000-timestamp equivalence fuzz test against the TypeScript resolver across XNYS and XHKG. |
| Medium | `uninitialized-local` | 2 | **Accepted.** `uint16 last` and `bool loosening` rely on the zero and false defaults as their intended starting values, and both are assigned before any read that could matter. |
| Low | `timestamp` | 21 | **Accepted, and inherent.** Kerb is a market-time protocol: session boundaries, report freshness, the Last Call window and interest accrual are all functions of `block.timestamp`. The windows involved are minutes to hours, far beyond the range a validator can shift. |
| Low | `missing-zero-check` | 2 | **Documented, not fixed.** `KerbClock.setAdmin` and `KerbTerms.setAdmin` accept `address(0)`. Both are `onlyTimelock`, so reaching this state requires the timelock to deliberately pass zero; the effect would be to disable attester management until the timelock set a new admin, and it cannot move funds. Both contracts are already deployed and verified on mainnet, and redeploying the risk plane to add a require on a timelock-only setter would cost more than it buys. Worth fixing in any future version. |
| Informational | `missing-inheritance` | 4 | **Accepted.** `src/interfaces/IKerb.sol` is the consumer-side view `KerbCredit` calls through, deliberately a narrow subset rather than the full contract surface. The shapes are pinned by the fork tests, which call the live mainnet `KerbTerms` through that interface. |
| Informational | `unused-state` | 2 | **Accepted.** `REGIME_HALTED` and `REGIME_STALE` in `KerbCredit` record the KTS-0.1 regime ordering next to the code that depends on it. `KerbCredit` itself defers to `effectiveTerms(...).usable` rather than comparing regimes, which is why they are not read. |
| Informational | other | 2 | **Accepted.** `DEMO_CALENDAR` is deliberately shouted in a non-CapWords name so a demo clock is unmistakable in a log; `MockUSDG.MockDeployed` is a testnet-only construction event. |

## Invariants

Eight invariants run under a guided handler, 256 runs x 64 calls:

1. `totalDebt <= totalSupplied + reserves`
2. Supply shares and debt shares each sum exactly to their totals
3. Collateral held equals the sum of recorded positions
4. The contract's token balance covers what it owes
5. No position owes more collateral than it holds
6. A cure never requires more than the debt
7. The debt index only ever rises
8. Ceilings at the draw, and "no healthy position was liquidated", asserted in the handler at the
   moment of each successful call, where the pre-state is still known

Deterministic coverage tests prove the handler actually reaches the cure and default paths: an
invariant suite that never borrows would make every property about cures vacuously true.

## Known limitations

- Unaudited.
- The testnet loan asset is `MockUSDG`, not real USDG. Stated in the token's own name.
- Mirror collateral has no economic claim on anything. Stated in the token's own name.
- `KerbClockDemo` compresses a trading week into an hour and is never deployed to mainnet.
- The attester is a single key. A compromised attester could post reports within the onchain
  guardrails, which is why those guardrails are absolute and timelocked, and why `effectiveTerms`
  refuses to be usable when a report is stale or the regime is STALE or HALTED.
