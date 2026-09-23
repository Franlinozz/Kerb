/**
 * The demo keeper's decisions (V3-02), pure so every rule is tested without a chain. The script
 * (scripts/demo-keeper.ts) reads chain state, asks plan() what to do, and does exactly that.
 * Nothing here reads local state: after a restart the chain alone decides, so a restart can
 * never open a second position or repeat a send.
 */
export const KEEPER_CHAIN_ID = 1952;
export const MAX_DEBT = 2_000_000_000n; // 2,000 mUSDG, 6 decimals
export const OPEN_MARGIN_SEC = 300n; // never open in the last five minutes before Last Call
const WAD = 10n ** 18n;

export type DemoState = "SESSION" | "LAST_CALL" | "CLOSED";

/** First check the keeper makes, before it signs anything: testnet 1952 or nothing. */
export function assertKeeperChain(chainId: number): void {
  if (chainId !== KEEPER_CHAIN_ID) throw new Error(`the keeper runs on X Layer testnet (1952) only, not chain ${chainId}`);
}

export function demoState(nowSec: bigint, epoch: bigint, weekLength: bigint, cureStart: bigint, sessionEnd: bigint): { state: DemoState; phase: bigint; toCureStart: bigint } {
  const phase = (((nowSec - epoch) % weekLength) + weekLength) % weekLength;
  const state: DemoState = phase < cureStart ? "SESSION" : phase < sessionEnd ? "LAST_CALL" : "CLOSED";
  return { state, phase, toCureStart: cureStart - phase };
}

export interface KeeperView {
  state: DemoState;
  toCureStart: bigint;
  /** Nonces as the chain reports them: pending above latest means a transaction is in flight. */
  pendingNonce: number;
  latestNonce: number;
  debt: bigint; // loan units, 6 decimals
  collateralShares: bigint;
  terms: { usable: boolean; carry: bigint; sessionMax: bigint; mark: bigint; maxPositionDebt: bigint };
}

export type Plan =
  | { kind: "wait"; reason: string }
  | { kind: "close"; repay: boolean; withdraw: boolean }
  | { kind: "open"; debt: bigint; collateral: bigint; deposit: boolean };

/** Debt sized under both caps, and collateral so the position's LTV sits three quarters of the way from Carry to Session Max. */
export function sizeOpen(t: KeeperView["terms"]): { debt: bigint; collateral: bigint; targetLtv: bigint } | null {
  const debt = [MAX_DEBT, (t.maxPositionDebt * 9n) / 10n].reduce((a, b) => (a < b ? a : b));
  const targetLtv = t.carry + ((t.sessionMax - t.carry) * 3n) / 4n;
  if (debt <= 0n || targetLtv <= t.carry || t.mark <= 0n) return null;
  const value = (debt * 10n ** 12n * WAD) / targetLtv; // loan units scaled to WAD
  return { debt, collateral: (value * WAD) / t.mark + WAD / 100n, targetLtv };
}

export function plan(v: KeeperView): Plan {
  if (v.pendingNonce > v.latestNonce) return { kind: "wait", reason: `a transaction is still pending (nonce ${v.latestNonce} to ${v.pendingNonce})` };
  if (v.state === "CLOSED") {
    if (v.debt === 0n && v.collateralShares === 0n) return { kind: "wait", reason: "closed, nothing open" };
    // Covers "already cured" (debt reduced to Carry) and "already repaid" (collateral only).
    return { kind: "close", repay: v.debt > 0n, withdraw: true };
  }
  if (v.state === "LAST_CALL") return { kind: "wait", reason: v.debt > 0n ? "Last Call: the position waits to be cured by anyone" : "Last Call, no position" };
  if (v.debt > 0n) return { kind: "wait", reason: "session, position already open" };
  if (v.toCureStart < OPEN_MARGIN_SEC) return { kind: "wait", reason: "too close to Last Call to open" };
  if (!v.terms.usable) return { kind: "wait", reason: "terms not usable, not opening" };
  const s = sizeOpen(v.terms);
  if (!s) return { kind: "wait", reason: "Session Max is not above Carry right now, not opening" };
  // Collateral already in (a restart between deposit and borrow): borrow against it, never deposit twice.
  return { kind: "open", debt: s.debt, collateral: s.collateral, deposit: v.collateralShares === 0n };
}
