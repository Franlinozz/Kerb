/**
 * Deploy the Kerb credit plane to X Layer testnet: the loan asset, the mirror collateral, the
 * compressed demo clock and KerbCredit itself, then list the mirrors with conservative guardrails.
 *
 * Testnet only. KerbCredit on mainnet needs written operator approval, green invariants and a
 * clean Slither run (AGENTS.md gate 1 and rule 9), and this script refuses to do it.
 */
import { formatEther, parseUnits, type Address } from "viem";
import { explorerAddress, explorerTx, type KerbChainId } from "@kerb/adapters";
import { artifact, saveDeployment, walletFor, suffix, loadDeployments } from "../src/chain.js";

const chainId = Number(process.argv[2] ?? 1952) as KerbChainId;
if (chainId !== 1952) {
  throw new Error("the credit plane is testnet only; mainnet KerbCredit needs written operator approval");
}

const wallet = walletFor(chainId, "KERB_DEPLOYER_KEY");
const deployer = wallet.account.address;
const admin = (process.env["KERB_ADMIN_ADDRESS"] ?? deployer) as Address;

const balance = await wallet.getBalance({ address: deployer });
console.log(`chain ${chainId}  deployer ${deployer}  balance ${formatEther(balance)} OKB`);
if (balance === 0n) throw new Error("deployer has no gas");

const deployments = loadDeployments();
const termsAddress = deployments[`${chainId}:KerbTerms`]?.address;
if (!termsAddress) throw new Error(`KerbTerms is not deployed on ${chainId}`);
console.log(`KerbTerms ${termsAddress}`);

/**
 * Idempotent: an existing deployment is reused unless it is named in KERB_REDEPLOY, so the
 * script can be rerun to replace one contract without orphaning the rest.
 */
async function deploy(name: string, args: unknown[], key = name): Promise<Address> {
  const redeploy = (process.env["KERB_REDEPLOY"] ?? "").split(",").map((x) => x.trim());
  const existing = loadDeployments()[`${chainId}:${key}`];
  if (existing && !redeploy.includes(key)) {
    console.log(`${key}: reusing ${existing.address} from block ${existing.deployedAtBlock}`);
    return existing.address;
  }
  const { abi, bytecode } = artifact(name);
  const hash = await wallet.deployContract({
    abi, bytecode, args, chain: wallet.chain, account: wallet.account,
    ...(suffix() ? { dataSuffix: suffix() } : {}),
  });
  const receipt = await wallet.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${name} deployment failed: ${hash}`);
  saveDeployment(`${chainId}:${key}`, {
    chainId, name, address: receipt.contractAddress, deployedAtBlock: receipt.blockNumber.toString(),
    deployedAt: new Date().toISOString(), txHash: hash, args, verified: false,
    explorer: explorerAddress(chainId, receipt.contractAddress),
  });
  console.log(`${key}: ${receipt.contractAddress}  block ${receipt.blockNumber}  gas ${receipt.gasUsed}`);
  console.log(`   ${explorerTx(chainId, hash)}`);
  return receipt.contractAddress;
}

// ---------------------------------------------------------------- the loan asset
// The real Paxos testnet USDG is live at 0xF086… but its mint is permissioned and it exposes no
// faucet, so it cannot be obtained. Degradation ladder rung 2: a clearly labelled mock.
const usdg = await deploy("MockUSDG", [parseUnits("1000000", 6)]);

// ---------------------------------------------------------------- the demo clock
// One compressed trading week per hour: 50 minutes of session, the last 10 of them Last Call.
const WEEK = 3600n;
const SESSION_END = 3000n;
const CURE_START = 2400n;
const epoch = BigInt(Math.floor(Date.now() / 1000));
const demoClock = await deploy("KerbClockDemo", [WEEK, SESSION_END, CURE_START, epoch]);

// ---------------------------------------------------------------- mirror collateral
const mirrorSpecs = [
  { mirrors: "KOx", symbol: "KOx" },
  { mirrors: "HKEXCx", symbol: "HKEXCx" },
] as const;

const mirrors: { mirrors: string; address: Address; assetId: `0x${string}` }[] = [];
for (const m of mirrorSpecs) {
  const address = await deploy("KerbMirror", [m.mirrors, m.symbol, parseUnits("10000", 18)], `KerbMirror:${m.mirrors}`);
  mirrors.push({ mirrors: m.mirrors, address, assetId: "0x" as `0x${string}` });
}

// ---------------------------------------------------------------- KerbCredit
// Two-slope kink: 1% base, +4% to the 80% kink, +60% beyond it, 10% to reserves.
const rateModel = [10n ** 16n, 4n * 10n ** 16n, 6n * 10n ** 17n, 8n * 10n ** 17n, 10n ** 17n];
const credit = await deploy("KerbCredit", [
  usdg, 6, termsAddress, demoClock, admin, admin, admin, rateModel,
]);

console.log("\ncredit plane deployed");
console.log(`  loan asset   ${usdg}  (MockUSDG, rung 2)`);
console.log(`  demo clock   ${demoClock}`);
for (const m of mirrors) console.log(`  mirror ${m.mirrors.padEnd(8)} ${m.address}`);
console.log(`  KerbCredit   ${credit}`);
console.log("\nnext: pnpm --filter @kerb/attester list-collateral");
