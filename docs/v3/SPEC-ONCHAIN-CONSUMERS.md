# SPEC: ONCHAIN CONSUMERS
## `KerbQuote` and `KerbMarkFeed` on X Layer mainnet

---

## 1. Purpose

Today "any lender on X Layer can consume Kerb Terms" is true only in principle: a lender would have to read `KerbTerms.latest`, `guardrails`, `effectiveTerms` and `KerbClock` and reimplement Kerb Credit's arithmetic. V3 ships the two contracts a lender would actually call, deployed and verified on mainnet next to the terms they read. They hold no funds, have no owner and no state. They turn the infrastructure claim into something a judge can call with `cast`.

## 2. What exists onchain (read from source at `d7202a7`)

- `KerbTerms.latest(bytes32 assetId) returns (Terms)` with `observedAt, regime, creditMark (1e18), carryLTV (1e18), sessionMaxLTV (1e18), debtCeiling, maxPositionDebt, executableDepth1, inputsHash, engineVersion`.
- `KerbTerms.guardrails(bytes32) returns (Guardrails)` with `LT` (1e18) and `maxReportAgeSec`.
- `KerbTerms.effectiveTerms(bytes32) returns (carryLTV, sessionMaxLTV, creditMark, regime, usable)` where `usable` already requires a fresh report and a regime other than STALE or HALTED.
- `KerbClock.nextWeakening(bytes32, uint64) returns (uint8 kind, uint64 at)` and `KerbClock.cureWindowOpen(bytes32, uint64) returns (bool open, uint64 closesAt)`.

Mainnet addresses: KerbClock `0xf765d374e0ce576860a463f0d796ad45c62161b8`, KerbTerms `0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5`.

## 3. `KerbQuote`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title KerbQuote
/// @notice Read-only reference consumer of Kerb Terms on X Layer. Holds nothing, owns nothing,
///         changes nothing. Unaudited. Consumers must enforce their own staleness policy.
contract KerbQuote {
    enum Mode { Carry, SessionMax }

    struct Quote {
        bool usable;
        uint16 regime;
        uint64 observedAt;
        uint128 creditMark;        // 1e18, loan-asset units per collateral unit as KerbTerms posts it
        uint64 ltv;                // 1e18, for the requested mode
        uint64 liquidationThreshold; // 1e18, fixed
        uint256 collateralValue;   // loan-asset base units (USDG, 6 decimals)
        uint256 maxBorrow;         // loan-asset base units, min(value * ltv, maxPositionDebt), 0 if unusable
        uint128 maxPositionDebt;
        uint128 debtCeiling;
        uint128 executableDepth1;
        uint64 cureDeadline;       // SessionMax only: end of the next cure window, else 0
        uint64 nextWeakeningAt;
        bytes32 inputsHash;
    }

    IKerbTerms public immutable terms;
    IKerbClock public immutable clock;

    constructor(IKerbTerms terms_, IKerbClock clock_) { terms = terms_; clock = clock_; }

    function assetIdOf(uint256 chainId, address token) public pure returns (bytes32) {
        return keccak256(abi.encode(chainId, token)); // must equal @kerb/types assetId; tested
    }

    function quote(bytes32 assetId, uint256 collateralAmount, Mode mode) public view returns (Quote memory q);
    function maxBorrow(bytes32 assetId, uint256 collateralAmount, Mode mode) external view returns (uint256);
    function quoteToken(address token, uint256 collateralAmount, Mode mode) external view returns (Quote memory);
}
```

**Rules**
- **Valuation must match `KerbCredit` byte for byte.** Before writing `quote`, read `KerbCredit`'s collateral valuation (decimals handling, the wrapper or multiplier conversion, the WAD math, rounding direction) and reuse the same arithmetic. Round every borrow figure down.
- `collateralAmount` is in the collateral token's base units, exactly as `KerbCredit` accepts it.
- `maxBorrow = 0` when `usable` is false. `quote` never reverts on unusable terms; it reports them. It reverts only on unknown assets (`observedAt == 0`).
- `cureDeadline` for Session Max: if the cure window is open now, its `closesAt`; else the close of the window that ends at `nextWeakening`. Match the engine's definition; test against the API's `cure` field.
- No owner, no setters, no storage beyond the two immutables, no external calls except the view reads.

## 4. `KerbMarkFeed` and factory

A Chainlink `AggregatorV3Interface`-compatible view of one asset's Credit Mark, so an existing lender can put Kerb's conservative mark in an oracle slot.

```solidity
contract KerbMarkFeed /* is AggregatorV3Interface */ {
    IKerbTerms public immutable terms;
    bytes32 public immutable assetId;
    string public description;   // e.g. "Kerb Credit Mark BRK.Bx / USDG"
    uint8 public constant decimals = 8;
    uint256 public constant version = 1;

    /// Reverts KerbUnusable(regime, observedAt) when effectiveTerms.usable is false: fail closed.
    function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    /// Same values without the usability check, for monitoring only.
    function latestRoundDataUnsafe() external view returns (uint80, int256, uint256, uint256, uint80);
    function usable() external view returns (bool);
    function regime() external view returns (uint16);
    function getRoundData(uint80) external pure returns (uint80, int256, uint256, uint256, uint80); // reverts NoHistory
}

contract KerbMarkFeedFactory {
    event FeedCreated(bytes32 indexed assetId, address feed, string description);
    function create(bytes32 assetId, string calldata description) external returns (address feed); // CREATE2, salt = assetId
    function feedOf(bytes32 assetId) external view returns (address);
}
```

`roundId = answeredInRound = observedAt`, `answer = creditMark / 1e10`, `startedAt = updatedAt = observedAt`. The NatSpec states plainly: the Credit Mark is conservative by construction (the lower of reference and pool, less a regime haircut) and is not a mid-market price.

Deploy one factory and create feeds for all ten tracked assets.

## 5. Tests (Foundry, `contracts/test/consumers/`)

- Fork of X Layer mainnet at a recent block: for three assets (one US, one HK, SLVx) `quote` equals values computed by hand from `latest`, `guardrails` and `effectiveTerms`.
- Parity: a unit test builds the same collateral position in a local `KerbCredit` and asserts `KerbQuote.maxBorrow` equals `KerbCredit`'s own borrowing power for both modes.
- Unusable: warp past `maxReportAgeSec`; `usable` false, `maxBorrow` 0, `latestRoundData` reverts, `latestRoundDataUnsafe` does not.
- `assetIdOf` equals `@kerb/types` `assetId` for all ten tokens (fixture from `config/assets.json`).
- Decimals and rounding: fuzz amounts 1 wei to 1e30; no overflow; always rounds down.
- Factory: deterministic addresses; second `create` for the same asset reverts.
- Gas snapshot recorded.

## 6. Deployment

1. Deploy to X Layer testnet 1952 against the testnet KerbTerms and KerbClock first, verify on Sourcify, run the parity checks live.
2. Operator writes "go consumers mainnet". Deploy on 196 with the existing deployer (not the attester key). Expected gas well under 0.01 OKB. Attach the Builder Code suffix to the deploy and factory transactions.
3. Sourcify exact match for all contracts. Add to `config/deployments.json` under a `consumers` group.
4. `/proof` Contracts table gains a "Consumers" group; Developers Solidity tab lists the addresses.

## 7. UI and docs

Developers, Solidity tab, new first block **Use Kerb from your contract**:

```solidity
KerbQuote.Quote memory q = KerbQuote(0x…).quoteToken(HKEXCx_TOKEN, amount, KerbQuote.Mode.Carry);
require(q.usable, "Kerb: terms not usable");
require(debt <= q.maxBorrow, "Kerb: above Carry capacity");
```

Plus a live read (viem, client side) of `quoteToken(BRK.Bx, 10 tokens, Carry)` rendered as a small result card with block number, and a `cast call` line judges can paste. Then the feed table (asset, feed address, current answer, usable).

## 8. Claims allowed

"Any contract on X Layer can read Kerb Terms through KerbQuote, deployed and verified on mainnet at 0x…". Not "integrated by lenders" (no third party has integrated yet).
