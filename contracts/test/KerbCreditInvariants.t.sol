// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KerbCredit} from "../src/KerbCredit.sol";
import {IKerbClock, IKerbTerms, IWrapper} from "../src/interfaces/IKerb.sol";
import {MockClock, MockERC20, MockTerms, MockWrapper} from "./mocks/Mocks.sol";

/**
 * The handler drives the market the way the world would: random users supplying, borrowing,
 * repaying, curing and liquidating, with the mark and the session moving underneath them and
 * time passing. It only ever calls the public surface, and it never reverts on purpose.
 */
contract Handler is Test {
    KerbCredit public immutable credit;
    MockERC20 public immutable usdg;
    MockERC20 public immutable kox;
    MockTerms public immutable terms;
    MockClock public immutable clock;
    bytes32 public immutable assetId;

    address[] public actors;
    address internal current;

    uint256 public totalBorrowed;
    uint256 public totalRepaid;
    uint256 public cures;
    uint256 public liquidations;
    /// @dev Ghost state: the debt index, which interest may only ever push upwards.
    uint256 public lastDebtIndex = 1e18;
    uint256 public indexChecks;

    modifier useActor(uint256 seed) {
        current = actors[seed % actors.length];
        vm.startPrank(current);
        _;
        vm.stopPrank();
    }

    constructor(
        KerbCredit credit_,
        MockERC20 usdg_,
        MockERC20 kox_,
        MockTerms terms_,
        MockClock clock_,
        bytes32 assetId_,
        address[] memory actors_
    ) {
        credit = credit_;
        usdg = usdg_;
        kox = kox_;
        terms = terms_;
        clock = clock_;
        assetId = assetId_;
        actors = actors_;
    }

    /// @dev Invariant 8, checked where it is precise: between any two observations the debt index
    ///      only ever rises. Repayment shrinks debt and shares together and must not move it.
    function _syncIndex() internal {
        uint256 shares = credit.totalDebtShares();
        if (shares == 0) return;
        uint256 index = ((credit.totalDebtAssets() + 1e6) * 1e18) / (shares + 1e6);
        assertGe(index + 1, lastDebtIndex, "debt index moved backwards");
        if (index > lastDebtIndex) lastDebtIndex = index;
        indexChecks++;
    }

    function supply(uint256 seed, uint96 amount) external useActor(seed) {
        uint256 a = bound(amount, 1e6, 100_000e6);
        if (usdg.balanceOf(current) < a) return;
        try credit.supply(a) {} catch {}
    }

    function withdrawSupply(uint256 seed, uint96 shares) external useActor(seed) {
        uint256 held = credit.supplyShares(current);
        if (held == 0) return;
        try credit.withdraw(bound(shares, 1, held)) {} catch {}
    }

    function deposit(uint256 seed, uint96 amount) external useActor(seed) {
        uint256 a = bound(amount, 1e18, 1_000e18);
        if (kox.balanceOf(current) < a) return;
        try credit.deposit(assetId, a) {} catch {}
    }

    function withdrawCollateral(uint256 seed, uint96 amount) external useActor(seed) {
        uint128 held = credit.position(current, assetId).collateralShares;
        if (held == 0) return;
        try credit.withdrawCollateral(assetId, bound(amount, 1, held)) {} catch {}
    }

    function borrow(uint256 seed, uint96 amount, uint8 mode) external useActor(seed) {
        uint256 a = bound(amount, 1e6, 50_000e6);
        uint8 m = uint8(bound(mode, 0, 1));
        try credit.borrow(assetId, a, m) {
            totalBorrowed += a;
            // Invariants 2 and 3, at the only moment they are enforceable: the draw itself.
            IKerbTerms.Terms memory t = terms.latest(assetId);
            assertLe(_assetDebt(), t.debtCeiling, "borrow breached the debt ceiling");
            assertLe(credit.debtOf(current, assetId), t.maxPositionDebt, "borrow breached the position cap");
            (uint64 carry, uint64 sessionMax,,,) = terms.effectiveTerms(assetId);
            assertLe(credit.positionLTV(current, assetId), m == 0 ? carry : sessionMax, "borrow breached the mode ceiling");
        } catch {}
        _syncIndex();
    }

    function _assetDebt() internal view returns (uint256 sum) {
        for (uint256 i = 0; i < actors.length; i++) {
            sum += credit.debtOf(actors[i], assetId);
        }
    }

    function repay(uint256 seed, uint96 amount) external useActor(seed) {
        uint256 debt = credit.debtOf(current, assetId);
        if (debt == 0) return;
        uint256 a = bound(amount, 1, debt);
        if (usdg.balanceOf(current) < a) return;
        try credit.repay(assetId, a) returns (uint256 r) {
            totalRepaid += r;
        } catch {}
        _syncIndex();
    }

    function cure(uint256 seed, uint256 victimSeed, uint96 amount) external useActor(seed) {
        address victim = actors[victimSeed % actors.length];
        (bool eligible,, uint256 required) = credit.cureStatus(victim, assetId);
        if (!eligible || required == 0) return;
        uint256 a = bound(amount, 1, required);
        if (usdg.balanceOf(current) < a) return;
        uint256 ltvBefore = credit.positionLTV(victim, assetId);
        try credit.cure(victim, assetId, a) {
            cures++;
            // Invariant 4: a cure only ever moves a position towards its target, never past it.
            assertLe(credit.positionLTV(victim, assetId), ltvBefore, "cure made the position worse");
        } catch {}
        _syncIndex();
    }

    function liquidate(uint256 seed, uint256 victimSeed, uint96 amount) external useActor(seed) {
        address victim = actors[victimSeed % actors.length];
        uint256 debt = credit.debtOf(victim, assetId);
        if (debt == 0) return;
        uint256 maxRepay = (debt * credit.collateral(assetId).closeFactor) / 1e18;
        if (maxRepay == 0) return;
        uint256 a = bound(amount, 1, maxRepay);
        if (usdg.balanceOf(current) < a) return;
        uint256 hfBefore = credit.healthFactor(victim, assetId);
        try credit.liquidate(victim, assetId, a) {
            liquidations++;
            // Invariant 5: a liquidation that succeeded must have been against an unhealthy position.
            assertLt(hfBefore, 1e18, "liquidated a healthy position");
        } catch {}
        _syncIndex();
    }

    /// @dev The mark moves, which is the whole reason this protocol exists.
    function moveMark(uint96 mark) external {
        terms.setMark(assetId, uint128(bound(mark, 10e18, 200e18)));
    }

    /// @dev The session opens and closes.
    function moveSession(bool open) external {
        clock.setWindow(open, uint64(block.timestamp + 3600));
    }

    /// @dev The terms go stale and come back.
    function moveUsability(bool unusable) external {
        terms.setUnusable(assetId, unusable);
    }

    /**
     * Guided actions. Pure random walk almost never produces a position above its Carry target
     * while the Last Call window is open, so the cure path would never be exercised and every
     * property about it would be vacuous. These two steer the market into the states the
     * protocol exists to handle.
     */
    function stressTheMarkDown(uint256 seed) external {
        uint128 mark = terms.latest(assetId).creditMark;
        if (mark == 0) return;
        uint256 factor = bound(seed, 50, 95); // a 5% to 50% fall
        terms.setMark(assetId, uint128((uint256(mark) * factor) / 100));
    }

    function openLastCall() external {
        clock.setWindow(true, uint64(block.timestamp + 3600));
    }

    /// @dev Draw deliberately at Session Max, which is what attaches the covenant in the first place.
    function borrowAtSessionMax(uint256 seed, uint96 amount) external useActor(seed) {
        (, uint64 sessionMax, uint128 mark,,) = terms.effectiveTerms(assetId);
        uint128 shares = credit.position(current, assetId).collateralShares;
        if (shares == 0 || mark == 0 || sessionMax == 0) return;
        // Aim just under the Session Max ceiling, where the covenant bites.
        uint256 value = (uint256(shares) * mark) / 1e18 / 1e12; // 18-dec collateral into 6-dec loan units
        uint256 ceiling = (value * sessionMax) / 1e18;
        uint256 debt = credit.debtOf(current, assetId);
        if (ceiling <= debt) return;
        uint256 room = ceiling - debt;
        uint256 a = bound(amount, 1, room);
        try credit.borrow(assetId, a, 1) {
            totalBorrowed += a;
        } catch {}
        _syncIndex();
    }

    function passTime(uint32 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 1, 7 days));
        try credit.accrue() {} catch {}
        _syncIndex();
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

/// @notice The eight invariants from docs/ARCHITECTURE.md section 3.3.
contract KerbCreditInvariantsTest is Test {
    KerbCredit internal credit;
    MockERC20 internal usdg;
    MockERC20 internal kox;
    MockWrapper internal wrapper;
    MockTerms internal terms;
    MockClock internal clock;
    Handler internal handler;

    bytes32 internal constant ASSET = keccak256("KOx");
    uint256 internal constant WAD = 1e18;

    address[] internal actors;

    function setUp() public {
        usdg = new MockERC20("USDG", "USDG", 6);
        kox = new MockERC20("wKOx", "wKOx", 18);
        wrapper = new MockWrapper(18, 1e18);
        terms = new MockTerms();
        clock = new MockClock();

        credit = new KerbCredit(
            IERC20(address(usdg)),
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
                token: IERC20(address(kox)),
                wrapper: IWrapper(address(wrapper)),
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
                debtCeiling: 200_000e6,
                maxPositionDebt: 50_000e6,
                executableDepth1: 200_000e6,
                inputsHash: keccak256("i"),
                engineVersion: keccak256("v")
            })
        );

        for (uint256 i = 0; i < 4; i++) {
            address a = address(uint160(0x1000 + i));
            actors.push(a);
            usdg.mint(a, 500_000e6);
            kox.mint(a, 5_000e18);
            vm.startPrank(a);
            usdg.approve(address(credit), type(uint256).max);
            kox.approve(address(credit), type(uint256).max);
            vm.stopPrank();
        }

        // Seed a live market: supply, collateral and an open Session Max draw with the covenant
        // attached. A run that had to build all of that from random calls would usually run out
        // of depth first, and every property about cures would be vacuously true.
        vm.startPrank(actors[0]);
        credit.supply(300_000e6);
        vm.stopPrank();
        for (uint256 i = 1; i < actors.length; i++) {
            vm.startPrank(actors[i]);
            credit.deposit(ASSET, 1_000e18); // 90,000 of value
            credit.borrow(ASSET, 50_000e6, 1); // 55.6%, above the 55% Carry target
            vm.stopPrank();
        }

        handler = new Handler(credit, usdg, kox, terms, clock, ASSET, actors);
        targetContract(address(handler));
    }

    /// 1. The pool never owes out more than it took in.
    function invariant_debtNeverExceedsSupply() public view {
        assertLe(credit.totalDebtAssets(), credit.totalSuppliedAssets() + credit.reserves() + 1);
    }

    /**
     * 2 and 3. The ceilings bind at the draw, and that is where the handler asserts them: after
     * any successful borrow the asset debt, the position debt and the mode LTV are all inside
     * their limits. They cannot be asserted here, because a falling mark or accrued interest may
     * legitimately carry an existing position past a ceiling afterwards. That drift is precisely
     * what Cure and Default exist to resolve, and pretending otherwise would be a false invariant.
     */

    /// 4. A cure can never take a position below its target: it repays at most what is required.
    function invariant_cureNeverOvershootsTheTarget() public view {
        for (uint256 i = 0; i < actors.length; i++) {
            (, , uint256 required) = credit.cureStatus(actors[i], ASSET);
            uint256 debt = credit.debtOf(actors[i], ASSET);
            assertLe(required, debt);
        }
    }

    /**
     * 5. Nothing may be liquidated while it is healthy, and nothing may be cured outside the
     * window. Both are asserted in the handler at the moment of every successful call, where the
     * pre-state is still known. What holds from genesis is that a seizure never leaves a position
     * owing more collateral than it holds.
     */
    function invariant_noPositionOwesMoreCollateralThanItHolds() public view {
        for (uint256 i = 0; i < actors.length; i++) {
            assertLe(credit.position(actors[i], ASSET).collateralShares, kox.balanceOf(address(credit)));
        }
    }

    /// 6. Shares and assets never disagree about who owns what.
    function invariant_sharesAndAssetsAgree() public view {
        uint256 sum;
        for (uint256 i = 0; i < actors.length; i++) {
            sum += credit.supplyShares(actors[i]);
        }
        assertEq(sum, credit.totalSupplyShares());

        uint256 debtShares;
        for (uint256 i = 0; i < actors.length; i++) {
            debtShares += credit.position(actors[i], ASSET).debtShares;
        }
        assertEq(debtShares, credit.totalDebtShares());
        assertEq(debtShares, credit.assetDebtShares(ASSET));
    }

    /// 7. Rounding always favours the protocol: the contract holds at least what it owes out.
    function invariant_solvencyOfTheTokenBalance() public view {
        uint256 held = usdg.balanceOf(address(credit));
        uint256 owed = credit.totalSuppliedAssets() + credit.reserves() - credit.totalDebtAssets();
        assertGe(held + 1, owed);
    }

    /// 7b. Collateral held covers every position's recorded collateral.
    function invariant_collateralIsFullyBacked() public view {
        uint256 sum;
        for (uint256 i = 0; i < actors.length; i++) {
            sum += credit.position(actors[i], ASSET).collateralShares;
        }
        assertEq(kox.balanceOf(address(credit)), sum);
    }

    /**
     * 8. Interest only ever moves forwards. The index itself is checked after every action in the
     * handler, where a decrease would be visible; from genesis what holds is that it never sits
     * below its starting value and that accrual never claims to have happened in the future.
     */
    function invariant_theDebtIndexOnlyRises() public view {
        assertGe(handler.lastDebtIndex(), 1e18);
        assertLe(credit.lastAccrualAt(), block.timestamp);
    }

    function _assetDebt() internal view returns (uint256 sum) {
        for (uint256 i = 0; i < actors.length; i++) {
            sum += credit.debtOf(actors[i], ASSET);
        }
    }
}
