/**
 * The demo position keeper (V2-08 B, V3-02; AGENTS.md gates 6 and 9: runs only with the
 * operator's written approval, from its own testnet-only wallet funded from faucets).
 *
 * So that every demo Last Call has at least one curable position for a visitor to cure, the keeper
 * holds one Session Max position sized between Carry and Session Max, on kHKEXCx, or on kKOx when
 * HKEXCx has no room between the two (as after its Stale period on 24 Sep); an open position is
 * always finished on the asset it was opened on:
 *   SESSION   (until five minutes before Last Call): open it if there is none.
 *   LAST_CALL: do nothing; the position is there to be cured by anyone.
 *   CLOSED:    repay whatever a cure left and withdraw, so the next cycle starts clean.
 * Every decision comes from src/keeper.ts plan(), from chain state only, so a restart never opens a
 * second position; a pending nonce blocks every send, so a slow receipt is never sent twice.
 * Hard caps: chain 1952 only, debt never above 2,000 mUSDG, never more than one position.
 * Every action and its transaction hash is appended to data/keeper.log; data/keeper-status.json
 * holds the line the API serves at /v1/credit/1952/keeper.
 */
import { appendFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatUnits, parseUnits, type Address, type Hex } from "viem";
import { repoRoot, type KerbChainId } from "@kerb/adapters";
import { artifact, deploymentOf, walletFor } from "../src/chain.js";
import { dataSuffix } from "../src/builder-code.js";
import { assertKeeperChain, demoState, KEEPER_CHAIN_ID, MAX_DEBT, plan, type DemoState } from "../src/keeper.js";

const CHAIN = KEEPER_CHAIN_ID as KerbChainId;
const LOG = resolve(repoRoot(), "data/keeper.log");
const STATUS = resolve(repoRoot(), "data/keeper-status.json");

const wallet = walletFor(CHAIN, "KERB_KEEPER_KEY");
assertKeeperChain(await wallet.getChainId());
const me = wallet.account.address;
const credit = deploymentOf(CHAIN, "KerbCredit").address as Address;
const demo = deploymentOf(CHAIN, "KerbClockDemo").address as Address;
const loan = deploymentOf(CHAIN, "MockUSDG").address as Address;
const creditAbi = artifact("KerbCredit").abi, termsAbi = artifact("KerbTerms").abi, erc = artifact("MockUSDG").abi, mirrorAbi = artifact("KerbMirror").abi, demoAbi = artifact("KerbClockDemo").abi;
const terms = deploymentOf(CHAIN, "KerbTerms").address as Address;
const suffix = dataSuffix();
const { assetId: idOf } = await import("@kerb/types");
/** The collateral the keeper may use, in order of preference. */
const MARKETS = (["HKEXCx", "KOx"] as const).map((sym) => {
  const mirror = deploymentOf(CHAIN, `KerbMirror:${sym}`).address as Address;
  return { sym, label: `k${sym}`, mirror, assetId: idOf(CHAIN, mirror) as Hex };
});
let current = MARKETS[0]!;

let last: { action: string; at: string; tx: string | null } | null = null;
const log = (what: string, tx?: Hex): void => {
  const line = `${new Date().toISOString()} ${what}${tx ? ` ${tx}` : ""}`;
  console.log(line);
  appendFileSync(LOG, `${line}\n`);
  if (tx || what.startsWith("error")) last = { action: what, at: new Date().toISOString(), tx: tx ?? null };
};
function status(s: { state: DemoState; position: "open" | "none" | "collateral only"; debt: string; next: string; nextAt: string; note: string }): void {
  const tmp = `${STATUS}.tmp`;
  writeFileSync(tmp, JSON.stringify({ address: me, chainId: CHAIN, collateral: current.label, updatedAt: new Date().toISOString(), ...s, lastAction: last }, null, 1));
  renameSync(tmp, STATUS);
}

const sleep = (ms: number): Promise<void> => new Promise((x) => setTimeout(x, ms));
/** Reads retry up to three times on a 403, a timeout or a dropped connection. Sends never retry here. */
async function retry<T>(f: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await f(); } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (i >= 2 || !/403|429|timeout|timed out|ECONN|fetch failed|socket|502|503/i.test(m)) throw e;
      await sleep(2000 * (i + 1));
    }
  }
}
const read = <T>(address: Address, abi: readonly unknown[], functionName: string, args: unknown[] = []): Promise<T> =>
  retry(() => wallet.readContract({ address, abi, functionName, args } as never) as Promise<T>);

async function send(address: Address, abi: readonly unknown[], functionName: string, args: unknown[], what: string): Promise<void> {
  const [pending, latest] = await Promise.all([
    retry(() => wallet.getTransactionCount({ address: me, blockTag: "pending" })),
    retry(() => wallet.getTransactionCount({ address: me, blockTag: "latest" })),
  ]);
  if (pending > latest) throw new Error(`not sending ${what}: nonce ${latest} to ${pending} still pending`);
  const hash = await wallet.writeContract({ address, abi, functionName, args, chain: wallet.chain, account: wallet.account, ...(suffix ? { dataSuffix: suffix } : {}) } as never);
  log(`sent ${what}`, hash);
  const r = await wallet.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (r.status !== "success") throw new Error(`${what} reverted ${hash}`);
  log(what, hash);
  // The public RPC is load balanced: wait until reads see this block.
  while ((await retry(() => wallet.getBlockNumber())) < r.blockNumber) await sleep(1000);
}

async function tick(): Promise<void> {
  const [weekLength, sessionEnd, cureStart, epoch] = await Promise.all(["weekLength", "sessionEnd", "cureStart", "epoch"].map((f) => read<bigint>(demo, demoAbi, f)));
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const d = demoState(nowSec, epoch!, weekLength!, cureStart!, sessionEnd!);
  const cycleStart = nowSec - d.phase;
  const at = (sec: bigint): string => new Date(Number(sec) * 1000).toISOString();
  // Finish any open position on its own asset; otherwise take the first asset with room between
  // Carry and Session Max.
  const views = await Promise.all(MARKETS.map(async (m) => {
    const [pos, eff] = await Promise.all([
      read<{ collateralShares: bigint; debtShares: bigint }>(credit, creditAbi, "position", [me, m.assetId]),
      read<[bigint, bigint, bigint, number, boolean]>(terms, termsAbi, "effectiveTerms", [m.assetId]),
    ]);
    return { m, open: pos.collateralShares > 0n || pos.debtShares > 0n, room: eff[4] && eff[1] > eff[0] };
  }));
  current = (views.find((v) => v.open) ?? views.find((v) => v.room) ?? views[0]!).m;
  const { mirror, assetId, label } = current;
  const [pos, debt, pendingNonce, latestNonce, eff, latest] = await Promise.all([
    read<{ collateralShares: bigint; debtShares: bigint }>(credit, creditAbi, "position", [me, assetId]),
    read<bigint>(credit, creditAbi, "debtOf", [me, assetId]),
    retry(() => wallet.getTransactionCount({ address: me, blockTag: "pending" })),
    retry(() => wallet.getTransactionCount({ address: me, blockTag: "latest" })),
    read<[bigint, bigint, bigint, number, boolean]>(terms, termsAbi, "effectiveTerms", [assetId]),
    read<{ maxPositionDebt: bigint }>(terms, termsAbi, "latest", [assetId]),
  ]);
  const [carry, sessionMax, mark, , usable] = eff;
  const p = plan({ state: d.state, toCureStart: d.toCureStart, pendingNonce, latestNonce, debt, collateralShares: pos.collateralShares, terms: { usable, carry, sessionMax, mark, maxPositionDebt: latest.maxPositionDebt } });

  if (p.kind === "close") {
    if (p.repay) {
      if ((await read<bigint>(loan, erc, "balanceOf", [me])) < debt + parseUnits("1", 6)) await send(loan, erc, "faucet", [parseUnits("5000", 6)], "mint mUSDG to repay");
      if ((await read<bigint>(loan, erc, "allowance", [me, credit])) < debt * 2n) await send(loan, erc, "approve", [credit, (1n << 255n) - 1n], "approve mUSDG");
      await send(credit, creditAbi, "repay", [assetId, (1n << 255n) - 1n], `repay ${formatUnits(debt, 6)} mUSDG`);
    }
    const held = (await read<{ collateralShares: bigint }>(credit, creditAbi, "position", [me, assetId])).collateralShares;
    if (held > 0n) await send(credit, creditAbi, "withdrawCollateral", [assetId, held], "withdraw collateral");
  } else if (p.kind === "open") {
    if (p.debt > MAX_DEBT) throw new Error("refusing: debt above the 2,000 mUSDG cap");
    if (p.deposit) {
      if ((await read<bigint>(mirror, mirrorAbi, "balanceOf", [me])) < p.collateral) await send(mirror, mirrorAbi, "faucet", [p.collateral], `mint ${formatUnits(p.collateral, 18)} ${label}`);
      if ((await read<bigint>(mirror, mirrorAbi, "allowance", [me, credit])) < p.collateral) await send(mirror, mirrorAbi, "approve", [credit, (1n << 255n) - 1n], `approve ${label}`);
      await send(credit, creditAbi, "deposit", [assetId, p.collateral], `deposit ${formatUnits(p.collateral, 18)} ${label}`);
    }
    await send(credit, creditAbi, "borrow", [assetId, p.debt, 1], `borrow ${formatUnits(p.debt, 6)} mUSDG with Session Max on ${label}`);
  } else if (p.reason.startsWith("a transaction") || p.reason.startsWith("terms") || p.reason.startsWith("Session Max")) {
    log(p.reason);
  }

  // The status line, re-read after any action.
  const debtNow = p.kind === "wait" ? debt : await read<bigint>(credit, creditAbi, "debtOf", [me, assetId]);
  const collNow = p.kind === "wait" ? pos.collateralShares : (await read<{ collateralShares: bigint }>(credit, creditAbi, "position", [me, assetId])).collateralShares;
  const position = debtNow > 0n ? "open" : collNow > 0n ? "collateral only" : "none";
  const cureAt = at(cycleStart + cureStart!), endAt = at(cycleStart + sessionEnd!), nextCycle = at(cycleStart + weekLength!);
  const next = d.state === "SESSION"
    ? position === "open" ? { next: "Becomes curable when the demo Last Call opens", nextAt: cureAt } : { next: "Opens a Session Max position", nextAt: d.toCureStart >= 300n ? new Date().toISOString() : nextCycle }
    : d.state === "LAST_CALL"
      ? { next: position === "open" ? "Waits for anyone to cure it; repays what is left when the market closes" : "Re-arms in the next cycle", nextAt: endAt }
      : { next: "Opens a Session Max position in the next cycle", nextAt: nextCycle };
  status({ state: d.state, position, debt: formatUnits(debtNow, 6), ...next, note: p.kind === "wait" ? p.reason : p.kind });
}

log(`keeper ${me} starting on chain ${CHAIN}`);
for (;;) {
  try { await tick(); } catch (e) { log(`error: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`); }
  await sleep(60_000);
}
