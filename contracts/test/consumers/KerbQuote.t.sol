// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KerbCredit} from "../../src/KerbCredit.sol";
import {IKerbClock, IKerbTerms, IWrapper} from "../../src/interfaces/IKerb.sol";
import {KerbQuote} from "../../src/consumers/KerbQuote.sol";
import {KerbMarkFeed} from "../../src/consumers/KerbMarkFeed.sol";
import {KerbMarkFeedFactory} from "../../src/consumers/KerbMarkFeedFactory.sol";
import {MockClock, MockERC20, MockTerms} from "../mocks/Mocks.sol";

/// V3-05, SPEC-ONCHAIN-CONSUMERS.md section 5: KerbQuote and KerbMarkFeed against mocks and a real
/// local KerbCredit. The fork tests against live mainnet are in KerbQuoteFork.t.sol.
contract KerbQuoteTest is Test {
    uint64 internal constant T0 = 1_790_000_000;
    MockTerms internal terms;
    MockClock internal clock;
    KerbQuote internal kq;
    MockERC20 internal token;
    bytes32 internal asset;

    function setUp() public {
        vm.warp(T0);
        terms = new MockTerms();
        clock = new MockClock();
        kq = new KerbQuote(IKerbTerms(address(terms)), IKerbClock(address(clock)), 6);
        token = new MockERC20("KOx", "KOx", 18);
        asset = kq.assetIdOf(block.chainid, address(token));
        _post(asset, 90e18, 0.55e18, 0.6e18, 25_000e6, 1);
        terms.setRails(asset, IKerbTerms.Guardrails({ ltvMin: 0.05e18, ltvMax: 0.65e18, ceilingMin: 0, ceilingMax: 1e12, maxLoosenStepBps: 200, loosenCooldownSec: 1800, maxReportAgeSec: 900, LT: 0.65e18, exists: true }));
        clock.setWindow(false, T0 + 3 hours);
        clock.setWeakening(T0 + 3 hours);
    }

    function _post(bytes32 id, uint128 mark, uint64 carry, uint64 smax, uint128 cap, uint16 regime) internal {
        terms.set(id, IKerbTerms.Terms({ observedAt: uint64(block.timestamp), regime: regime, creditMark: mark, carryLTV: carry, sessionMaxLTV: smax, debtCeiling: 100_000e6, maxPositionDebt: cap, executableDepth1: 120_000e6, inputsHash: keccak256("inputs"), engineVersion: keccak256("kts-0.2") }));
    }

    function test_quoteByHand() public view {
        KerbQuote.Quote memory q = kq.quoteToken(address(token), 10e18, KerbQuote.Mode.Carry);
        assertTrue(q.usable);
        assertEq(q.collateralValue, 900e6); // 10 tokens at 90 USDG
        assertEq(q.maxBorrow, 495e6); // 900 * 0.55
        assertEq(q.liquidationThreshold, 0.65e18);
        assertEq(q.cureDeadline, 0);
        assertEq(q.nextWeakeningAt, T0 + 3 hours);
        KerbQuote.Quote memory s = kq.quote(asset, 10e18, KerbQuote.Mode.SessionMax);
        assertEq(s.maxBorrow, 540e6);
        assertEq(s.cureDeadline, T0 + 3 hours);
    }

    function test_positionCapBinds() public view {
        assertEq(kq.maxBorrow(asset, 1_000e18, KerbQuote.Mode.SessionMax), 25_000e6); // 90,000 * 0.6 = 54,000 > cap
    }

    function test_unusable_reportsWithoutReverting_andTheFeedFailsClosed() public {
        KerbMarkFeed feed = new KerbMarkFeed(IKerbTerms(address(terms)), asset, "Kerb Credit Mark KOx / USDG");
        terms.setUnusable(asset, true);
        KerbQuote.Quote memory q = kq.quote(asset, 10e18, KerbQuote.Mode.Carry);
        assertFalse(q.usable);
        assertEq(q.maxBorrow, 0);
        assertEq(q.collateralValue, 900e6);
        vm.expectRevert(abi.encodeWithSelector(KerbMarkFeed.KerbUnusable.selector, uint16(1), uint64(T0)));
        feed.latestRoundData();
        (, int256 answer,,,) = feed.latestRoundDataUnsafe();
        assertEq(answer, 90e8);
        assertFalse(feed.usable());
    }

    function test_unknownAssetReverts() public {
        vm.expectRevert(abi.encodeWithSelector(KerbQuote.UnknownAsset.selector, bytes32(uint256(1))));
        kq.quote(bytes32(uint256(1)), 1e18, KerbQuote.Mode.Carry);
    }

    function test_feedShape() public {
        KerbMarkFeed feed = new KerbMarkFeed(IKerbTerms(address(terms)), asset, "Kerb Credit Mark KOx / USDG");
        (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
        assertEq(roundId, T0);
        assertEq(answeredInRound, T0);
        assertEq(startedAt, T0);
        assertEq(updatedAt, T0);
        assertEq(answer, 90e8);
        assertEq(feed.decimals(), 8);
        vm.expectRevert(abi.encodeWithSelector(KerbMarkFeed.NoHistory.selector, uint80(5)));
        feed.getRoundData(5);
    }

    function test_factoryIsDeterministic_andOneFeedPerAsset() public {
        KerbMarkFeedFactory f = new KerbMarkFeedFactory(IKerbTerms(address(terms)));
        bytes memory init = abi.encodePacked(type(KerbMarkFeed).creationCode, abi.encode(IKerbTerms(address(terms)), asset, "d"));
        address expected = vm.computeCreate2Address(asset, keccak256(init), address(f));
        assertEq(f.create(asset, "d"), expected);
        assertEq(f.feedOf(asset), expected);
        vm.expectRevert(abi.encodeWithSelector(KerbMarkFeedFactory.FeedExists.selector, asset, expected));
        f.create(asset, "d");
    }

    /// Any amount, any mark: never overflows, value and max borrow always round down.
    function testFuzz_roundsDown(uint256 amount, uint128 mark) public {
        amount = bound(amount, 1, 1e30);
        mark = uint128(bound(mark, 1, 1e24));
        _post(asset, mark, 0.55e18, 0.6e18, type(uint128).max, 1);
        KerbQuote.Quote memory q = kq.quote(asset, amount, KerbQuote.Mode.Carry);
        uint256 value = (amount * mark / 1e18) / 1e12;
        assertEq(q.collateralValue, value);
        assertLe(q.maxBorrow * 1e18, q.collateralValue * 0.55e18);
    }

    // assetIdOf equals the TypeScript assetId (packages/types) for all ten tracked tokens.
    function test_assetIdMatchesTheTypeScriptHelper() public view {
        string memory json = vm.readFile("../data/fixtures/consumers/asset-ids.json");
        for (uint256 i = 0; i < 10; i++) {
            string memory p = string.concat(".assets[", vm.toString(i), "]");
            address tok = vm.parseJsonAddress(json, string.concat(p, ".token"));
            bytes32 id = vm.parseJsonBytes32(json, string.concat(p, ".assetId"));
            assertEq(kq.assetIdOf(196, tok), id);
        }
    }
}

/// Parity: KerbQuote.maxBorrow is exactly KerbCredit's own borrowing power, in both modes.
contract KerbQuoteCreditParityTest is Test {
    uint64 internal constant T0 = 1_790_000_000;
    MockTerms internal terms;
    MockClock internal clock;
    KerbCredit internal credit;
    KerbQuote internal kq;
    MockERC20 internal usdg;
    MockERC20 internal kox;
    bytes32 internal asset;
    address internal alice = address(0xA11CE);
    address internal lender = address(0xB0B);

    function setUp() public {
        vm.warp(T0);
        usdg = new MockERC20("USDG", "USDG", 6);
        kox = new MockERC20("KOx", "KOx", 18);
        terms = new MockTerms();
        clock = new MockClock();
        credit = new KerbCredit(IERC20(address(usdg)), 6, IKerbTerms(address(terms)), IKerbClock(address(clock)), address(this), address(this), address(this),
            [uint256(0.01e18), uint256(0.04e18), uint256(0.6e18), uint256(0.8e18), uint256(0.1e18)]);
        kq = new KerbQuote(IKerbTerms(address(terms)), IKerbClock(address(clock)), 6);
        asset = kq.assetIdOf(block.chainid, address(kox));
        credit.listCollateral(asset, KerbCredit.CollateralConfig({ token: IERC20(address(kox)), wrapper: IWrapper(address(0)), tokenDecimals: 18, liquidationThreshold: 0.65e18, closeFactor: 0.5e18, cureBonus: 0.015e18, defaultBonus: 0.07e18, listed: false }));
        terms.set(asset, IKerbTerms.Terms({ observedAt: T0, regime: 1, creditMark: 87.654321987654321e18, carryLTV: 0.513456789012345678e18, sessionMaxLTV: 0.587654321098765432e18, debtCeiling: 10_000_000e6, maxPositionDebt: 5_000_000e6, executableDepth1: 10_000_000e6, inputsHash: keccak256("i"), engineVersion: keccak256("kts-0.2") }));
        clock.setWindow(false, T0 + 1 days);
        usdg.mint(lender, 100_000_000e6);
        vm.startPrank(lender);
        usdg.approve(address(credit), type(uint256).max);
        credit.supply(100_000_000e6);
        vm.stopPrank();
        kox.mint(alice, 1_000_000e18);
        vm.prank(alice);
        kox.approve(address(credit), type(uint256).max);
    }

    function _check(uint256 amount, KerbQuote.Mode mode) internal {
        uint256 snap = vm.snapshotState();
        vm.startPrank(alice);
        credit.deposit(asset, amount);
        uint256 m = kq.maxBorrow(asset, amount, mode);
        assertGt(m, 0);
        // One wei more than KerbQuote allows is refused by KerbCredit...
        vm.expectRevert();
        credit.borrow(asset, m + 1, uint8(mode));
        // ...and exactly what it allows is accepted.
        credit.borrow(asset, m, uint8(mode));
        vm.stopPrank();
        vm.revertToState(snap);
    }

    function test_parity_carry() public { _check(123.456789123456789e18, KerbQuote.Mode.Carry); }
    function test_parity_sessionMax() public { _check(123.456789123456789e18, KerbQuote.Mode.SessionMax); }

    function testFuzz_parity(uint256 amount, bool session) public {
        amount = bound(amount, 1e16, 50_000e18);
        _check(amount, session ? KerbQuote.Mode.SessionMax : KerbQuote.Mode.Carry);
    }
}
