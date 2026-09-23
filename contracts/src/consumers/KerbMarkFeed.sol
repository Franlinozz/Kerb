// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IKerbTerms} from "../interfaces/IKerb.sol";

/// @title KerbMarkFeed
/// @notice One asset's Kerb Credit Mark behind a Chainlink AggregatorV3Interface-shaped view, so a
///         lender can put Kerb's mark in an oracle slot. The Credit Mark is conservative by
///         construction (the lower of the reference median and the pool price along the whole
///         path, less a regime haircut); it is not a mid-market price. Fails closed: the latest
///         round reverts whenever KerbTerms says the terms are not usable (stale or halted).
///         No owner, no storage beyond immutables, no history (each round is the latest post).
contract KerbMarkFeed {
    error KerbUnusable(uint16 regime, uint64 observedAt);
    error NoHistory(uint80 roundId);

    IKerbTerms public immutable terms;
    bytes32 public immutable assetId;
    string public description;
    uint8 public constant decimals = 8;
    uint256 public constant version = 1;

    constructor(IKerbTerms terms_, bytes32 assetId_, string memory description_) {
        terms = terms_;
        assetId = assetId_;
        description = description_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        (,,, uint16 r, bool ok) = terms.effectiveTerms(assetId);
        if (!ok) revert KerbUnusable(r, terms.latest(assetId).observedAt);
        return _round();
    }

    /// @notice The same values without the usability check. For monitoring only, never for lending.
    function latestRoundDataUnsafe() external view returns (uint80, int256, uint256, uint256, uint80) {
        return _round();
    }

    function usable() external view returns (bool ok) {
        (,,,, ok) = terms.effectiveTerms(assetId);
    }

    function regime() external view returns (uint16 r) {
        (,,, r,) = terms.effectiveTerms(assetId);
    }

    function getRoundData(uint80 roundId) external pure returns (uint80, int256, uint256, uint256, uint80) {
        revert NoHistory(roundId);
    }

    /// @dev roundId = answeredInRound = observedAt; answer = creditMark / 1e10 (1e18 to 8 decimals).
    function _round() internal view returns (uint80, int256, uint256, uint256, uint80) {
        IKerbTerms.Terms memory t = terms.latest(assetId);
        return (uint80(t.observedAt), int256(uint256(t.creditMark / 1e10)), t.observedAt, t.observedAt, uint80(t.observedAt));
    }
}
