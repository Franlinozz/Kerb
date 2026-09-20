// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {KerbCreditInvariantsTest} from "./KerbCreditInvariants.t.sol";

/**
 * Coverage for the invariant handler.
 *
 * An invariant suite whose handler cannot reach the interesting states proves nothing: every
 * property about cures would be vacuously true because no cure ever ran. These tests drive the
 * same handler deterministically through each path and assert the counters move, so the fuzzing
 * above is known to be exercising a live market rather than a dead one.
 */
contract HandlerProbeTest is KerbCreditInvariantsTest {
    function test_handlerCanSupplyDepositAndBorrow() public {
        // actors[0] is the supplier and holds no collateral yet; the others are already drawn
        // to Session Max in setUp and have no room left under the Carry ceiling.
        // actors[0] is the supplier and holds no collateral yet; the others are already drawn to
        // Session Max in setUp and have no room left under the Carry ceiling.
        uint256 borrowedBefore = handler.totalBorrowed();
        handler.supply(0, 100_000e6);
        handler.deposit(0, 1_000e18);
        handler.borrow(0, 10_000e6, 0);
        assertGt(handler.totalBorrowed(), borrowedBefore, "the handler cannot borrow");
    }

    function test_handlerCanReachAndRunACure() public {
        // The seeded positions are already above their Carry target; open Last Call and cure one.
        handler.openLastCall();
        (bool eligible,, uint256 required) = credit.cureStatus(actors[1], ASSET);
        assertTrue(eligible, "no seeded position is curable");
        assertGt(required, 0);

        handler.cure(0, 1, uint96(required));
        assertGt(handler.cures(), 0, "the handler cannot cure");
    }

    function test_handlerCanReachAndRunALiquidation() public {
        // Drop the mark until the seeded position falls below the fixed threshold.
        handler.stressTheMarkDown(50);
        handler.stressTheMarkDown(50);
        assertLt(credit.healthFactor(actors[1], ASSET), 1e18, "the mark stress did not make anything unhealthy");

        handler.liquidate(0, 1, type(uint96).max);
        assertGt(handler.liquidations(), 0, "the handler cannot liquidate");
    }

    function test_handlerTracksTheDebtIndex() public {
        handler.passTime(30 days);
        assertGt(handler.indexChecks(), 0, "the debt index is never observed");
        assertGe(handler.lastDebtIndex(), 1e18);
    }
}
