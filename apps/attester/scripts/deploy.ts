/**
 * Deploy KerbClock and KerbTerms. Testnet by default; mainnet requires KERB_ALLOW_MAINNET=1
 * and prints a confirmation summary first (AGENTS.md hard gate 1).
 */
import { formatEther, type Address } from "viem";
import { explorerAddress, explorerTx, type KerbChainId } from "@kerb/adapters";
import { artifact, saveDeployment, walletFor, suffix } from "../src/chain.js";

const chainId = Number(process.argv[2] ?? 1952) as KerbChainId;
if (chainId === 196 && process.env["KERB_ALLOW_MAINNET"] !== "1") {
  throw new Error("mainnet deployment requires KERB_ALLOW_MAINNET=1 and written operator approval (AGENTS.md gate 1)");
}
const wallet = walletFor(chainId, "KERB_DEPLOYER_KEY");
const deployer = wallet.account.address;
const bootstrapAdmin = (process.env["KERB_ADMIN_ADDRESS"] ?? deployer) as Address;

const balance = await wallet.getBalance({ address: deployer });
console.log(`chain ${chainId}  deployer ${deployer}  balance ${formatEther(balance)} OKB`);
console.log(`bootstrap timelock and admin: ${bootstrapAdmin}`);
console.log(`builder code suffix: ${suffix() ?? "none configured"}`);
if (balance === 0n) throw new Error("deployer has no gas");

for (const name of ["KerbClock", "KerbTerms"] as const) {
  const { abi, bytecode } = artifact(name);
  const hash = await wallet.deployContract({
    abi, bytecode, args: [bootstrapAdmin, bootstrapAdmin], chain: wallet.chain, account: wallet.account,
    ...(suffix() ? { dataSuffix: suffix() } : {}),
  });
  const receipt = await wallet.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${name} deployment failed: ${hash}`);
  const address = receipt.contractAddress;
  saveDeployment(`${chainId}:${name}`, {
    chainId, name, address, deployedAtBlock: receipt.blockNumber.toString(), deployedAt: new Date().toISOString(),
    txHash: hash, args: [bootstrapAdmin, bootstrapAdmin], verified: false, explorer: explorerAddress(chainId, address),
  });
  console.log(`${name}: ${address}  block ${receipt.blockNumber}  gas ${receipt.gasUsed}`);
  console.log(`   ${explorerAddress(chainId, address)}`);
  console.log(`   tx ${explorerTx(chainId, hash)}`);
}
console.log("deployments written to config/deployments.json");
