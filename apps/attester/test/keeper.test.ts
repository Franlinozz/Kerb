import { describe, expect, it } from "vitest";
import { assertKeeperChain, demoState, MAX_DEBT, plan, sizeOpen, type KeeperView } from "../src/keeper.js";

const WAD = 10n ** 18n;
const terms = { usable: true, carry: (48n * WAD) / 100n, sessionMax: (55n * WAD) / 100n, mark: 50n * WAD, maxPositionDebt: 3_478_550_000n };
const view = (o: Partial<KeeperView> = {}): KeeperView => ({ state: "SESSION", toCureStart: 1200n, pendingNonce: 7, latestNonce: 7, debt: 0n, collateralShares: 0n, terms, ...o });

describe("demo keeper (V3-02)", () => {
  it("refuses any chain but 1952", () => {
    expect(() => assertKeeperChain(196)).toThrow(/1952/);
    expect(() => assertKeeperChain(1)).toThrow();
    expect(() => assertKeeperChain(1952)).not.toThrow();
  });
  it("opens one position in the session, sized under the debt cap", () => {
    const p = plan(view());
    expect(p.kind).toBe("open");
    if (p.kind === "open") { expect(p.debt).toBe(MAX_DEBT); expect(p.deposit).toBe(true); }
    // A small market cap binds instead: 90% of it.
    const s = sizeOpen({ ...terms, maxPositionDebt: 1_000_000_000n });
    expect(s?.debt).toBe(900_000_000n);
  });
  it("sizes the LTV between Carry and Session Max, so the position needs a cure at Last Call", () => {
    const s = sizeOpen(terms)!;
    expect(s.targetLtv > terms.carry && s.targetLtv < terms.sessionMax).toBe(true);
    const ltv = (s.debt * 10n ** 12n * WAD) / ((s.collateral * terms.mark) / WAD);
    expect(ltv > terms.carry && ltv <= s.targetLtv).toBe(true);
  });
  it("after a restart, reads the chain: an open position is never opened again", () => {
    expect(plan(view({ debt: 2_000_000_000n, collateralShares: 5n })).kind).toBe("wait");
  });
  it("after a restart between deposit and borrow, borrows without depositing again", () => {
    const p = plan(view({ collateralShares: 123n }));
    expect(p).toMatchObject({ kind: "open", deposit: false });
  });
  it("never sends while a transaction is pending", () => {
    expect(plan(view({ pendingNonce: 8, latestNonce: 7 }))).toMatchObject({ kind: "wait" });
    expect(plan(view({ state: "CLOSED", debt: 5n, pendingNonce: 8, latestNonce: 7 }))).toMatchObject({ kind: "wait" });
  });
  it("does nothing in Last Call and never opens in the last five minutes", () => {
    expect(plan(view({ state: "LAST_CALL", debt: 5n })).kind).toBe("wait");
    expect(plan(view({ toCureStart: 299n })).kind).toBe("wait");
    expect(plan(view({ terms: { ...terms, usable: false } })).kind).toBe("wait");
  });
  it("closed: repays what a partial cure left, then withdraws", () => {
    expect(plan(view({ state: "CLOSED", debt: 1_700_000_000n, collateralShares: 9n }))).toEqual({ kind: "close", repay: true, withdraw: true });
  });
  it("closed: already repaid, withdraws only; nothing open, waits", () => {
    expect(plan(view({ state: "CLOSED", debt: 0n, collateralShares: 9n }))).toEqual({ kind: "close", repay: false, withdraw: true });
    expect(plan(view({ state: "CLOSED" })).kind).toBe("wait");
  });
  it("demo phases", () => {
    expect(demoState(1000n, 0n, 3600n, 3000n, 3300n)).toMatchObject({ state: "SESSION", toCureStart: 2000n });
    expect(demoState(3100n, 0n, 3600n, 3000n, 3300n).state).toBe("LAST_CALL");
    expect(demoState(3500n, 0n, 3600n, 3000n, 3300n).state).toBe("CLOSED");
  });
});
