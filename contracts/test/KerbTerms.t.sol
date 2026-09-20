// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {KerbTerms} from "../src/KerbTerms.sol";

contract KerbTermsTest is Test {
    KerbTerms internal terms;

    address internal timelock = makeAddr("timelock");
    address internal admin = makeAddr("admin");
    address internal relayer = makeAddr("relayer");
    uint256 internal attesterKey = 0xA11CE;
    address internal attester;
    uint256 internal strangerKey = 0xBAD;
    address internal stranger;

    bytes32 internal constant ASSET = keccak256("KOx");
    uint64 internal constant WAD = 1e18;
    uint64 internal constant T0 = 1_790_000_000;

    /// @dev via_ir caches block.timestamp within a function, so tests track time explicitly.
    uint64 internal nowTs;

    function _warp(uint64 by) internal returns (uint64) {
        nowTs += by;
        vm.warp(nowTs);
        return nowTs;
    }

    function setUp() public {
        attester = vm.addr(attesterKey);
        stranger = vm.addr(strangerKey);
        terms = new KerbTerms(timelock, admin);
        vm.prank(admin);
        terms.setAttester(attester, true);
        vm.prank(timelock);
        terms.setGuardrails(ASSET, _rails());
        nowTs = T0;
        vm.warp(nowTs);
    }

    function _rails() internal pure returns (KerbTerms.Guardrails memory) {
        return KerbTerms.Guardrails({
            ltvMin: 0.05e18,
            ltvMax: 0.6e18,
            ceilingMin: 0,
            ceilingMax: 250_000e18,
            maxLoosenStepBps: 200, // 2% per report
            loosenCooldownSec: 1800,
            maxReportAgeSec: 900,
            LT: 0.65e18,
            exists: false
        });
    }

    function _terms(uint64 observedAt) internal pure returns (KerbTerms.Terms memory) {
        return KerbTerms.Terms({
            observedAt: observedAt,
            regime: 1, // NORMAL
            creditMark: 86.7e18,
            carryLTV: 0.4e18,
            sessionMaxLTV: 0.5e18,
            debtCeiling: 10_000e18,
            maxPositionDebt: 2_500e18,
            executableDepth1: 13_000e18,
            inputsHash: keccak256("bundle"),
            engineVersion: bytes32("kerb-engine@0.1.0")
        });
    }

    function _sign(uint256 key, KerbTerms.Terms memory t) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, terms.hashTerms(ASSET, t));
        return abi.encodePacked(r, s, v);
    }

    function _post(KerbTerms.Terms memory t) internal {
        vm.prank(relayer);
        terms.postTerms(ASSET, t, _sign(attesterKey, t));
    }

    // ---------------------------------------------------------------- happy path

    function test_postsAndReadsBack() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        vm.expectEmit(true, true, false, true);
        emit KerbTerms.TermsPosted(ASSET, attester, t.observedAt, t.regime, t.creditMark, t.carryLTV, t.sessionMaxLTV, t.debtCeiling, t.executableDepth1, t.inputsHash);
        _post(t);
        assertEq(terms.latest(ASSET).carryLTV, 0.4e18);
        (uint64 carry, uint64 session, uint128 mark, uint16 regime, bool usable) = terms.effectiveTerms(ASSET);
        assertEq(carry, 0.4e18);
        assertEq(session, 0.5e18);
        assertEq(mark, 86.7e18);
        assertEq(regime, 1);
        assertTrue(usable);
    }

    function test_anyoneMayRelayAnAttestersSignature() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        vm.prank(stranger);
        terms.postTerms(ASSET, t, _sign(attesterKey, t));
        assertEq(terms.latest(ASSET).observedAt, t.observedAt);
    }

    // ---------------------------------------------------------------- revert paths (AGENTS.md section 9)

    function test_revertsWhenSignerIsNotAnAttester() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        bytes memory sig = _sign(strangerKey, t);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.NotAnAttester.selector, stranger));
        terms.postTerms(ASSET, t, sig);
    }

    function test_revertsOnAGarbageSignature() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        vm.expectRevert(KerbTerms.BadSignature.selector);
        terms.postTerms(ASSET, t, hex"1234");
    }

    function test_revertsWhenTheSignatureIsForDifferentValues() public {
        KerbTerms.Terms memory signed = _terms(nowTs);
        bytes memory sig = _sign(attesterKey, signed);
        KerbTerms.Terms memory tampered = signed;
        tampered.carryLTV = 0.6e18;
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.NotAnAttester.selector, vm.addr(attesterKey)));
        // Recovery yields some other address for the tampered payload, so the post is refused.
        try terms.postTerms(ASSET, tampered, sig) {
            revert("tampered report was accepted");
        } catch {}
    }

    function test_revertsOnAnUnknownAsset() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        bytes memory sig = _sign(attesterKey, t);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.UnknownAsset.selector, keccak256("NOPE")));
        terms.postTerms(keccak256("NOPE"), t, sig);
    }

    function test_revertsWithoutAnInputsHash() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        t.inputsHash = bytes32(0);
        bytes memory sig_t = _sign(attesterKey, t);
        vm.expectRevert(KerbTerms.InputsHashRequired.selector);
        terms.postTerms(ASSET, t, sig_t);
    }

    function test_revertsOnAStaleReport() public {
        KerbTerms.Terms memory t = _terms(T0 - 901);
        bytes memory sig_t = _sign(attesterKey, t);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.ReportTooOld.selector, t.observedAt, uint32(900)));
        terms.postTerms(ASSET, t, sig_t);
    }

    function test_revertsOnAReportFromTheFuture() public {
        KerbTerms.Terms memory t = _terms(T0 + 1);
        bytes memory sig_t = _sign(attesterKey, t);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.ReportInFuture.selector, t.observedAt));
        terms.postTerms(ASSET, t, sig_t);
    }

    function test_revertsWhenObservedAtDoesNotIncrease() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        _post(t);
        bytes memory sig_t = _sign(attesterKey, t);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.ObservedAtNotIncreasing.selector, t.observedAt, t.observedAt));
        terms.postTerms(ASSET, t, sig_t);
    }

    function test_revertsWhenAnLtvIsOutsideTheAbsoluteBounds() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        t.carryLTV = 0.61e18;
        t.sessionMaxLTV = 0.61e18;
        bytes memory sig_t = _sign(attesterKey, t);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.OutOfGuardrails.selector, "carryLTV", uint256(0.61e18)));
        terms.postTerms(ASSET, t, sig_t);

        KerbTerms.Terms memory low = _terms(nowTs);
        low.carryLTV = 0.01e18;
        bytes memory sig_low = _sign(attesterKey, low);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.OutOfGuardrails.selector, "carryLTV", uint256(0.01e18)));
        terms.postTerms(ASSET, low, sig_low);
    }

    function test_revertsWhenSessionMaxIsBelowCarry() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        t.sessionMaxLTV = 0.3e18;
        bytes memory sig_t = _sign(attesterKey, t);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.OutOfGuardrails.selector, "sessionMaxLTV<carryLTV", uint256(0.3e18)));
        terms.postTerms(ASSET, t, sig_t);
    }

    function test_revertsWhenTheCeilingIsOutsideTheBounds() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        t.debtCeiling = 250_001e18;
        bytes memory sig_t = _sign(attesterKey, t);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.OutOfGuardrails.selector, "debtCeiling", uint256(250_001e18)));
        terms.postTerms(ASSET, t, sig_t);
    }

    function test_revertsOnAZeroCreditMark() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        t.creditMark = 0;
        bytes memory sig_t = _sign(attesterKey, t);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.OutOfGuardrails.selector, "creditMark", uint256(0)));
        terms.postTerms(ASSET, t, sig_t);
    }

    // ---------------------------------------------------------------- tighten fast, loosen slow

    function test_tighteningAppliesImmediately() public {
        _post(_terms(nowTs));
        _warp(60);
        KerbTerms.Terms memory tighter = _terms(nowTs);
        tighter.carryLTV = 0.2e18;
        tighter.sessionMaxLTV = 0.25e18;
        tighter.debtCeiling = 1_000e18;
        _post(tighter);
        assertEq(terms.latest(ASSET).carryLTV, 0.2e18, "tightening is never delayed");
    }

    function test_revertsWhenLooseningBeforeTheCooldown() public {
        _post(_terms(nowTs));
        _warp(60);
        KerbTerms.Terms memory up = _terms(nowTs);
        up.carryLTV = 0.401e18;
        // The first post set no loosen timestamp, so this increase is allowed and starts the clock.
        _post(up);
        _warp(60);
        KerbTerms.Terms memory up2 = _terms(nowTs);
        up2.carryLTV = 0.402e18;
        bytes memory sig_up2 = _sign(attesterKey, up2);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.LoosenTooSoon.selector, "carryLTV", uint64(60), uint32(1800)));
        terms.postTerms(ASSET, up2, sig_up2);
    }

    function test_revertsWhenLooseningFasterThanTheMaximumStep() public {
        _post(_terms(nowTs));
        _warp(60);
        KerbTerms.Terms memory up = _terms(nowTs);
        up.carryLTV = 0.45e18; // +12.5%, far beyond 2%
        bytes memory sig_up = _sign(attesterKey, up);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.LoosenTooFast.selector, "carryLTV", uint256(0.4e18), uint256(0.45e18), uint64(200)));
        terms.postTerms(ASSET, up, sig_up);
    }

    function test_allowsLooseningWithinStepAfterTheCooldown() public {
        _post(_terms(nowTs));
        _warp(60);
        KerbTerms.Terms memory first = _terms(nowTs);
        first.carryLTV = 0.404e18;
        _post(first);
        _warp(1801);
        KerbTerms.Terms memory second = _terms(nowTs);
        second.carryLTV = 0.408e18;
        _post(second);
        assertEq(terms.latest(ASSET).carryLTV, 0.408e18);
    }

    // ---------------------------------------------------------------- usability

    function test_effectiveTermsIsUnusableWhenStaleByAge() public {
        _post(_terms(nowTs));
        _warp(901);
        (,,,, bool usable) = terms.effectiveTerms(ASSET);
        assertFalse(usable, "an old report may not gate new risk");
    }

    function test_effectiveTermsIsUnusableInStaleOrHaltedRegimes() public {
        KerbTerms.Terms memory t = _terms(nowTs);
        t.regime = 7; // STALE
        _post(t);
        (,,,, bool usableStale) = terms.effectiveTerms(ASSET);
        assertFalse(usableStale);

        _warp(60);
        KerbTerms.Terms memory h = _terms(nowTs);
        h.regime = 6; // HALTED
        _post(h);
        (,,,, bool usableHalted) = terms.effectiveTerms(ASSET);
        assertFalse(usableHalted);
    }

    function test_effectiveTermsIsUnusableBeforeAnyReport() public {
        (,,,, bool usable) = terms.effectiveTerms(keccak256("KOx"));
        assertFalse(usable);
    }

    // ---------------------------------------------------------------- access control

    function test_onlyAdminMaySetAttesters() public {
        vm.expectRevert(KerbTerms.NotAdmin.selector);
        terms.setAttester(stranger, true);
    }

    function test_onlyTimelockMaySetGuardrailsAndAdmin() public {
        vm.expectRevert(KerbTerms.NotTimelock.selector);
        terms.setGuardrails(ASSET, _rails());
        vm.expectRevert(KerbTerms.NotTimelock.selector);
        terms.setAdmin(stranger);
    }

    function test_timelockCanHandOverToAnotherTimelock() public {
        address newTimelock = makeAddr("newTimelock");
        vm.prank(timelock);
        terms.setTimelock(newTimelock);
        assertEq(terms.timelock(), newTimelock);

        // The old holder loses the role immediately.
        vm.prank(timelock);
        vm.expectRevert(KerbTerms.NotTimelock.selector);
        terms.setGuardrails(ASSET, _rails());

        vm.prank(newTimelock);
        terms.setGuardrails(ASSET, _rails());
    }

    function test_onlyTimelockMayHandOverAndNeverToZero() public {
        vm.prank(admin);
        vm.expectRevert(KerbTerms.NotTimelock.selector);
        terms.setTimelock(stranger);

        vm.prank(timelock);
        vm.expectRevert(KerbTerms.ZeroAddress.selector);
        terms.setTimelock(address(0));
    }

    function test_guardrailsRejectAnLtvCeilingAboveLt() public {
        KerbTerms.Guardrails memory bad = _rails();
        bad.ltvMax = 0.7e18; // above LT
        vm.prank(timelock);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.OutOfGuardrails.selector, "LT", uint256(0.65e18)));
        terms.setGuardrails(ASSET, bad);
    }

    function test_revokedAttesterCannotPost() public {
        vm.prank(admin);
        terms.setAttester(attester, false);
        KerbTerms.Terms memory t = _terms(nowTs);
        bytes memory sig_t = _sign(attesterKey, t);
        vm.expectRevert(abi.encodeWithSelector(KerbTerms.NotAnAttester.selector, attester));
        terms.postTerms(ASSET, t, sig_t);
    }

    // ---------------------------------------------------------------- fuzz

    /// @notice No accepted report can ever leave values outside the guardrails.
    function testFuzz_acceptedReportsAlwaysRespectGuardrails(uint64 carry, uint64 session, uint128 ceiling) public {
        carry = uint64(bound(carry, 0, 1e18));
        session = uint64(bound(session, 0, 1e18));
        ceiling = uint128(bound(ceiling, 0, 500_000e18));
        KerbTerms.Terms memory t = _terms(nowTs);
        t.carryLTV = carry;
        t.sessionMaxLTV = session;
        t.debtCeiling = ceiling;
        try terms.postTerms(ASSET, t, _sign(attesterKey, t)) {
            KerbTerms.Terms memory got = terms.latest(ASSET);
            KerbTerms.Guardrails memory g = terms.guardrails(ASSET);
            assertTrue(got.carryLTV >= g.ltvMin && got.carryLTV <= g.ltvMax);
            assertTrue(got.sessionMaxLTV >= g.ltvMin && got.sessionMaxLTV <= g.ltvMax);
            assertTrue(got.sessionMaxLTV >= got.carryLTV);
            assertTrue(got.sessionMaxLTV <= g.LT);
            assertTrue(got.debtCeiling <= g.ceilingMax);
        } catch {}
    }
}
