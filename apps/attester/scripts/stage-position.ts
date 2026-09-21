/**
 * Put a position above its Carry target so the cure path can be exercised.
 * Used to stage a demonstration; it takes no shortcuts the UI does not also take.
 */
import { encodeAbiParameters, formatUnits, keccak256, parseUnits, type Address, type Hex } from "viem";
import { explorerTx, type KerbChainId } from "@kerb/adapters";
import { artifact, deploymentOf, walletFor, suffix } from "../src/chain.js";

const chainId = 1952 as KerbChainId;
const w = walletFor(chainId, "KERB_DEPLOYER_KEY");
const credit = deploymentOf(chainId, "KerbCredit").address;
const usdg = deploymentOf(chainId, "MockUSDG").address;
const mirror = deploymentOf(chainId, "KerbMirror:KOx").address;
const terms = deploymentOf(chainId, "KerbTerms").address;
const creditAbi = artifact("KerbCredit").abi;
const usdgAbi = artifact("MockUSDG").abi;
const mirrorAbi = artifact("KerbMirror").abi;
const termsAbi = artifact("KerbTerms").abi;

const assetId: Hex = keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [BigInt(chainId), mirror]));

const read = async <T>(address: Address, abi: readonly unknown[], fn: string, args: unknown[] = []): Promise<T> =>
  (await w.readContract({ address, abi, functionName: fn, args } as never)) as T;

async function send(label: string, address: Address, abi: readonly unknown[], fn: string, args: unknown[]): Promise<void> {
  const gas = await w.estimateContractGas({ address, abi, functionName: fn, args, account: w.account, ...(suffix() ? { dataSuffix: suffix() } : {}) } as never);
  const hash = await w.writeContract({ address, abi, functionName: fn, args, chain: w.chain, account: w.account, gas: (gas * 150n) / 100n, ...(suffix() ? { dataSuffix: suffix() } : {}) } as never);
  const r = await w.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (r.status !== "success") throw new Error(`${label} reverted ${hash}`);
  for (let i = 0; i < 40; i++) {
    if ((await w.getBlockNumber({ cacheTime: 0 })) >= r.blockNumber) break;
    await new Promise((res) => setTimeout(res, 500));
  }
  console.log(`${label.padEnd(22)} gas ${String(r.gasUsed).padStart(7)}  ${explorerTx(chainId, hash)}`);
}

const [carryLTV, sessionMaxLTV, mark, , usable] = await read<[bigint, bigint, bigint, number, boolean]>(
  terms, termsAbi, "effectiveTerms", [assetId],
);
if (!usable) throw new Error("terms are not usable; relay a fresh mirror report first");
const latest = await read<{ maxPositionDebt: bigint }>(terms, termsAbi, "latest", [assetId]);

const targetDraw = (latest.maxPositionDebt * 90n) / 100n;
const neededValue = (targetDraw * 10n ** 18n) / sessionMaxLTV;
const COLLATERAL = (neededValue * 10n ** 12n * 10n ** 18n) / mark;

const held = await read<{ collateralShares: bigint }>(credit, creditAbi, "position", [w.account.address, assetId]);
if (COLLATERAL > held.collateralShares) {
  const topUp = COLLATERAL - held.collateralShares;
  await send("faucet kKOx", mirror, mirrorAbi, "faucet", [topUp]);
  if ((await read<bigint>(mirror, mirrorAbi, "allowance", [w.account.address, credit])) < topUp) {
    await send("approve kKOx", mirror, mirrorAbi, "approve", [credit, 2n ** 255n]);
  }
  await send("deposit", credit, creditAbi, "deposit", [assetId, topUp]);
} else if (held.collateralShares > COLLATERAL) {
  await send("trim collateral", credit, creditAbi, "withdrawCollateral", [assetId, held.collateralShares - COLLATERAL]);
}

if ((await read<bigint>(usdg, usdgAbi, "allowance", [w.account.address, credit])) === 0n) {
  await send("approve mUSDG", usdg, usdgAbi, "approve", [credit, 2n ** 255n]);
}

const now = await read<{ collateralShares: bigint }>(credit, creditAbi, "position", [w.account.address, assetId]);
const value = (now.collateralShares * mark) / 10n ** 18n / 10n ** 12n;
const openDebt = await read<bigint>(credit, creditAbi, "debtOf", [w.account.address, assetId]);
let draw = (value * sessionMaxLTV) / 10n ** 18n - 1n - openDebt;
if (draw + openDebt > latest.maxPositionDebt) draw = latest.maxPositionDebt - openDebt - 1n;
if (draw > 0n) await send("borrow Session Max", credit, creditAbi, "borrow", [assetId, draw, 1]);

const ltv = await read<bigint>(credit, creditAbi, "positionLTV", [w.account.address, assetId]);
const [eligible, deadline, required] = await read<[boolean, bigint, bigint]>(credit, creditAbi, "cureStatus", [w.account.address, assetId]);
console.log(`\nborrower ${w.account.address}`);
console.log(`LTV ${formatUnits(ltv, 16)}%  Carry target ${formatUnits(carryLTV, 16)}%`);
console.log(`cure: eligible=${eligible} required=${formatUnits(required, 6)} mUSDG deadline=${new Date(Number(deadline) * 1000).toISOString()}`);
