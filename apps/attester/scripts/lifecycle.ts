/**
 * The scripted end-to-end credit lifecycle on X Layer testnet:
 *
 *   supply -> deposit collateral -> borrow at Session Max -> wait for Last Call
 *          -> cure (by a different account, permissionlessly) -> repay -> withdraw
 *
 * Every transaction hash is printed so the whole run can be checked on the explorer. The cure
 * amount the contract computes is printed next to the amount actually executed, because the
 * covenant is the claim this project makes and it should be checkable to the unit.
 *
 * The borrower and supplier is the deployer key. The curer is the poster key: cure is
 * permissionless and Kerb does not privilege its own keeper, so it must work from another account.
 */
import { encodeAbiParameters, formatUnits, keccak256, parseUnits, type Address, type Hex } from "viem";
import { explorerTx, type KerbChainId } from "@kerb/adapters";
import { artifact, deploymentOf, walletFor, suffix } from "../src/chain.js";

const chainId = 1952 as KerbChainId;
const borrower = walletFor(chainId, "KERB_DEPLOYER_KEY");
const curer = walletFor(chainId, "KERB_POSTER_KEY");

const credit = deploymentOf(chainId, "KerbCredit").address;
const usdg = deploymentOf(chainId, "MockUSDG").address;
const mirror = deploymentOf(chainId, "KerbMirror:KOx").address;
const demoClock = deploymentOf(chainId, "KerbClockDemo").address;

const creditAbi = artifact("KerbCredit").abi;
const usdgAbi = artifact("MockUSDG").abi;
const mirrorAbi = artifact("KerbMirror").abi;
const clockAbi = artifact("KerbClockDemo").abi;

const assetId: Hex = keccak256(
  encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [BigInt(chainId), mirror]),
);

const steps: { step: string; hash: string; gas: string }[] = [];

async function send(
  wallet: typeof borrower,
  label: string,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  args: unknown[],
): Promise<void> {
  // X Layer testnet's estimateGas comes back tight on these paths: the first trim ran out of
  // gas with gasUsed exactly equal to the estimate. Estimate, then leave real headroom.
  const estimated = await wallet.estimateContractGas({
    address, abi, functionName, args, account: wallet.account,
    ...(suffix() ? { dataSuffix: suffix() } : {}),
  } as never);
  const hash = await wallet.writeContract({
    address, abi, functionName, args, chain: wallet.chain, account: wallet.account,
    gas: (estimated * 150n) / 100n,
    ...(suffix() ? { dataSuffix: suffix() } : {}),
  } as never);
  const receipt = await wallet.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  // The public RPC is load balanced, so the node answering the next eth_call may not have the
  // block yet. Wait for it, or a read straight after a write quietly returns the old state.
  for (let i = 0; i < 40; i++) {
    if ((await wallet.getBlockNumber({ cacheTime: 0 })) >= receipt.blockNumber) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  steps.push({ step: label, hash, gas: receipt.gasUsed.toString() });
  console.log(`${label.padEnd(26)} gas ${String(receipt.gasUsed).padStart(7)}  ${explorerTx(chainId, hash)}`);
}

const read = async <T>(address: Address, abi: readonly unknown[], functionName: string, args: unknown[] = []): Promise<T> =>
  (await borrower.readContract({ address, abi, functionName, args } as never)) as T;

const usd = (v: bigint): string => `${formatUnits(v, 6)} mUSDG`;

console.log(`KerbCredit ${credit}`);
console.log(`collateral ${mirror}  assetId ${assetId}`);
console.log(`borrower   ${borrower.account.address}`);
console.log(`curer      ${curer.account.address}\n`);

// ---------------------------------------------------------------- 1. supply
const SUPPLY = parseUnits("20000", 6);
await send(borrower, "1. faucet mUSDG", usdg, usdgAbi, "faucet", [SUPPLY + parseUnits("5000", 6)]);
await send(borrower, "2. approve mUSDG", usdg, usdgAbi, "approve", [credit, 2n ** 255n]);
await send(borrower, "3. supply", credit, creditAbi, "supply", [SUPPLY]);

// ---------------------------------------------------------------- 2. read the real terms
const terms = deploymentOf(chainId, "KerbTerms").address;
const termsAbi = artifact("KerbTerms").abi;
const eff = await read<[bigint, bigint, bigint, number, boolean]>(terms, termsAbi, "effectiveTerms", [assetId]);
const [carryLTV, sessionMaxLTV, mark, regime, usable] = eff;
const latest = await read<{ maxPositionDebt: bigint; debtCeiling: bigint }>(terms, termsAbi, "latest", [assetId]);
console.log(
  `\nterms: mark ${formatUnits(mark, 18)}  carry ${formatUnits(carryLTV, 16)}%  sessionMax ${formatUnits(sessionMaxLTV, 16)}%  regime ${regime}  usable ${usable}`,
);
console.log(`       debtCeiling ${usd(latest.debtCeiling)}  maxPositionDebt ${usd(latest.maxPositionDebt)}`);
if (!usable) throw new Error("terms are not usable right now; relay a fresh mirror report first");

/**
 * These are the real KTS capacities for the underlying, so the position cap binds well below
 * what the collateral alone would allow. Size the position to sit just inside it: the draw has
 * to clear the Carry target for the covenant to attach, and stay under the cap to be accepted.
 */
const targetDraw = (latest.maxPositionDebt * 90n) / 100n;
const neededValue = (targetDraw * 10n ** 18n) / sessionMaxLTV;
const COLLATERAL = (neededValue * 10n ** 12n * 10n ** 18n) / mark;

const already = await read<{ collateralShares: bigint }>(credit, creditAbi, "position", [borrower.account.address, assetId]);
console.log(`sizing: collateral ${formatUnits(COLLATERAL, 18)} kKOx for a ${usd(targetDraw)} draw (already holding ${formatUnits(already.collateralShares, 18)})`);

// Too much collateral is as wrong as too little here: the position cap binds the draw, so an
// oversized deposit leaves the position below its Carry target and the covenant never attaches.
if (COLLATERAL > already.collateralShares) {
  const topUp = COLLATERAL - already.collateralShares;
  await send(borrower, "4. faucet kKOx", mirror, mirrorAbi, "faucet", [topUp]);
  await send(borrower, "5. approve kKOx", mirror, mirrorAbi, "approve", [credit, 2n ** 255n]);
  await send(borrower, "6. deposit collateral", credit, creditAbi, "deposit", [assetId, topUp]);
} else if (already.collateralShares > COLLATERAL) {
  await send(borrower, "4. trim collateral", credit, creditAbi, "withdrawCollateral", [
    assetId,
    already.collateralShares - COLLATERAL,
  ]);
}

// ---------------------------------------------------------------- 3. borrow at Session Max
const held = await read<{ collateralShares: bigint }>(credit, creditAbi, "position", [borrower.account.address, assetId]);
const value = (held.collateralShares * mark) / 10n ** 18n / 10n ** 12n; // into 6-decimal loan units
const openDebt = await read<bigint>(credit, creditAbi, "debtOf", [borrower.account.address, assetId]);
let draw = (value * sessionMaxLTV) / 10n ** 18n - 1n - openDebt;
if (draw + openDebt > latest.maxPositionDebt) draw = latest.maxPositionDebt - openDebt - 1n;
console.log(`collateral value ${usd(value)}  drawing ${usd(draw)} at Session Max\n`);
if (draw > 0n) {
  await send(borrower, "7. borrow (Session Max)", credit, creditAbi, "borrow", [assetId, draw, 1]);
}

const ltvNow = await read<bigint>(credit, creditAbi, "positionLTV", [borrower.account.address, assetId]);
if (ltvNow <= carryLTV) {
  throw new Error(
    `the position sits at ${formatUnits(ltvNow, 16)}%, at or below the Carry target of ${formatUnits(carryLTV, 16)}%: ` +
      "there would be nothing for the covenant to cure",
  );
}
console.log(`position LTV ${formatUnits(ltvNow, 16)}%, above the Carry target of ${formatUnits(carryLTV, 16)}%`);

const position = await read<{ carryTarget: bigint; mode: number }>(credit, creditAbi, "position", [
  borrower.account.address,
  assetId,
]);
console.log(`covenant recorded: carryTarget ${formatUnits(position.carryTarget, 16)}%  mode ${position.mode}`);

// ---------------------------------------------------------------- 4. wait for Last Call
const [openNow, ,] = await read<[boolean, bigint]>(demoClock, clockAbi, "cureWindowOpen", [assetId, BigInt(Math.floor(Date.now() / 1000))]);
if (!openNow) {
  const phase = await read<bigint>(demoClock, clockAbi, "phase", [BigInt(Math.floor(Date.now() / 1000))]);
  const cureStart = 2400n;
  const week = 3600n;
  const wait = phase < cureStart ? cureStart - phase : week - phase + cureStart;
  console.log(`\nLast Call opens in ${wait}s on the compressed clock. Waiting.`);
  await new Promise((r) => setTimeout(r, Number(wait + 15n) * 1000));
}

// ---------------------------------------------------------------- 5. cure
const status = await read<[boolean, bigint, bigint]>(credit, creditAbi, "cureStatus", [borrower.account.address, assetId]);
const [eligible, deadline, required] = status;
console.log(`\ncureStatus: eligible ${eligible}  deadline ${new Date(Number(deadline) * 1000).toISOString()}  required ${usd(required)}`);
if (!eligible) throw new Error("the position is not curable; the window may have closed");

const debtBefore = await read<bigint>(credit, creditAbi, "debtOf", [borrower.account.address, assetId]);
const ltvBefore = await read<bigint>(credit, creditAbi, "positionLTV", [borrower.account.address, assetId]);

await send(curer, "8. faucet mUSDG (curer)", usdg, usdgAbi, "faucet", [required + parseUnits("100", 6)]);
await send(curer, "9. approve mUSDG (curer)", usdg, usdgAbi, "approve", [credit, 2n ** 255n]);
await send(curer, "10. cure", credit, creditAbi, "cure", [borrower.account.address, assetId, required]);

const debtAfter = await read<bigint>(credit, creditAbi, "debtOf", [borrower.account.address, assetId]);
const ltvAfter = await read<bigint>(credit, creditAbi, "positionLTV", [borrower.account.address, assetId]);
const executed = debtBefore - debtAfter;
console.log(`\ncure computed ${usd(required)}   executed ${usd(executed)}   difference ${usd(required > executed ? required - executed : executed - required)}`);
console.log(`LTV ${formatUnits(ltvBefore, 16)}% -> ${formatUnits(ltvAfter, 16)}%   target ${formatUnits(position.carryTarget, 16)}%`);

// ---------------------------------------------------------------- 6. repay and withdraw
const remaining = await read<bigint>(credit, creditAbi, "debtOf", [borrower.account.address, assetId]);
await send(borrower, "11. repay the rest", credit, creditAbi, "repay", [assetId, remaining + parseUnits("1", 6)]);
const finalPosition = await read<{ collateralShares: bigint }>(credit, creditAbi, "position", [borrower.account.address, assetId]);
await send(borrower, "12. withdraw collateral", credit, creditAbi, "withdrawCollateral", [assetId, finalPosition.collateralShares]);

console.log("\nlifecycle complete");
console.table(steps);
