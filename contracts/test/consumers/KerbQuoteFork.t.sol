// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IKerbClock, IKerbTerms} from "../../src/interfaces/IKerb.sol";
import {KerbQuote} from "../../src/consumers/KerbQuote.sol";
import {KerbMarkFeed} from "../../src/consumers/KerbMarkFeed.sol";

/// V3-05: KerbQuote against the live X Layer mainnet KerbTerms and KerbClock, for one US asset,
/// one Hong Kong asset and SLVx: every field equals a hand computation from latest, guardrails and
/// effectiveTerms. Skipped, loudly, when no RPC is configured (CI runs --no-match-contract Fork).
contract KerbQuoteForkTest is Test {
    IKerbTerms internal constant TERMS = IKerbTerms(0x6D6eAf24C498df6cEF0954F6d19Ab4ea7b0102d5);
    IKerbClock internal constant CLOCK = IKerbClock(0xF765D374E0Ce576860a463F0d796Ad45c62161B8);
    address internal constant BRKB = 0x12992613fDd35aBe95DEc5a4964331b1ee23B50d;
    KerbQuote internal kq;
    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("KERB_RPC_MAINNET", string(""));
        if (bytes(rpc).length == 0) { emit log("KERB_RPC_MAINNET is not set: fork tests skipped"); return; }
        try vm.createSelectFork(rpc) { forked = true; } catch { emit log("could not reach the X Layer RPC: fork tests skipped"); return; }
        kq = new KerbQuote(TERMS, CLOCK, 6);
    }

    function _asset(uint256 i) internal view returns (address token, bytes32 id) {
        string memory json = vm.readFile("../data/fixtures/consumers/asset-ids.json");
        string memory p = string.concat(".assets[", vm.toString(i), "]");
        return (vm.parseJsonAddress(json, string.concat(p, ".token")), vm.parseJsonBytes32(json, string.concat(p, ".assetId")));
    }

    function _byHand(bytes32 id, uint256 amount, KerbQuote.Mode mode) internal view {
        KerbQuote.Quote memory q = kq.quote(id, amount, mode);
        IKerbTerms.Terms memory t = TERMS.latest(id);
        (uint64 carry, uint64 smax, uint128 mark, uint16 regime, bool usable) = TERMS.effectiveTerms(id);
        uint256 value = (amount * mark / 1e18) / 1e12;
        uint256 byLtv = value * (mode == KerbQuote.Mode.Carry ? carry : smax) / 1e18;
        uint256 expect = usable ? (byLtv < t.maxPositionDebt ? byLtv : t.maxPositionDebt) : 0;
        assertEq(q.collateralValue, value, "value");
        assertEq(q.maxBorrow, expect, "maxBorrow");
        assertEq(q.usable, usable);
        assertEq(q.regime, regime);
        assertEq(q.liquidationThreshold, TERMS.guardrails(id).LT);
        assertEq(q.inputsHash, t.inputsHash);
        (, uint64 closesAt) = CLOCK.cureWindowOpen(id, uint64(block.timestamp));
        assertEq(q.cureDeadline, mode == KerbQuote.Mode.SessionMax ? closesAt : 0);
    }

    function test_fork_threeAssetsByHand() public {
        if (!forked) return;
        string memory json = vm.readFile("../data/fixtures/consumers/asset-ids.json");
        for (uint256 i = 0; i < 10; i++) {
            string memory sym = vm.parseJsonString(json, string.concat(".assets[", vm.toString(i), "].symbol"));
            bytes32 h = keccak256(bytes(sym));
            if (h != keccak256("BRK.Bx") && h != keccak256("HKEXCx") && h != keccak256("SLVx")) continue;
            (, bytes32 id) = _asset(i);
            _byHand(id, 10e18, KerbQuote.Mode.Carry);
            _byHand(id, 10e18, KerbQuote.Mode.SessionMax);
            _byHand(id, 12345.678e18, KerbQuote.Mode.SessionMax);
        }
    }

    function test_fork_quoteTokenReadsDecimals() public {
        if (!forked) return;
        KerbQuote.Quote memory a = kq.quoteToken(BRKB, 10e18, KerbQuote.Mode.Carry);
        KerbQuote.Quote memory b = kq.quote(kq.assetIdOf(196, BRKB), 10e18, KerbQuote.Mode.Carry);
        assertEq(a.maxBorrow, b.maxBorrow);
        assertGt(a.observedAt, 0);
    }

    function test_fork_staleTermsAreNotUsable_andTheFeedFailsClosed() public {
        if (!forked) return;
        (, bytes32 id) = _asset(0);
        KerbMarkFeed feed = new KerbMarkFeed(TERMS, id, "Kerb Credit Mark / USDG");
        vm.warp(block.timestamp + TERMS.guardrails(id).maxReportAgeSec + 1 days);
        KerbQuote.Quote memory q = kq.quote(id, 10e18, KerbQuote.Mode.Carry);
        assertFalse(q.usable);
        assertEq(q.maxBorrow, 0);
        vm.expectRevert();
        feed.latestRoundData();
        feed.latestRoundDataUnsafe();
    }
}
