/**
 * List the mirror assets as collateral on the testnet KerbCredit, and give each one guardrails
 * on the testnet KerbTerms so the attester can relay the real mainnet Credit Mark to it.
 *
 * Guardrails here are deliberately tighter than mainnet's: this is a demonstration market with
 * a fixed liquidation threshold, and nothing about it should look like a production risk setting.
 */
import { parseUnits, encodeAbiParameters, keccak256, type Address, type Hex } from "viem";
import { explorerTx, type KerbChainId } from "@kerb/adapters";
import { artifact, deploymentOf, walletFor, suffix } from "../src/chain.js";

const chainId = 1952 as KerbChainId;
const wallet = walletFor(chainId, "KERB_DEPLOYER_KEY");

const credit = deploymentOf(chainId, "KerbCredit").address;
const terms = deploymentOf(chainId, "KerbTerms").address;

/** assetId = keccak256(abi.encode(chainId, token)), the same rule the engine uses. */
function assetIdOf(chain: number, token: Address): Hex {
  return keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [BigInt(chain), token]));
}

/**
 * The fixed liquidation threshold must sit clear above Session Max, or a position drawn to its
 * ceiling would be liquidatable the instant it opened. The guardrail ltvMax must in turn sit
 * above the Session Max the engine actually publishes, or the contract clamps Session Max down
 * to Carry and the cure covenant can never trigger at all.
 *
 *   KOx    engine publishes carry 55%, sessionMax 60%  ->  ltvMax 62%, LT 68%
 *   HKEXCx engine publishes carry 50%, sessionMax 55%  ->  ltvMax 57%, LT 63%
 */
const MIRRORS = [
  { key: "KerbMirror:KOx", mirrors: "KOx", lt: 680_000_000_000_000_000n, ltvMax: 620_000_000_000_000_000n },
  { key: "KerbMirror:HKEXCx", mirrors: "HKEXCx", lt: 630_000_000_000_000_000n, ltvMax: 570_000_000_000_000_000n },
] as const;

const termsAbi = artifact("KerbTerms").abi;
const creditAbi = artifact("KerbCredit").abi;

async function send(address: Address, abi: typeof termsAbi, functionName: string, args: unknown[]): Promise<void> {
  const hash = await wallet.writeContract({
    address, abi, functionName, args, chain: wallet.chain, account: wallet.account,
    ...(suffix() ? { dataSuffix: suffix() } : {}),
  } as never);
  const receipt = await wallet.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success") throw new Error(`${functionName} failed: ${hash}`);
  console.log(`   ${functionName} gas ${receipt.gasUsed}  ${explorerTx(chainId, hash)}`);
}

for (const m of MIRRORS) {
  const token = deploymentOf(chainId, m.key).address;
  const assetId = assetIdOf(chainId, token);
  console.log(`${m.mirrors}  token ${token}\n   assetId ${assetId}`);

  // Guardrails on KerbTerms, so a relayed report has absolute limits to be clamped into.
  await send(terms, termsAbi, "setGuardrails", [
    assetId,
    {
      ltvMin: 50_000_000_000_000_000n, // 5%
      ltvMax: m.ltvMax,
      ceilingMin: 0n,
      ceilingMax: parseUnits("50000", 6),
      maxLoosenStepBps: 500n, // 5% per step
      loosenCooldownSec: 900,
      maxReportAgeSec: 3600,
      LT: m.lt,
      exists: true,
    },
  ]);

  // Collateral on KerbCredit. The liquidation threshold is fixed here and has no setter.
  const existing = (await wallet.readContract({
    address: credit, abi: creditAbi, functionName: "collateral", args: [assetId],
  })) as { listed: boolean; liquidationThreshold: bigint };
  if (existing.listed) {
    console.log(`   already listed with LT ${existing.liquidationThreshold}, leaving it alone`);
    continue;
  }
  await send(credit, creditAbi, "listCollateral", [
    assetId,
    {
      token,
      wrapper: token, // a mirror is its own wrapper at 1:1 and says so in convertToAssets
      tokenDecimals: 18,
      liquidationThreshold: m.lt,
      closeFactor: 500_000_000_000_000_000n, // 50%
      cureBonus: 15_000_000_000_000_000n, // 1.5%
      defaultBonus: 70_000_000_000_000_000n, // 7%
      listed: false,
    },
  ]);
}

console.log("\nmirrors listed. Relay the mainnet marks with: pnpm --filter @kerb/attester relay-mirrors");
