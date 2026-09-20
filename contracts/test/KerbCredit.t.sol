// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KerbCredit} from "../src/KerbCredit.sol";
import {IKerbClock, IKerbTerms, IWrapper} from "../src/interfaces/IKerb.sol";
import {MockClock, MockERC20, MockTerms, MockWrapper, ReentrantToken} from "./mocks/Mocks.sol";

/**
 * The QA matrix for contracts in AGENTS.md section 9, one test per line, plus the rounding and
 * covenant properties that make Kerb different from an ordinary LTV market.
 */
library Math2 {
    function mulDivUp(uint256 x, uint256 y, uint256 d) internal pure returns (uint256) {
        uint256 p = x * y;
        return p == 0 ? 0 : (p - 1) / d + 1;
    }
}

contract KerbCreditTest is Test {
    KerbCredit internal credit;
    MockERC20 internal usdg;
    MockERC20 internal kox;
    MockWrapper internal wrapper;
    MockTerms internal terms;
    MockClock internal clock;

    address internal admin = makeAddr("admin");
    address internal guardian = makeAddr("guardian");
    address internal reserve = makeAddr("reserve");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal curer = makeAddr("curer");

    bytes32 internal constant ASSET = keccak256("KOx");
    uint256 internal constant WAD = 1e18;
    uint64 internal constant T0 = 1_790_000_000;

    uint64 internal nowTs;

    function _warp(uint64 by) internal {
        nowTs += by;
        vm.warp(nowTs);
    }

    function setUp() public {
        usdg = new MockERC20("USDG", "USDG", 6);
        kox = new MockERC20("wKOx", "wKOx", 18);
        wrapper = new MockWrapper(18, 1e18); // 1 share = 1 underlying to start
        terms = new MockTerms();
        clock = new MockClock();

        credit = new KerbCredit(
            IERC20(address(usdg)),
            6,
            IKerbTerms(address(terms)),
            IKerbClock(address(clock)),
            admin,
            guardian,
            reserve,
            [uint256(0.01e18), uint256(0.04e18), uint256(0.6e18), uint256(0.8e18), uint256(0.1e18)]
        );

        vm.prank(admin);
        credit.listCollateral(ASSET, _config());

        _post(90e18, 0.55e18, 0.60e18, 100_000e6, 25_000e6);

        nowTs = T0;
        vm.warp(nowTs);

        usdg.mint(alice, 1_000_000e6);
        usdg.mint(bob, 1_000_000e6);
        usdg.mint(curer, 1_000_000e6);
        kox.mint(alice, 10_000e18);
        kox.mint(bob, 10_000e18);

        vm.prank(alice);
        usdg.approve(address(credit), type(uint256).max);
        vm.prank(bob);
        usdg.approve(address(credit), type(uint256).max);
        vm.prank(curer);
        usdg.approve(address(credit), type(uint256).max);
        vm.prank(alice);
        kox.approve(address(credit), type(uint256).max);
        vm.prank(bob);
        kox.approve(address(credit), type(uint256).max);

        // A deep pool, so liquidity is never the binding constraint unless a test makes it so.
        vm.prank(bob);
        credit.supply(500_000e6);
    }

    function _config() internal view returns (KerbCredit.CollateralConfig memory) {
        return KerbCredit.CollateralConfig({
            token: IERC20(address(kox)),
            wrapper: IWrapper(address(wrapper)),
            tokenDecimals: 18,
            liquidationThreshold: 0.65e18,
            closeFactor: 0.5e18,
            cureBonus: 0.015e18,
            defaultBonus: 0.07e18,
            listed: false
        });
    }

    function _post(uint128 mark, uint64 carry, uint64 sessionMax, uint128 ceiling, uint128 positionCap) internal {
        terms.set(
            ASSET,
            IKerbTerms.Terms({
                observedAt: uint64(block.timestamp == 0 ? T0 : block.timestamp),
                regime: 1,
                creditMark: mark,
                carryLTV: carry,
                sessionMaxLTV: sessionMax,
                debtCeiling: ceiling,
                maxPositionDebt: positionCap,
                executableDepth1: ceiling,
                inputsHash: keccak256("inputs"),
                engineVersion: keccak256("kts-0.1")
            })
        );
    }

    function _aliceDeposits(uint256 amount) internal {
        vm.prank(alice);
        credit.deposit(ASSET, amount);
    }

    // ================================================================ supply side

    function test_supplyAndWithdrawRoundInTheProtocolsFavour() public {
        uint256 before = usdg.balanceOf(alice);
        vm.prank(alice);
        uint256 shares = credit.supply(1_000e6);
        assertGt(shares, 0);
        vm.prank(alice);
        uint256 got = credit.withdraw(shares);
        // A round trip with no interest never returns more than was put in.
        assertLe(got, 1_000e6);
        assertLe(usdg.balanceOf(alice), before);
    }

    function test_withdrawCannotTakeBorrowedLiquidity() public {
        _post(90e18, 0.55e18, 0.60e18, 500_000e6, 500_000e6);
        _aliceDeposits(10_000e18); // 900,000 of value
        vm.prank(alice);
        credit.borrow(ASSET, 400_000e6, 0); // 44%, inside Carry
        uint256 shares = credit.supplyShares(bob);
        vm.prank(bob);
        vm.expectRevert();
        credit.withdraw(shares);
    }

    // ================================================================ borrowing

    function test_borrowAtCarryAndRecordsTheTarget() public {
        _aliceDeposits(100e18); // 100 * 90 = 9,000 USDG of value
        vm.prank(alice);
        credit.borrow(ASSET, 4_950e6, 0); // exactly 55%

        KerbCredit.Position memory p = credit.position(alice, ASSET);
        assertEq(p.carryTarget, 0.55e18);
        assertEq(p.mode, 0);
        assertEq(credit.debtOf(alice, ASSET), 4_950e6);
    }

    function test_borrowAboveCarryInCarryModeReverts() public {
        _aliceDeposits(100e18);
        vm.prank(alice);
        vm.expectRevert();
        credit.borrow(ASSET, 5_000e6, 0); // 55.6% > Carry 55%
    }

    function test_borrowAboveCarryIsAllowedInSessionMaxMode() public {
        _aliceDeposits(100e18);
        vm.prank(alice);
        credit.borrow(ASSET, 5_400e6, 1); // 60% == Session Max
        assertEq(credit.debtOf(alice, ASSET), 5_400e6);
        // The covenant target is still the Carry ceiling, not the Session Max one.
        assertEq(credit.position(alice, ASSET).carryTarget, 0.55e18);
    }

    function test_borrowAboveSessionMaxReverts() public {
        _aliceDeposits(100e18);
        vm.prank(alice);
        vm.expectRevert();
        credit.borrow(ASSET, 5_401e6, 1);
    }

    function test_borrowRevertsWhenTermsAreStale() public {
        _aliceDeposits(100e18);
        terms.setUnusable(ASSET, true);
        vm.prank(alice);
        vm.expectRevert();
        credit.borrow(ASSET, 1_000e6, 0);
    }

    function test_borrowRevertsWhenRegimeIsHalted() public {
        _aliceDeposits(100e18);
        IKerbTerms.Terms memory t = terms.latest(ASSET);
        t.regime = 6; // HALTED
        terms.set(ASSET, t);
        vm.prank(alice);
        vm.expectRevert();
        credit.borrow(ASSET, 1_000e6, 0);
    }

    function test_borrowRespectsTheDebtCeiling() public {
        _post(90e18, 0.55e18, 0.60e18, 1_000e6, 25_000e6);
        _aliceDeposits(1_000e18);
        vm.prank(alice);
        vm.expectRevert();
        credit.borrow(ASSET, 1_001e6, 0);
    }

    function test_borrowRespectsTheMaxPositionDebt() public {
        _post(90e18, 0.55e18, 0.60e18, 100_000e6, 500e6);
        _aliceDeposits(1_000e18);
        vm.prank(alice);
        vm.expectRevert();
        credit.borrow(ASSET, 501e6, 0);
    }

    function test_borrowRejectsAnUnknownMode() public {
        _aliceDeposits(100e18);
        vm.prank(alice);
        vm.expectRevert();
        credit.borrow(ASSET, 100e6, 2);
    }

    // ================================================================ the covenant

    function _drawAtSessionMax() internal {
        _aliceDeposits(100e18);
        vm.prank(alice);
        credit.borrow(ASSET, 5_400e6, 1); // 60%, above the 55% Carry target
    }

    function test_cureBeforeTheWindowOpensReverts() public {
        _drawAtSessionMax();
        clock.setWindow(false, 0);
        vm.prank(curer);
        vm.expectRevert(abi.encodeWithSelector(KerbCredit.CureWindowClosed.selector, ASSET));
        credit.cure(alice, ASSET, 100e6);
    }

    function test_cureRepaysExactlyToTheCarryTarget() public {
        _drawAtSessionMax();
        clock.setWindow(true, nowTs + 3600);

        (bool eligible,, uint256 required) = credit.cureStatus(alice, ASSET);
        assertTrue(eligible);
        // Value 9,000, target 55%, debt 5,400. The shortfall is 450, but the cure also seizes
        // 1.5% on top of what it repays, so the collateral shrinks as the debt does:
        // R = 450 / (1 - 0.55 * 1.015) = 1,018.675722.
        assertEq(required, 1_018_675_722);

        vm.prank(curer);
        (uint256 repaid,) = credit.cure(alice, ASSET, required);
        assertEq(repaid, required);

        // The cure actually cures: the position is at or below target afterwards, and no longer eligible.
        assertLe(credit.positionLTV(alice, ASSET), 0.55e18);
        (bool stillEligible,, uint256 nowRequired) = credit.cureStatus(alice, ASSET);
        assertEq(nowRequired, 0);
        assertFalse(stillEligible);
    }

    function test_cureCannotRepayMoreThanTheCovenantRequires() public {
        _drawAtSessionMax();
        clock.setWindow(true, nowTs + 3600);
        (,, uint256 required) = credit.cureStatus(alice, ASSET);
        vm.prank(curer);
        vm.expectRevert(abi.encodeWithSelector(KerbCredit.CureTooLarge.selector, required + 1, required));
        credit.cure(alice, ASSET, required + 1);
    }

    function test_cureAcceptsAPartialAmount() public {
        _drawAtSessionMax();
        clock.setWindow(true, nowTs + 3600);
        (,, uint256 before) = credit.cureStatus(alice, ASSET);
        vm.prank(curer);
        (uint256 repaid,) = credit.cure(alice, ASSET, 200e6);
        assertEq(repaid, 200e6);
        // A partial cure moves the position towards target without reaching it, and what is still
        // required falls by more than nothing and less than the whole.
        (,, uint256 remaining) = credit.cureStatus(alice, ASSET);
        assertGt(remaining, 0);
        assertLt(remaining, before);
        assertGt(credit.positionLTV(alice, ASSET), 0.55e18);
    }

    function test_curerIsPaidTheCureBonusInCollateral() public {
        _drawAtSessionMax();
        clock.setWindow(true, nowTs + 3600);
        uint256 before = kox.balanceOf(curer);
        vm.prank(curer);
        (, uint256 seized) = credit.cure(alice, ASSET, 450e6);
        // 450 USDG plus 1.5% = 456.75 of value, at a mark of 90 -> 5.075 collateral units.
        assertEq(seized, 5.075e18);
        assertEq(kox.balanceOf(curer) - before, seized);
    }

    function test_cureStopsBeingAvailableOnceTheBorrowerRepays() public {
        _drawAtSessionMax();
        clock.setWindow(true, nowTs + 3600);
        vm.prank(alice);
        credit.repay(ASSET, 450e6); // straight to the target, with no bonus to pay
        assertLe(credit.positionLTV(alice, ASSET), 0.55e18);
        vm.prank(curer);
        vm.expectRevert();
        credit.cure(alice, ASSET, 1e6);
    }

    function test_cureStopsBeingAvailableOnceTheBorrowerAddsCollateral() public {
        _drawAtSessionMax();
        clock.setWindow(true, nowTs + 3600);
        vm.prank(alice);
        credit.deposit(ASSET, 20e18);
        (bool eligible,, uint256 required) = credit.cureStatus(alice, ASSET);
        assertEq(required, 0);
        assertFalse(eligible);
    }

    /// @dev The covenant target is the tighter of the recorded target and the current ceiling, so
    ///      a later loosening cannot be used to escape a covenant that was already breached.
    function test_aLaterLooseningDoesNotRelaxAnExistingCovenant() public {
        _drawAtSessionMax();
        terms.setCarry(ASSET, 0.60e18); // Carry loosens to 60% after the draw
        clock.setWindow(true, nowTs + 3600);
        (,, uint256 required) = credit.cureStatus(alice, ASSET);
        // Still measured against the 55% recorded at the draw.
        assertEq(required, 1_018_675_722);
    }

    /// @dev And a tightening applies immediately, because the borrower is always held to the
    ///      stricter of the two.
    function test_aLaterTighteningAppliesImmediately() public {
        _drawAtSessionMax();
        terms.setCarry(ASSET, 0.50e18);
        clock.setWindow(true, nowTs + 3600);
        (,, uint256 required) = credit.cureStatus(alice, ASSET);
        // Allowed debt 9,000 * 50% = 4,500, a shortfall of 900, grossed up for the bonus.
        assertEq(required, Math2.mulDivUp(900e6, 1e18, 1e18 - (0.5e18 * 1.015e18) / 1e18));
        vm.prank(curer);
        credit.cure(alice, ASSET, required);
        assertLe(credit.positionLTV(alice, ASSET), 0.50e18);
    }

    // ================================================================ default liquidation

    function test_liquidateOnlyWhenHealthIsBelowOne() public {
        _drawAtSessionMax();
        assertGe(credit.healthFactor(alice, ASSET), WAD);
        vm.prank(bob);
        vm.expectRevert();
        credit.liquidate(alice, ASSET, 100e6);
    }

    function test_liquidateAtTheFixedThreshold() public {
        _drawAtSessionMax();
        terms.setMark(ASSET, 80e18); // value 8,000; LT 65% -> 5,200 < debt 5,400
        assertLt(credit.healthFactor(alice, ASSET), WAD);

        uint256 before = kox.balanceOf(bob);
        vm.prank(bob);
        (uint256 repaid, uint256 seized) = credit.liquidate(alice, ASSET, 1_000e6);
        assertEq(repaid, 1_000e6);
        // 1,000 plus 7% = 1,070 of value at a mark of 80 -> 13.375 collateral.
        assertEq(seized, 13.375e18);
        assertEq(kox.balanceOf(bob) - before, seized);
    }

    function test_liquidateRespectsTheCloseFactor() public {
        _drawAtSessionMax();
        terms.setMark(ASSET, 80e18);
        uint256 debt = credit.debtOf(alice, ASSET);
        vm.prank(bob);
        vm.expectRevert();
        credit.liquidate(alice, ASSET, debt / 2 + 1e6);
    }

    /// @dev The whole point of the design: the session moves capacity, never the liquidation line.
    function test_theLiquidationThresholdNeverMovesWithTheSession() public {
        _drawAtSessionMax();
        uint256 hfBefore = credit.healthFactor(alice, ASSET);
        // The session weakens hard: both ceilings collapse.
        _post(90e18, 0.20e18, 0.25e18, 100_000e6, 25_000e6);
        assertEq(credit.healthFactor(alice, ASSET), hfBefore);
        vm.prank(bob);
        vm.expectRevert();
        credit.liquidate(alice, ASSET, 100e6);
    }

    // ================================================================ pausing

    function test_guardianMayPauseBorrowAndDepositOnly() public {
        _aliceDeposits(100e18);
        vm.prank(alice);
        credit.borrow(ASSET, 1_000e6, 0);

        vm.prank(guardian);
        credit.setPaused(true, true);

        vm.prank(alice);
        vm.expectRevert(KerbCredit.BorrowPaused.selector);
        credit.borrow(ASSET, 1e6, 0);

        vm.prank(alice);
        vm.expectRevert(KerbCredit.DepositPaused.selector);
        credit.deposit(ASSET, 1e18);
    }

    function test_repayWorksWhilePaused() public {
        _aliceDeposits(100e18);
        vm.prank(alice);
        credit.borrow(ASSET, 1_000e6, 0);
        vm.prank(guardian);
        credit.setPaused(true, true);
        vm.prank(alice);
        credit.repay(ASSET, 1_000e6);
        assertEq(credit.debtOf(alice, ASSET), 0);
    }

    function test_withdrawingCollateralToSafetyWorksWhilePaused() public {
        _aliceDeposits(100e18);
        vm.prank(alice);
        credit.borrow(ASSET, 1_000e6, 0);
        vm.prank(guardian);
        credit.setPaused(true, true);
        vm.prank(alice);
        credit.withdrawCollateral(ASSET, 10e18);
        assertEq(credit.position(alice, ASSET).collateralShares, 90e18);
    }

    function test_withdrawingCollateralThatWouldUnsafeThePositionReverts() public {
        _aliceDeposits(100e18);
        vm.prank(alice);
        credit.borrow(ASSET, 5_000e6, 1);
        vm.prank(alice);
        vm.expectRevert();
        credit.withdrawCollateral(ASSET, 95e18);
    }

    function test_cureAndLiquidateWorkWhilePaused() public {
        _drawAtSessionMax();
        vm.prank(guardian);
        credit.setPaused(true, true);
        clock.setWindow(true, nowTs + 3600);
        vm.prank(curer);
        credit.cure(alice, ASSET, 450e6);
        assertEq(credit.debtOf(alice, ASSET), 4_950e6);
    }

    function test_repayWorksWhenTermsAreStale() public {
        _aliceDeposits(100e18);
        vm.prank(alice);
        credit.borrow(ASSET, 1_000e6, 0);
        terms.setUnusable(ASSET, true);
        vm.prank(alice);
        credit.repay(ASSET, 1_000e6);
        assertEq(credit.debtOf(alice, ASSET), 0);
    }

    function test_collateralWithNoDebtIsWithdrawableEvenWithNoMark() public {
        _aliceDeposits(50e18);
        terms.setMark(ASSET, 0);
        vm.prank(alice);
        credit.withdrawCollateral(ASSET, 50e18);
        assertEq(kox.balanceOf(alice), 10_000e18);
    }

    // ================================================================ valuation

    /// @dev The wrapper converts shares to underlying units. It is never itself a price.
    function test_wrapperRateConvertsSharesAndTheMarkPrices() public {
        _aliceDeposits(100e18);
        vm.prank(alice);
        credit.borrow(ASSET, 4_950e6, 0);
        assertEq(credit.positionLTV(alice, ASSET), 0.55e18);

        // The wrapper accrues: each share is now worth 1.1 underlying. Value rises, LTV falls.
        wrapper.setAssetsPerUnit(1.1e18);
        assertApproxEqAbs(credit.positionLTV(alice, ASSET), 0.5e18, 1e12);
    }

    function test_interestAccrualIsIndependentOfCallFrequency() public {
        _aliceDeposits(1_000e18);
        vm.prank(alice);
        credit.borrow(ASSET, 10_000e6, 0);

        uint256 snap = vm.snapshotState();
        _warp(30 days);
        credit.accrue();
        uint256 once = credit.debtOf(alice, ASSET);

        vm.revertToState(snap);
        for (uint256 i = 0; i < 30; i++) {
            _warp(1 days);
            credit.accrue();
        }
        uint256 often = credit.debtOf(alice, ASSET);
        // Compounding more often never yields less than compounding once, and the gap is small.
        assertGe(often, once);
        assertApproxEqRel(often, once, 0.01e18);
    }

    function test_accrualSendsTheReserveFactorToReserves() public {
        _aliceDeposits(1_000e18);
        vm.prank(alice);
        credit.borrow(ASSET, 10_000e6, 0);
        _warp(365 days);
        credit.accrue();
        assertGt(credit.reserves(), 0);
    }

    // ================================================================ access and reentrancy

    function test_onlyAdminMayListCollateral() public {
        vm.prank(bob);
        vm.expectRevert(KerbCredit.NotAdmin.selector);
        credit.listCollateral(keccak256("other"), _config());
    }

    function test_collateralCannotBeRelisted() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(KerbCredit.AlreadyListed.selector, ASSET));
        credit.listCollateral(ASSET, _config());
    }

    function test_onlyGuardianOrAdminMayPause() public {
        vm.prank(bob);
        vm.expectRevert(KerbCredit.NotGuardian.selector);
        credit.setPaused(true, false);
    }

    function test_unknownCollateralReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(KerbCredit.UnknownCollateral.selector, keccak256("nope")));
        credit.deposit(keccak256("nope"), 1e18);
    }

    function test_reentrancyOnCollateralTransferIsBlocked() public {
        ReentrantToken evil = new ReentrantToken();
        bytes32 id = keccak256("EVIL");
        KerbCredit.CollateralConfig memory c = _config();
        c.token = IERC20(address(evil));
        c.wrapper = IWrapper(address(evil));
        vm.prank(admin);
        credit.listCollateral(id, c);
        _post2(id);

        evil.mint(alice, 1_000e18);
        vm.prank(alice);
        evil.approve(address(credit), type(uint256).max);

        // Re-enter deposit from inside the collateral transfer.
        evil.arm(address(credit), abi.encodeCall(credit.deposit, (id, 1e18)));
        vm.prank(alice);
        vm.expectRevert();
        credit.deposit(id, 10e18);
    }

    function _post2(bytes32 id) internal {
        terms.set(
            id,
            IKerbTerms.Terms({
                observedAt: uint64(block.timestamp),
                regime: 1,
                creditMark: 1e18,
                carryLTV: 0.5e18,
                sessionMaxLTV: 0.55e18,
                debtCeiling: 100_000e6,
                maxPositionDebt: 25_000e6,
                executableDepth1: 100_000e6,
                inputsHash: keccak256("i"),
                engineVersion: keccak256("v")
            })
        );
    }

    // ================================================================ rounding

    function testFuzz_repayNeverClearsMoreDebtThanItPays(uint96 amount) public {
        vm.assume(amount > 1e6 && amount < 4_000e6);
        _aliceDeposits(100e18);
        vm.prank(alice);
        credit.borrow(ASSET, 4_000e6, 0);
        uint256 before = credit.debtOf(alice, ASSET);
        vm.prank(alice);
        uint256 repaid = credit.repay(ASSET, amount);
        uint256 cleared = before - credit.debtOf(alice, ASSET);
        assertLe(cleared, repaid + 1);
    }

    function testFuzz_borrowingNeverLeavesTheModeCeilingBreached(uint96 amount) public {
        vm.assume(amount > 1e6 && amount < 20_000e6);
        _aliceDeposits(100e18);
        vm.prank(alice);
        try credit.borrow(ASSET, amount, 1) {
            assertLe(credit.positionLTV(alice, ASSET), 0.60e18);
        } catch {
            // Refusing to lend is always an acceptable outcome.
        }
    }
}
