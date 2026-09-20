// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {KerbMirror} from "../src/KerbMirror.sol";
import {KerbClockDemo} from "../src/KerbClockDemo.sol";

contract KerbMirrorTest is Test {
    KerbMirror internal mirror;
    address internal alice = makeAddr("alice");

    function setUp() public {
        mirror = new KerbMirror("KOx", "KOx", 1_000e18);
    }

    /// @dev A screenshot of this token must never be mistaken for the real asset.
    function test_theNameSaysWhatItIs() public view {
        assertEq(mirror.name(), "MIRROR TESTNET KOx");
        assertEq(mirror.symbol(), "kKOx");
        assertEq(mirror.DISCLAIMER(), "Mirror asset, testnet only, no claim on any security");
        assertEq(mirror.mirrors(), "KOx");
    }

    function test_faucetMintsUpToTheCap() public {
        vm.prank(alice);
        mirror.faucet(600e18);
        assertEq(mirror.balanceOf(alice), 600e18);
        vm.prank(alice);
        mirror.faucet(400e18);
        assertEq(mirror.balanceOf(alice), 1_000e18);
    }

    function test_faucetRefusesBeyondTheCap() public {
        vm.prank(alice);
        mirror.faucet(1_000e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(KerbMirror.FaucetCapExceeded.selector, 1, 0));
        mirror.faucet(1);
    }

    /// @dev The cap is per address and survives sending the tokens away, so it cannot be recycled.
    function test_theCapCannotBeResetBySendingTokensAway() public {
        vm.startPrank(alice);
        mirror.faucet(1_000e18);
        mirror.transfer(makeAddr("elsewhere"), 1_000e18);
        vm.expectRevert();
        mirror.faucet(1e18);
        vm.stopPrank();
    }

    function test_faucetRefusesZero() public {
        vm.prank(alice);
        vm.expectRevert(KerbMirror.ZeroAmount.selector);
        mirror.faucet(0);
    }

    /// @dev A mirror has no wrapper above it, so a share is one unit of the underlying.
    function test_convertToAssetsIsOneToOne() public view {
        assertEq(mirror.convertToAssets(123e18), 123e18);
    }
}

contract KerbClockDemoTest is Test {
    KerbClockDemo internal demo;
    uint64 internal constant EPOCH = 1_790_000_000;
    uint64 internal constant WEEK = 3600; // one compressed trading week per hour
    uint64 internal constant SESSION_END = 3000;
    uint64 internal constant CURE_START = 2400;

    bytes32 internal constant ASSET = keccak256("kKOx");

    function setUp() public {
        demo = new KerbClockDemo(WEEK, SESSION_END, CURE_START, EPOCH);
    }

    /// @dev Anything consuming this clock can refuse to run against it.
    function test_itAnnouncesThatItIsADemo() public view {
        assertTrue(demo.isDemo());
    }

    function test_constructionEmitsTheDemoCalendarEvent() public {
        vm.recordLogs();
        new KerbClockDemo(WEEK, SESSION_END, CURE_START, EPOCH);
        assertEq(vm.getRecordedLogs().length, 1);
    }

    /// @dev via_ir caches block.timestamp within a function, so the time under test is passed
    ///      explicitly rather than read back after a warp.
    function test_theCureWindowOpensAndClosesOnSchedule() public view {
        (bool open,) = demo.cureWindowOpen(ASSET, EPOCH + 100); // in session, before Last Call
        assertFalse(open);

        (open,) = demo.cureWindowOpen(ASSET, EPOCH + CURE_START); // Last Call opens
        assertTrue(open);

        (bool stillOpen, uint64 closesAt) = demo.cureWindowOpen(ASSET, EPOCH + SESSION_END - 1);
        assertTrue(stillOpen); // still open at the last second
        assertEq(closesAt, EPOCH + SESSION_END);

        (open,) = demo.cureWindowOpen(ASSET, EPOCH + SESSION_END); // closed
        assertFalse(open);
    }

    function test_theScheduleRepeatsEveryCompressedWeek() public view {
        (bool open, uint64 closesAt) = demo.cureWindowOpen(ASSET, EPOCH + WEEK * 5 + CURE_START);
        assertTrue(open);
        assertEq(closesAt, EPOCH + WEEK * 5 + SESSION_END);
    }

    function test_nextWeakeningPointsAtTheSessionClose() public view {
        (, uint64 at) = demo.nextWeakening(ASSET, EPOCH + 100);
        assertEq(at, EPOCH + SESSION_END);

        // After the close it points at the next week's close, never at one already past.
        uint64 later = EPOCH + SESSION_END + 10;
        (, at) = demo.nextWeakening(ASSET, later);
        assertEq(at, EPOCH + WEEK + SESSION_END);
        assertGt(at, later);
    }

    function test_refusesAnImpossibleSchedule() public {
        vm.expectRevert(KerbClockDemo.BadSchedule.selector);
        new KerbClockDemo(WEEK, SESSION_END, SESSION_END, EPOCH); // cure starts when the session ends

        vm.expectRevert(KerbClockDemo.BadSchedule.selector);
        new KerbClockDemo(0, 0, 0, EPOCH);

        vm.expectRevert(KerbClockDemo.BadSchedule.selector);
        new KerbClockDemo(WEEK, WEEK + 1, CURE_START, EPOCH); // session outlasts the week
    }

    function testFuzz_theWindowIsNeverOpenOutsideItsSlot(uint32 offset) public view {
        uint64 ts = EPOCH + uint64(bound(offset, 0, WEEK * 20));
        (bool open,) = demo.cureWindowOpen(ASSET, ts);
        uint64 p = demo.phase(ts);
        assertEq(open, p >= CURE_START && p < SESSION_END);
    }
}
