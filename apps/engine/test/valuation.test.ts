import { describe, expect, it } from "vitest";
import { creditCollateralValue as collateralValue, maxBorrow, positionLtv, WAD } from "../src/valuation.js";

/**
 * Parity with KerbCredit on X Layer testnet 1952 (0xa1314645...98a8), read at block 41705127 on
 * 23 Sep 2026: the demo keeper's kHKEXCx position. positionLTV() returned 493017491991173042.
 */
const FIXTURE = {
  collateralShares: 82324023902722085723n,
  debt: 2000000001n,
  carry: 490463773301349401n,
  sessionMax: 495054635093633240n,
  mark: 49276638929084169811n,
  contractPositionLtv: 493017491991173042n,
};

describe("valuation parity with KerbCredit", () => {
  it("reproduces positionLTV to the wei", () => {
    const value = collateralValue(FIXTURE.collateralShares, FIXTURE.mark, 18, 6);
    expect(positionLtv(FIXTURE.debt, value)).toBe(FIXTURE.contractPositionLtv);
  });
  it("the position sits between Carry and Session Max, which is what makes it curable", () => {
    const value = collateralValue(FIXTURE.collateralShares, FIXTURE.mark, 18, 6);
    expect(FIXTURE.debt > maxBorrow(value, FIXTURE.carry)).toBe(true);
    expect(FIXTURE.debt <= maxBorrow(value, FIXTURE.sessionMax)).toBe(true);
  });
  it("rounds against the user", () => {
    expect(collateralValue(1n, WAD - 1n, 18, 6)).toBe(0n);
    expect(maxBorrow(999n, WAD / 2n)).toBe(499n);
    expect(positionLtv(1n, 3n)).toBe((WAD + 2n) / 3n);
    expect(collateralValue(10n ** 18n, 50n * WAD, 18, 6)).toBe(50_000_000n);
  });
});
