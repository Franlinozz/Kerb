// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {KerbClock} from "../src/KerbClock.sol";

contract KerbClockTest is Test {
    KerbClock internal clock;
    address internal timelock = makeAddr("timelock");
    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");
    address internal stranger = makeAddr("stranger");

    bytes8 internal constant XNYS = bytes8("XNYS");
    bytes32 internal constant ASSET = keccak256("KOx");
    uint32 internal constant DAY_2026_09_21 = 20717; // 2026-09-21
    uint64 internal constant MON_1400Z = 1789999200; // 2026-09-21T14:00:00Z = 10:00 EDT, inside the NY session
    uint64 internal constant MON_CLOSE = 1790020800; // 2026-09-21T20:00:00Z = 16:00 EDT

    function setUp() public {
        clock = new KerbClock(timelock, admin);
        vm.startPrank(timelock);
        clock.setCalendar(
            XNYS,
            KerbClock.MarketCalendar({
                exists: true,
                dstRule: KerbClock.DstRule.US_DST,
                utcOffsetMin: -300,
                dstOffsetMin: 60,
                coverageFromDay: 20423, // 2025-12-01
                coverageToDay: 21183 // 2027-12-31
            })
        );
        KerbClock.Session[] memory day = new KerbClock.Session[](3);
        day[0] = KerbClock.Session({startMin: 240, endMin: 570, kind: KerbClock.SessionKind.PRE});
        day[1] = KerbClock.Session({startMin: 570, endMin: 960, kind: KerbClock.SessionKind.REGULAR});
        day[2] = KerbClock.Session({startMin: 960, endMin: 1200, kind: KerbClock.SessionKind.POST});
        for (uint8 d = 1; d <= 5; ++d) clock.setWeekly(XNYS, d, day);
        clock.setAssetMarket(ASSET, XNYS, 3600);
        vm.stopPrank();
        vm.prank(admin);
        clock.setAttester(attester, true);
        vm.warp(MON_1400Z);
    }

    function test_resolvesTheSessionAndTheNextTransitions() public view {
        (KerbClock.SessionKind kind,,) = clock.sessionAt(ASSET, MON_1400Z);
        assertEq(uint256(kind), uint256(KerbClock.SessionKind.REGULAR));
        (uint8 nKind, uint64 nAt) = clock.nextTransition(ASSET, MON_1400Z);
        assertEq(nAt, MON_CLOSE, "16:00 ET close");
        assertEq(nKind, uint8(KerbClock.TransitionKind.SESSION_CLOSE));
        (, uint64 wAt) = clock.nextWeakening(ASSET, MON_1400Z);
        assertEq(wAt, nAt, "the close is the weakening");
    }

    function test_cureWindowOpensOneHourBeforeTheClose() public view {
        (bool openEarly,) = clock.cureWindowOpen(ASSET, MON_1400Z);
        assertFalse(openEarly);
        (bool openLate, uint64 closesAt) = clock.cureWindowOpen(ASSET, MON_CLOSE - 60);
        assertTrue(openLate);
        assertEq(closesAt, MON_CLOSE);
        (bool openAfter,) = clock.cureWindowOpen(ASSET, MON_CLOSE);
        assertFalse(openAfter, "the window closes at the weakening itself");
    }

    function test_calendarRegimeReflectsSessionHaltAndLastCall() public {
        assertEq(uint256(clock.calendarRegime(ASSET, MON_1400Z)), uint256(KerbClock.Regime.NORMAL));
        assertEq(uint256(clock.calendarRegime(ASSET, MON_CLOSE - 60)), uint256(KerbClock.Regime.PRE_TRANSITION));
        assertEq(uint256(clock.calendarRegime(ASSET, MON_CLOSE + 4 hours)), uint256(KerbClock.Regime.REFERENCE_CLOSED));
        vm.prank(attester);
        clock.setHalt(ASSET, true, MON_1400Z + 3600);
        assertEq(uint256(clock.calendarRegime(ASSET, MON_1400Z)), uint256(KerbClock.Regime.HALTED));
    }

    function test_haltsAlwaysExpire() public {
        vm.prank(attester);
        clock.setHalt(ASSET, true, MON_1400Z + 3600);
        assertTrue(clock.isHalted(ASSET, MON_1400Z));
        assertFalse(clock.isHalted(ASSET, MON_1400Z + 3601), "a halt cannot outlive its expiry");

        vm.prank(attester);
        vm.expectRevert(KerbClock.HaltNotExpiring.selector);
        clock.setHalt(ASSET, true, MON_1400Z - 1);
    }

    function test_onlyAttesterMayHalt() public {
        vm.prank(stranger);
        vm.expectRevert(KerbClock.NotAttester.selector);
        clock.setHalt(ASSET, true, MON_1400Z + 3600);
    }

    function test_onlyTimelockMayChangeCalendars() public {
        KerbClock.Session[] memory none = new KerbClock.Session[](0);
        vm.prank(admin);
        vm.expectRevert(KerbClock.NotTimelock.selector);
        clock.setDayOverride(XNYS, DAY_2026_09_21, none);

        vm.prank(stranger);
        vm.expectRevert(KerbClock.NotTimelock.selector);
        clock.setAssetMarket(ASSET, XNYS, 60);
    }

    function test_holidayOverrideClosesTheDay() public {
        KerbClock.Session[] memory none = new KerbClock.Session[](0);
        vm.prank(timelock);
        clock.setDayOverride(XNYS, DAY_2026_09_21, none);
        (KerbClock.SessionKind kind,,) = clock.sessionAt(ASSET, MON_1400Z);
        assertEq(uint256(kind), uint256(KerbClock.SessionKind.CLOSED));
    }

    function test_refusesTimestampsOutsideCoverage() public {
        vm.expectRevert();
        clock.sessionAt(ASSET, 1_700_000_000); // 2023, before coverage
    }

    function test_refusesUnknownAssetsAndMarkets() public {
        vm.expectRevert(abi.encodeWithSelector(KerbClock.UnknownAsset.selector, keccak256("NOPE")));
        clock.sessionAt(keccak256("NOPE"), MON_1400Z);

        KerbClock.Session[] memory none = new KerbClock.Session[](0);
        vm.prank(timelock);
        vm.expectRevert(abi.encodeWithSelector(KerbClock.UnknownMarket.selector, bytes8("XXXX")));
        clock.setWeekly(bytes8("XXXX"), 1, none);
    }

    function test_rejectsMalformedSessions() public {
        KerbClock.Session[] memory bad = new KerbClock.Session[](1);
        bad[0] = KerbClock.Session({startMin: 600, endMin: 600, kind: KerbClock.SessionKind.REGULAR});
        vm.prank(timelock);
        vm.expectRevert(KerbClock.BadSession.selector);
        clock.setWeekly(XNYS, 1, bad);

        KerbClock.Session[] memory closed = new KerbClock.Session[](1);
        closed[0] = KerbClock.Session({startMin: 1, endMin: 2, kind: KerbClock.SessionKind.CLOSED});
        vm.prank(timelock);
        vm.expectRevert(KerbClock.BadSession.selector);
        clock.setWeekly(XNYS, 1, closed);
    }

    /// @notice Whatever the timestamp, the reported session must contain it and the next transition must be ahead.
    function testFuzz_sessionContainsTheTimestampAndTransitionsMoveForward(uint64 ts) public view {
        ts = uint64(bound(ts, 1_767_225_600, 1_830_000_000)); // 2026-01-01 .. 2027-12-01
        (, uint64 startsAt, uint64 endsAt) = clock.sessionAt(ASSET, ts);
        assertLe(startsAt, ts);
        assertGt(endsAt, ts);
        (, uint64 nAt) = clock.nextTransition(ASSET, ts);
        assertGt(nAt, ts);
        (, uint64 wAt) = clock.nextWeakening(ASSET, ts);
        assertGe(wAt, nAt);
    }
}
