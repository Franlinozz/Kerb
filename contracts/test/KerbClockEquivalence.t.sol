// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {KerbClock} from "../src/KerbClock.sol";

/**
 * The equivalence test: KerbClock must agree with the TypeScript Clock resolver on 1,000
 * timestamps across XNYS and XHKG, using the same calendar data. This is the whole point of
 * putting the calendar onchain, so it is mandatory and it is exhaustive over the fixture.
 */
contract KerbClockEquivalenceTest is Test {
    KerbClock internal clock;
    address internal constant TIMELOCK = address(uint160(uint256(keccak256("kerb.timelock"))));
    bytes8[2] internal codes = [bytes8("XNYS"), bytes8("XHKG")];
    bytes32[2] internal assets;

    uint256[] internal marketsFlat;
    uint256[] internal weeklyFlat;
    uint256[] internal overrideDays;
    uint256[] internal overrideFlat;
    uint256[] internal cases;

    function setUp() public {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/../data/fixtures/clock/equivalence.json"));
        marketsFlat = abi.decode(vm.parseJson(json, ".marketsFlat"), (uint256[]));
        weeklyFlat = abi.decode(vm.parseJson(json, ".weeklyFlat"), (uint256[]));
        overrideDays = abi.decode(vm.parseJson(json, ".overrideDays"), (uint256[]));
        overrideFlat = abi.decode(vm.parseJson(json, ".overrideFlat"), (uint256[]));
        cases = abi.decode(vm.parseJson(json, ".cases"), (uint256[]));

        clock = new KerbClock(TIMELOCK, address(this));
        vm.startPrank(TIMELOCK);
        for (uint256 i; i < marketsFlat.length; i += 7) {
            uint256 mi = marketsFlat[i];
            assets[mi] = keccak256(abi.encode(uint256(196), address(uint160(mi + 1))));
            clock.setCalendar(
                codes[mi],
                KerbClock.MarketCalendar({
                    exists: true,
                    dstRule: marketsFlat[i + 2] == 1 ? KerbClock.DstRule.US_DST : KerbClock.DstRule.NONE,
                    utcOffsetMin: int32(int256(marketsFlat[i + 1] > 2 ** 200 ? int256(marketsFlat[i + 1]) : int256(marketsFlat[i + 1]))),
                    dstOffsetMin: uint16(marketsFlat[i + 3]),
                    coverageFromDay: uint32(marketsFlat[i + 4]),
                    coverageToDay: uint32(marketsFlat[i + 5])
                })
            );
            clock.setAssetMarket(assets[mi], codes[mi], uint32(marketsFlat[i + 6]));
        }
        _setWeekly();
        _setOverrides();
        vm.stopPrank();
    }

    function _sessionsFrom(uint256[] storage flat, uint256 keyA, uint256 keyB, bool useSecondKey)
        private
        view
        returns (KerbClock.Session[] memory out)
    {
        uint256 n;
        for (uint256 i; i < flat.length; i += 5) {
            if (flat[i] == keyA && (!useSecondKey || flat[i + 1] == keyB)) n++;
        }
        out = new KerbClock.Session[](n);
        uint256 k;
        for (uint256 i; i < flat.length; i += 5) {
            if (flat[i] == keyA && (!useSecondKey || flat[i + 1] == keyB)) {
                out[k++] = KerbClock.Session({
                    startMin: uint16(flat[i + 2]),
                    endMin: uint16(flat[i + 3]),
                    kind: KerbClock.SessionKind(flat[i + 4])
                });
            }
        }
    }

    function _setWeekly() private {
        for (uint256 mi; mi < codes.length; ++mi) {
            for (uint256 dow; dow < 7; ++dow) {
                KerbClock.Session[] memory ss = _sessionsFrom(weeklyFlat, mi, dow, true);
                if (ss.length > 0) clock.setWeekly(codes[mi], uint8(dow), ss);
            }
        }
    }

    function _setOverrides() private {
        for (uint256 i; i < overrideDays.length; i += 2) {
            uint256 mi = overrideDays[i];
            uint256 day = overrideDays[i + 1];
            clock.setDayOverride(codes[mi], uint32(day), _sessionsFrom(overrideFlat, mi, day, true));
        }
    }

    function test_fixtureHasOneThousandCases() public view {
        assertEq(cases.length / 8, 1000, "fixture must carry 1000 timestamps");
    }

    /// @notice Every fixture row: session kind, next transition, next weakening and the cure window.
    function test_matchesTypescriptResolverOnEveryTimestamp() public {
        // These are view calls over a long calendar walk; metering the whole sweep would hit
        // the block gas limit without telling us anything about correctness.
        vm.pauseGasMetering();
        uint256 rows = cases.length / 8;
        for (uint256 r; r < rows; ++r) {
            uint256 o = r * 8;
            bytes32 assetId = assets[cases[o]];
            uint64 ts = uint64(cases[o + 1]);

            (KerbClock.SessionKind kind,,) = clock.sessionAt(assetId, ts);
            assertEq(uint256(kind), cases[o + 2], _msg("session kind", r, ts));

            (uint8 nKind, uint64 nAt) = clock.nextTransition(assetId, ts);
            assertEq(uint256(nAt), cases[o + 4], _msg("next transition at", r, ts));
            assertEq(uint256(nKind), cases[o + 3], _msg("next transition kind", r, ts));

            (uint8 wKind, uint64 wAt) = clock.nextWeakening(assetId, ts);
            assertEq(uint256(wAt), cases[o + 6], _msg("next weakening at", r, ts));
            assertEq(uint256(wKind), cases[o + 5], _msg("next weakening kind", r, ts));

            (bool open,) = clock.cureWindowOpen(assetId, ts);
            assertEq(open ? 1 : 0, cases[o + 7], _msg("cure window", r, ts));
        }
    }

    function _msg(string memory what, uint256 row, uint64 ts) private pure returns (string memory) {
        return string.concat(what, " row ", vm.toString(row), " ts ", vm.toString(uint256(ts)));
    }
}
