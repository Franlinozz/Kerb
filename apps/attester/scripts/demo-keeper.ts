/**
 * The demo position keeper (V2-08 B, AGENTS.md gate 6: runs only with the operator's written
 * approval, from its own testnet-only wallet funded from faucets).
 *
 * So that every demo Last Call has at least one curable position for a visitor to cure, the keeper
 * holds one Session Max position on kHKEXCx sized between Carry and Session Max:
 *   SESSION   (before the last 5 minutes before Last Call): open it if there is none.
 *   LAST_CALL: do nothing; the position is there to be cured by anyone.
 *   CLOSED:    repay and withdraw whatever is left, so the next cycle starts clean.
 * Hard caps: chain 1952 only, debt never above 2,000 mUSDG, never more than one position.
 * Every action and its transaction hash is appended to data/keeper.log.
 */
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatUnits, parseUnits, type Address, type Hex } from "viem";
import { repoRoot, type KerbChainId } from "@kerb/adapters";
import { artifact, deploymentOf, walletFor } from "../src/chain.js";
import { dataSuffix } from "../src/builder-code.js";

const CHAIN = 1952 as KerbChainId;
const MAX_DEBT = parseUnits("2000", 6);
const LOG = resolve(repoRoot(), "data/keeper.log");
const WAD = 10n ** 18n;

const wallet = walletFor(CHAIN, "KERB_KEEPER_KEY");
if ((await wallet.getChainId()) !== 1952) throw new Error("the keeper runs on X Layer testnet (1952) only");
const me = wallet.account.address;
const credit = deploymentOf(CHAIN, "KerbCredit").address as Address;
const demo = deploymentOf(CHAIN, "KerbClockDemo").address as Address;
const mirror = deploymentOf(CHAIN, "KerbMirror:HKEXCx").address as Address;
const loan = deploymentOf(CHAIN, "MockUSDG").address as Address;
const creditAbi = artifact("KerbCredit").abi, termsAbi = artifact("KerbTerms").abi, erc = artifact("MockUSDG").abi, mirrorAbi = artifact("KerbMirror").abi, demoAbi = artifact("KerbClockDemo").abi;
const terms = deploymentOf(CHAIN, "KerbTerms").address as Address;
const suffix = dataSuffix();

const log = (what: string, tx?: Hex): void => {
  const line = `${new Date().toISOString()} ${what}${tx ? ` ${tx}` : ""}`;
  console.log(line);
  appendFileSync(LOG, `${line}\n`);
};

const read = <T>(address: Address, abi: readonly unknown[], functionName: string, args: unknown[] = []): Promise<T> =>
  wallet.readContract({ address, abi, functionName, args } as never) as Promise<T>;

async function send(address: Address, abi: readonly unknown[], functionName: string, args: unknown[], what: string): Promise<void> {
  const hash = await wallet.writeContract({ address, abi, functionName, args, chain: wallet.chain, account: wallet.account, ...(suffix ? { dataSuffix: suffix } : {}) } as never);
  const r = await wallet.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (r.status !== "success") throw new Error(`${what} reverted ${hash}`);
  log(what, hash);
  // The public RPC is load balanced: wait until reads see this block.
  while ((await wallet.getBlockNumber()) < r.blockNumber) await new Promise((x) => setTimeout(x, 1000));
}

async function tick(): Promise<void> {
  const [weekLength, sessionEnd, cureStart, epoch] = await Promise.all(["weekLength", "sessionEnd", "cureStart", "epoch"].map((f) => read<bigint>(demo, demoAbi, f)));
  const now = BigInt(Math.floor(Date.now() / 1000));
  const phase = (now - epoch!) % weekLength!;
  const state = phase < cureStart! ? "SESSION" : phase < sessionEnd! ? "LAST_CALL" : "CLOSED";
  const assetId = (await import("@kerb/types")).assetId(CHAIN, mirror) as Hex;
  const pos = await read<{ collateralShares: bigint; debtShares: bigint }>(credit, creditAbi, "position", [me, assetId]);
  const debt = await read<bigint>(credit, creditAbi, "debtOf", [me, assetId]);

  if (state === "CLOSED" && (debt > 0n || pos.collateralShares > 0n)) {
    if (debt > 0n) {
      if ((await read<bigint>(loan, erc, "balanceOf", [me])) < debt + parseUnits("1", 6)) await send(loan, erc, "faucet", [parseUnits("5000", 6)], "mint mUSDG to repay");
      if ((await read<bigint>(loan, erc, "allowance", [me, credit])) < debt * 2n) await send(loan, erc, "approve", [credit, (1n << 255n) - 1n], "approve mUSDG");
      await send(credit, creditAbi, "repay", [assetId, (1n << 255n) - 1n], `repay ${formatUnits(debt, 6)} mUSDG`);
    }
    const held = (await read<{ collateralShares: bigint }>(credit, creditAbi, "position", [me, assetId])).collateralShares;
    if (held > 0n) await send(credit, creditAbi, "withdrawCollateral", [assetId, held], "withdraw collateral");
    return;
  }
  // Open only with at least five minutes before Last Call, and only if nothing is open.
  if (state !== "SESSION" || debt > 0n || cureStart! - phase < 300n) return;

  const [carry, smax, mark, , usable] = await read<[bigint, bigint, bigint, number, boolean]>(terms, termsAbi, "effectiveTerms", [assetId]);
  if (!usable) { log(`terms not usable, not opening`); return; }
  const cap = (await read<{ maxPositionDebt: bigint }>(terms, termsAbi, "latest", [assetId])).maxPositionDebt;
  const want = [MAX_DEBT, (cap * 9n) / 10n].reduce((a, b) => (a < b ? a : b));
  const target = carry + ((smax - carry) * 3n) / 4n; // three quarters of the way from Carry to Session Max
  if (target <= carry) { log("Session Max is not above Carry right now, not opening"); return; }
  const value = (want * 10n ** 12n * WAD) / target; // loan units scaled to WAD
  const coll = (value * WAD) / mark + WAD / 100n;
  if ((await read<bigint>(mirror, mirrorAbi, "balanceOf", [me])) < coll) await send(mirror, mirrorAbi, "faucet", [coll], `mint ${formatUnits(coll, 18)} kHKEXCx`);
  if ((await read<bigint>(mirror, mirrorAbi, "allowance", [me, credit])) < coll) await send(mirror, mirrorAbi, "approve", [credit, (1n << 255n) - 1n], "approve kHKEXCx");
  await send(credit, creditAbi, "deposit", [assetId, coll], `deposit ${formatUnits(coll, 18)} kHKEXCx`);
  await send(credit, creditAbi, "borrow", [assetId, want, 1], `borrow ${formatUnits(want, 6)} mUSDG with Session Max`);
}

log(`keeper ${me} starting on chain ${CHAIN}`);
for (;;) {
  try { await tick(); } catch (e) { log(`error: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`); }
  await new Promise((x) => setTimeout(x, 60_000));
}
