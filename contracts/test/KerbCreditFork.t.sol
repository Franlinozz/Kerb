// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KerbCredit} from "../src/KerbCredit.sol";
import {IKerbClock, IKerbTerms, IWrapper} from "../src/interfaces/IKerb.sol";
import {MockClock, MockTerms} from "./mocks/Mocks.sol";

/**
 * Fork tests against live X Layer mainnet state.
 *
 * The unit tests value collateral through a wrapper the test controls. These run the same path
 * against the real xStocks V2 wrapper on chain 196, so a change in the real contract's shape
 * breaks the build rather than the demo. They are skipped, loudly, when no RPC is configured.
 */
contract KerbCreditForkTest is Test {
    // The real xStocks V2 wrapper for KOx on X Layer, from config/assets.json.
    address internal constant WKOX = 0xE4784B45415AAc58b289f9373314261c788C91e8;
    address internal constant KOX = 0xdCC1a2699441079dA889B1F49e12B69cC791129b;
    address internal constant USDG = 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8;
    address internal constant KERB_TERMS = 0x6D6eAf24C498df6cEF0954F6d19Ab4ea7b0102d5;

    bytes32 internal constant ASSET = keccak256("KOx");
    uint256 internal constant WAD = 1e18;

    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("KERB_RPC_MAINNET", string(""));
        if (bytes(rpc).length == 0) {
            emit log("KERB_RPC_MAINNET is not set: fork tests skipped");
            return;
        }
        try vm.createSelectFork(rpc) {
            forked = true;
        } catch {
            emit log("could not reach the X Layer RPC: fork tests skipped");
        }
    }

    /// @dev The wrapper converts shares to underlying units. It is never itself a price.
    function test_fork_theRealWrapperConvertsShares() public view {
        if (!forked) return;
        uint256 perUnit = IWrapper(WKOX).convertToAssets(1e18);
        // A share is worth at least one underlying unit and cannot plausibly be worth a thousand.
        assertGt(perUnit, 0, "the wrapper returned zero for one share");
        assertLt(perUnit, 1_000e18, "the wrapper rate is implausible");
        assertEq(IWrapper(WKOX).convertToAssets(0), 0);
    }

    /// @dev Valuation must be linear in the amount, or the LTV maths does not hold.
    function test_fork_wrapperConversionIsLinear() public view {
        if (!forked) return;
        uint256 one = IWrapper(WKOX).convertToAssets(1e18);
        uint256 hundred = IWrapper(WKOX).convertToAssets(100e18);
        assertApproxEqRel(hundred, one * 100, 0.0001e18);
    }

    /// @dev The live mainnet KerbTerms must still answer the shape KerbCredit calls.
    function test_fork_liveTermsAnswerTheInterfaceKerbCreditUses() public view {
        if (!forked) return;
        bytes32 assetId = keccak256(abi.encode(uint256(196), KOX));
        (uint64 carry, uint64 sessionMax, uint128 mark,, bool usable) =
            IKerbTerms(KERB_TERMS).effectiveTerms(assetId);
        // Whether it is usable right now depends on the session; the shape must hold regardless.
        assertLe(carry, sessionMax, "carry above session max");
        assertLt(sessionMax, uint64(WAD), "session max is not a fraction");
        if (usable) {
            assertGt(mark, 0, "usable terms with no mark");
        }
    }

    /// @dev The whole valuation path, end to end, against the real wrapper and a real mark.
    function test_fork_collateralValuationThroughTheRealWrapper() public {
        if (!forked) return;
        MockTerms terms = new MockTerms();
        MockClock clock = new MockClock();

        KerbCredit credit = new KerbCredit(
            IERC20(USDG),
            6,
            IKerbTerms(address(terms)),
            IKerbClock(address(clock)),
            address(this),
            address(this),
            address(this),
            [uint256(0.01e18), uint256(0.04e18), uint256(0.6e18), uint256(0.8e18), uint256(0.1e18)]
        );

        credit.listCollateral(
            ASSET,
            KerbCredit.CollateralConfig({
                token: IERC20(WKOX),
                wrapper: IWrapper(WKOX),
                tokenDecimals: 18,
                liquidationThreshold: 0.65e18,
                closeFactor: 0.5e18,
                cureBonus: 0.015e18,
                defaultBonus: 0.07e18,
                listed: false
            })
        );

        terms.set(
            ASSET,
            IKerbTerms.Terms({
                observedAt: uint64(block.timestamp),
                regime: 1,
                creditMark: 90e18,
                carryLTV: 0.55e18,
                sessionMaxLTV: 0.60e18,
                debtCeiling: 100_000e6,
                maxPositionDebt: 25_000e6,
                executableDepth1: 100_000e6,
                inputsHash: keccak256("i"),
                engineVersion: keccak256("v")
            })
        );

        address user = makeAddr("forkUser");
        deal(WKOX, user, 100e18);
        deal(USDG, address(this), 200_000e6);
        IERC20(USDG).approve(address(credit), type(uint256).max);
        credit.supply(100_000e6);

        vm.startPrank(user);
        IERC20(WKOX).approve(address(credit), type(uint256).max);
        credit.deposit(ASSET, 100e18);

        // The position must be priced by the Credit Mark through the real wrapper rate.
        uint256 perUnit = IWrapper(WKOX).convertToAssets(1e18);
        uint256 expectedValue = (100e18 * perUnit / 1e18) * 90e18 / 1e18 / 1e12; // in 6-decimal USDG
        uint256 draw = expectedValue * 50 / 100; // 50%, inside the 55% Carry ceiling
        credit.borrow(ASSET, draw, 0);
        vm.stopPrank();

        assertApproxEqRel(credit.positionLTV(user, ASSET), 0.5e18, 0.001e18);
        assertGt(credit.healthFactor(user, ASSET), WAD);
    }
}
