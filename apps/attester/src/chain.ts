import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createWalletClient, http, publicActions, type Abi, type Account, type Address, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainById, publicClient, repoRoot, type KerbChainId } from "@kerb/adapters";
import { dataSuffix } from "./builder-code.js";

export interface Deployment {
  chainId: number;
  name: string;
  address: Address;
  deployedAtBlock: string;
  deployedAt: string;
  txHash: Hex;
  args: unknown[];
  verified: boolean;
  explorer: string;
}

export function deploymentsPath(): string {
  return process.env["KERB_DEPLOYMENTS_FILE"] ?? resolve(repoRoot(), "config/deployments.json");
}

export function loadDeployments(): Record<string, Deployment> {
  const p = deploymentsPath();
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Record<string, Deployment>) : {};
}

export function saveDeployment(key: string, d: Deployment): void {
  const all = loadDeployments();
  all[key] = d;
  writeFileSync(deploymentsPath(), `${JSON.stringify(all, null, 2)}\n`);
}

export function deploymentOf(chainId: number, name: string): Deployment {
  const d = loadDeployments()[`${chainId}:${name}`];
  if (!d) throw new Error(`${name} is not deployed on chain ${chainId}; run the deploy script first`);
  return d;
}

/** Foundry artifact: ABI and creation bytecode. */
export function artifact(name: string): { abi: Abi; bytecode: Hex } {
  const p = resolve(repoRoot(), `contracts/out/${name}.sol/${name}.json`);
  const j = JSON.parse(readFileSync(p, "utf8")) as { abi: Abi; bytecode: { object: Hex } };
  return { abi: j.abi, bytecode: j.bytecode.object };
}

export function requireKey(name: string): Hex {
  const k = process.env[name];
  if (!k || !/^0x[0-9a-fA-F]{64}$/.test(k)) throw new Error(`${name} is not set or is not a private key`);
  return k as Hex;
}

/** Wallet client with public actions. Callers attach the Builder Code suffix to each send. */
export function walletFor(chainId: KerbChainId, keyEnv: string) {
  const account: Account = privateKeyToAccount(requireKey(keyEnv));
  const chain: Chain = chainById(chainId);
  const rpc = chainId === 196 ? process.env["KERB_RPC_MAINNET"] : process.env["KERB_RPC_TESTNET"];
  return createWalletClient({
    account,
    chain,
    transport: http(rpc ?? (chain.rpcUrls.default.http[0] as string), { timeout: 30_000, retryCount: 3 }),
  }).extend(publicActions);
}

export type KerbWallet = ReturnType<typeof walletFor>;

export const suffix = dataSuffix;
export { publicClient };
