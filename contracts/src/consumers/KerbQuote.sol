// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IKerbClock, IKerbTerms} from "../interfaces/IKerb.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

/// @title KerbQuote
/// @notice Read-only reference consumer of Kerb Terms on X Layer: how much a lender may lend against
///         a collateral amount now, in Carry or Session Max, and until when. Holds nothing, owns
///         nothing, changes nothing, has no owner and no storage beyond two immutables. Unaudited.
///         Consumers must enforce their own staleness policy; `usable` already folds in KerbTerms'.
/// @dev    Valuation is KerbCredit's, to the wei (KerbCredit._collateralValue):
///           value = rescale(floor(amount * creditMark / 1e18), tokenDecimals -> loanDecimals, down)
///           maxBorrow = min(floor(value * ltv / 1e18), maxPositionDebt), 0 when not usable.
///         The Credit Mark prices one asset token (one xStock), never a wrapper share, so
///         `collateralAmount` is in asset-token base units; convert wrapper shares with the
///         wrapper's convertToAssets first.
contract KerbQuote {
    enum Mode {
        Carry,
        SessionMax
    }

    struct Quote {
        bool usable;
        uint16 regime;
        uint64 observedAt;
        uint128 creditMark; // 1e18, loan-asset units per asset token
        uint64 ltv; // 1e18, for the requested mode
        uint64 liquidationThreshold; // 1e18, fixed per asset
        uint256 collateralValue; // loan-asset base units
        uint256 maxBorrow; // loan-asset base units, rounded down, 0 if not usable
        uint128 maxPositionDebt;
        uint128 debtCeiling;
        uint128 executableDepth1;
        uint64 cureDeadline; // Session Max only: end of the next (or current) Last Call; else 0
        uint64 nextWeakeningAt;
        bytes32 inputsHash;
    }

    error UnknownAsset(bytes32 assetId);

    uint256 internal constant WAD = 1e18;
    IKerbTerms public immutable terms;
    IKerbClock public immutable clock;
    /// @notice Decimals of the loan asset the terms are denominated in (USDG: 6).
    uint8 public immutable loanDecimals;

    constructor(IKerbTerms terms_, IKerbClock clock_, uint8 loanDecimals_) {
        terms = terms_;
        clock = clock_;
        loanDecimals = loanDecimals_;
    }

    /// @notice keccak256(abi.encode(chainId, token)): the assetId KerbTerms keys an asset by.
    function assetIdOf(uint256 chainId, address token) public pure returns (bytes32) {
        return keccak256(abi.encode(chainId, token));
    }

    /// @notice A quote for an asset token held in 18-decimal units (every xStock on X Layer).
    function quote(bytes32 assetId, uint256 collateralAmount, Mode mode) public view returns (Quote memory q) {
        return _quote(assetId, collateralAmount, 18, mode);
    }

    function maxBorrow(bytes32 assetId, uint256 collateralAmount, Mode mode) external view returns (uint256) {
        return _quote(assetId, collateralAmount, 18, mode).maxBorrow;
    }

    /// @notice A quote by token address on this chain, reading the token's own decimals.
    function quoteToken(address token, uint256 collateralAmount, Mode mode) external view returns (Quote memory) {
        return _quote(assetIdOf(block.chainid, token), collateralAmount, IERC20Decimals(token).decimals(), mode);
    }

    function _quote(bytes32 assetId, uint256 amount, uint8 tokenDecimals, Mode mode) internal view returns (Quote memory q) {
        IKerbTerms.Terms memory t = terms.latest(assetId);
        if (t.observedAt == 0) revert UnknownAsset(assetId);
        (uint64 carry, uint64 sessionMax, uint128 mark, uint16 regime, bool usable) = terms.effectiveTerms(assetId);
        uint64 nowTs = uint64(block.timestamp);
        (, uint64 weakAt) = clock.nextWeakening(assetId, nowTs);

        q.usable = usable;
        q.regime = regime;
        q.observedAt = t.observedAt;
        q.creditMark = mark;
        q.ltv = mode == Mode.Carry ? carry : sessionMax;
        q.liquidationThreshold = terms.guardrails(assetId).LT;
        q.collateralValue = _value(amount, mark, tokenDecimals);
        q.maxPositionDebt = t.maxPositionDebt;
        q.debtCeiling = t.debtCeiling;
        q.executableDepth1 = t.executableDepth1;
        q.nextWeakeningAt = weakAt;
        q.inputsHash = t.inputsHash;
        if (mode == Mode.SessionMax) {
            (, uint64 closesAt) = clock.cureWindowOpen(assetId, nowTs);
            q.cureDeadline = closesAt;
        }
        if (usable) {
            uint256 byLtv = (q.collateralValue * q.ltv) / WAD;
            q.maxBorrow = byLtv < t.maxPositionDebt ? byLtv : t.maxPositionDebt;
        }
    }

    /// @dev KerbCredit._collateralValue with no wrapper: floor(amount * mark / 1e18), rescaled down.
    function _value(uint256 amount, uint256 mark, uint8 tokenDecimals) internal view returns (uint256) {
        if (amount == 0 || mark == 0) return 0;
        uint256 value = (amount * mark) / WAD;
        if (tokenDecimals == loanDecimals) return value;
        if (tokenDecimals < loanDecimals) return value * (10 ** (loanDecimals - tokenDecimals));
        return value / (10 ** (tokenDecimals - loanDecimals));
    }
}
