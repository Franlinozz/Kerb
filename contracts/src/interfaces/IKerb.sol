// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The subset of KerbTerms that KerbCredit acts on.
interface IKerbTerms {
    struct Terms {
        uint64 observedAt;
        uint16 regime;
        uint128 creditMark; // 1e18
        uint64 carryLTV; // 1e18 fraction
        uint64 sessionMaxLTV; // 1e18 fraction
        uint128 debtCeiling; // loan-asset units
        uint128 maxPositionDebt;
        uint128 executableDepth1;
        bytes32 inputsHash;
        bytes32 engineVersion;
    }

    struct Guardrails {
        uint64 ltvMin;
        uint64 ltvMax;
        uint128 ceilingMin;
        uint128 ceilingMax;
        uint64 maxLoosenStepBps;
        uint32 loosenCooldownSec;
        uint32 maxReportAgeSec;
        uint64 LT;
        bool exists;
    }

    function latest(bytes32 assetId) external view returns (Terms memory);
    function guardrails(bytes32 assetId) external view returns (Guardrails memory);
    function effectiveTerms(bytes32 assetId)
        external
        view
        returns (uint64 carryLTV, uint64 sessionMaxLTV, uint128 creditMark, uint16 regime, bool usable);
}

/// @notice The subset of KerbClock that KerbCredit acts on.
interface IKerbClock {
    function cureWindowOpen(bytes32 assetId, uint64 ts) external view returns (bool open, uint64 closesAt);
    function nextWeakening(bytes32 assetId, uint64 ts) external view returns (uint8 kind, uint64 at);
}

/// @notice The xStocks wrapper surface Kerb values collateral through.
interface IWrapper {
    function convertToAssets(uint256 shares) external view returns (uint256);
}
