// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title KerbTerms
 * @notice Guardrailed registry of signed KTS-0.1 reports. Holds no funds and moves no tokens.
 * @dev The engine is allowed to be wrong; this contract is not allowed to let it be dangerous.
 *      Tightening applies immediately. Loosening is refused unless the cooldown has elapsed
 *      and the step is within maxLoosenStepBps. The liquidation threshold LT lives here as a
 *      fixed per-asset constant and is only ever changed by the timelock.
 */
contract KerbTerms is EIP712 {
    // ---------------------------------------------------------------- types

    struct Terms {
        uint64 observedAt;
        uint16 regime;
        uint128 creditMark; // 1e18
        uint64 carryLTV; // 1e18 fraction
        uint64 sessionMaxLTV; // 1e18 fraction
        uint128 debtCeiling; // loan-asset units
        uint128 maxPositionDebt;
        uint128 executableDepth1; // C(1%)
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

    /// @dev KTS-0.1 section 4.1 ordering.
    uint16 internal constant REGIME_HALTED = 6;
    uint16 internal constant REGIME_STALE = 7;
    uint256 internal constant BPS = 10_000;

    bytes32 private constant TERMS_TYPEHASH = keccak256(
        "TermsReport(bytes32 assetId,uint64 observedAt,uint16 regime,uint128 creditMark,uint64 carryLTV,uint64 sessionMaxLTV,uint128 debtCeiling,uint128 maxPositionDebt,uint128 executableDepth1,bytes32 inputsHash,bytes32 engineVersion)"
    );

    // ---------------------------------------------------------------- storage

    /// @dev Set at deployment to the bootstrap admin so calendars and guardrails can be loaded,
    ///      then handed to the real timelock by the timelock itself. Only it can move the role on.
    address public timelock;
    address public admin;

    mapping(address => bool) public isAttester;
    mapping(bytes32 => Terms) private _latest;
    mapping(bytes32 => Guardrails) private _guardrails;
    /// @dev Last time any value for this asset was increased, for the loosen cooldown.
    mapping(bytes32 => uint64) public lastLoosenAt;

    // ---------------------------------------------------------------- events

    event TermsPosted(
        bytes32 indexed assetId,
        address indexed attester,
        uint64 observedAt,
        uint16 regime,
        uint128 creditMark,
        uint64 carryLTV,
        uint64 sessionMaxLTV,
        uint128 debtCeiling,
        uint128 executableDepth1,
        bytes32 inputsHash
    );
    event GuardrailsUpdated(bytes32 indexed assetId, Guardrails guardrails);
    event AttesterSet(address indexed attester, bool allowed);
    event AdminSet(address indexed admin);
    event TimelockSet(address indexed timelock);

    // ---------------------------------------------------------------- errors

    error NotTimelock();
    error ZeroAddress();
    error NotAdmin();
    error UnknownAsset(bytes32 assetId);
    error BadSignature();
    error NotAnAttester(address signer);
    error ObservedAtNotIncreasing(uint64 observedAt, uint64 latest);
    error ReportTooOld(uint64 observedAt, uint32 maxAgeSec);
    error ReportInFuture(uint64 observedAt);
    error InputsHashRequired();
    error OutOfGuardrails(string field, uint256 value);
    error LoosenTooSoon(string field, uint64 sinceLastLoosen, uint32 cooldownSec);
    error LoosenTooFast(string field, uint256 fromValue, uint256 toValue, uint64 maxStepBps);

    modifier onlyTimelock() {
        if (msg.sender != timelock) revert NotTimelock();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address timelock_, address admin_) EIP712("Kerb Terms", "0.1") {
        if (timelock_ == address(0) || admin_ == address(0)) revert ZeroAddress();
        timelock = timelock_;
        admin = admin_;
        emit AdminSet(admin_);
        emit TimelockSet(timelock_);
    }

    // ---------------------------------------------------------------- admin

    /// @notice Hand the timelocked role to another address. Only the current holder may do it.
    function setTimelock(address newTimelock) external onlyTimelock {
        if (newTimelock == address(0)) revert ZeroAddress();
        timelock = newTimelock;
        emit TimelockSet(newTimelock);
    }

    function setAdmin(address newAdmin) external onlyTimelock {
        admin = newAdmin;
        emit AdminSet(newAdmin);
    }

    function setAttester(address attester, bool allowed) external onlyAdmin {
        isAttester[attester] = allowed;
        emit AttesterSet(attester, allowed);
    }

    function setGuardrails(bytes32 assetId, Guardrails calldata g) external onlyTimelock {
        if (g.ltvMin > g.ltvMax || g.ceilingMin > g.ceilingMax) revert OutOfGuardrails("bounds", 0);
        if (g.LT == 0 || g.LT > 1e18 || g.ltvMax > g.LT) revert OutOfGuardrails("LT", g.LT);
        Guardrails memory stored = g;
        stored.exists = true;
        _guardrails[assetId] = stored;
        emit GuardrailsUpdated(assetId, stored);
    }

    // ---------------------------------------------------------------- posting

    function hashTerms(bytes32 assetId, Terms calldata t) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    TERMS_TYPEHASH,
                    assetId,
                    t.observedAt,
                    t.regime,
                    t.creditMark,
                    t.carryLTV,
                    t.sessionMaxLTV,
                    t.debtCeiling,
                    t.maxPositionDebt,
                    t.executableDepth1,
                    t.inputsHash,
                    t.engineVersion
                )
            )
        );
    }

    /**
     * @notice Post a signed report. Anyone may relay it; only an enabled attester may sign it.
     * @dev Checks, then effects, then the event. No external calls are made at all.
     */
    function postTerms(bytes32 assetId, Terms calldata t, bytes calldata sig) external {
        Guardrails memory g = _guardrails[assetId];
        if (!g.exists) revert UnknownAsset(assetId);
        if (t.inputsHash == bytes32(0)) revert InputsHashRequired();

        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(hashTerms(assetId, t), sig);
        if (err != ECDSA.RecoverError.NoError || signer == address(0)) revert BadSignature();
        if (!isAttester[signer]) revert NotAnAttester(signer);

        Terms memory prev = _latest[assetId];
        if (t.observedAt <= prev.observedAt) revert ObservedAtNotIncreasing(t.observedAt, prev.observedAt);
        if (t.observedAt > block.timestamp) revert ReportInFuture(t.observedAt);
        if (block.timestamp - t.observedAt > g.maxReportAgeSec) revert ReportTooOld(t.observedAt, g.maxReportAgeSec);

        // Absolute bounds. A value outside them is refused, never silently clamped.
        if (t.carryLTV < g.ltvMin || t.carryLTV > g.ltvMax) revert OutOfGuardrails("carryLTV", t.carryLTV);
        if (t.sessionMaxLTV < g.ltvMin || t.sessionMaxLTV > g.ltvMax) revert OutOfGuardrails("sessionMaxLTV", t.sessionMaxLTV);
        if (t.sessionMaxLTV < t.carryLTV) revert OutOfGuardrails("sessionMaxLTV<carryLTV", t.sessionMaxLTV);
        if (t.sessionMaxLTV > g.LT) revert OutOfGuardrails("sessionMaxLTV>LT", t.sessionMaxLTV);
        if (t.debtCeiling < g.ceilingMin || t.debtCeiling > g.ceilingMax) revert OutOfGuardrails("debtCeiling", t.debtCeiling);
        if (t.creditMark == 0) revert OutOfGuardrails("creditMark", 0);

        // Tighten fast, loosen slow (KTS-0.1 section 4.3).
        bool loosening;
        if (prev.observedAt != 0) {
            loosening = _checkLoosen("carryLTV", prev.carryLTV, t.carryLTV, g, assetId)
                || _checkLoosen("sessionMaxLTV", prev.sessionMaxLTV, t.sessionMaxLTV, g, assetId)
                || _checkLoosen("debtCeiling", prev.debtCeiling, t.debtCeiling, g, assetId);
        }

        _latest[assetId] = t;
        if (loosening) lastLoosenAt[assetId] = uint64(block.timestamp);

        emit TermsPosted(
            assetId,
            signer,
            t.observedAt,
            t.regime,
            t.creditMark,
            t.carryLTV,
            t.sessionMaxLTV,
            t.debtCeiling,
            t.executableDepth1,
            t.inputsHash
        );
    }

    /// @dev Returns true when the value increased. Reverts when the increase is too soon or too large.
    function _checkLoosen(string memory field, uint256 from, uint256 to, Guardrails memory g, bytes32 assetId)
        private
        view
        returns (bool)
    {
        if (to <= from) return false;
        uint64 last = lastLoosenAt[assetId];
        uint64 since = last == 0 ? type(uint64).max : uint64(block.timestamp) - last;
        if (last != 0 && since < g.loosenCooldownSec) revert LoosenTooSoon(field, since, g.loosenCooldownSec);
        if (from > 0) {
            uint256 maxTo = from + (from * g.maxLoosenStepBps) / BPS;
            if (to > maxTo) revert LoosenTooFast(field, from, to, g.maxLoosenStepBps);
        }
        return true;
    }

    // ---------------------------------------------------------------- views

    function latest(bytes32 assetId) external view returns (Terms memory) {
        return _latest[assetId];
    }

    function guardrails(bytes32 assetId) external view returns (Guardrails memory) {
        return _guardrails[assetId];
    }

    /**
     * @notice What a consumer should act on.
     * @dev usable = false means "no new risk may be taken". It never means "liquidate everything":
     *      repayment and cures must keep working when terms are unusable.
     */
    function effectiveTerms(bytes32 assetId)
        external
        view
        returns (uint64 carryLTV, uint64 sessionMaxLTV, uint128 creditMark, uint16 regime, bool usable)
    {
        Terms memory t = _latest[assetId];
        Guardrails memory g = _guardrails[assetId];
        bool fresh = t.observedAt != 0 && block.timestamp - t.observedAt <= g.maxReportAgeSec;
        bool sound = t.regime != REGIME_STALE && t.regime != REGIME_HALTED;
        return (t.carryLTV, t.sessionMaxLTV, t.creditMark, t.regime, fresh && sound);
    }
}
