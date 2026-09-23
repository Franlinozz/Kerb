/**
 * Deploy the read-only consumers of Kerb Terms (V3-05, docs/v3/SPEC-ONCHAIN-CONSUMERS.md):
 * KerbQuote and KerbMarkFeedFactory, then one KerbMarkFeed per asset with posted terms.
 * They hold nothing and own nothing. Idempotent: existing deployments and feeds are reused.
 *
 *   node --env-file=/root/.kerb/secrets.env --import tsx scripts/deploy-consumers.ts 1952
 *   KERB_CONSUMERS_MAINNET_GO=yes ... scripts/deploy-consumers.ts 196   # only on the operator's "go consumers mainnet"
 */
import { formatEther, type Address, type Hex } from "viem";
import { explorerAddress, explorerTx, type KerbChainId } from "@kerb/adapters";
import { connect } from "@kerb/collector/db";
import { artifact, loadDeployments, saveDeployment, suffix, walletFor } from "../src/chain.js";

const chainId = Number(process.argv[2] ?? 1952) as KerbChainId;
if (chainId !== 1952 && chainId !== 196) throw new Error("chain 1952 or 196");
if (chainId === 196 && process.env["KERB_CONSUMERS_MAINNET_GO"] !== "yes") throw new Error('mainnet needs the operator\'s "go consumers mainnet" (AGENTS.md 13.6 gate 12)');

const wallet = walletFor(chainId, "KERB_DEPLOYER_KEY");
if ((await wallet.getChainId()) !== chainId) throw new Error("RPC chain mismatch");
const deployer = wallet.account.address;
console.log(`chain ${chainId}  deployer ${deployer}  balance ${formatEther(await wallet.getBalance({ address: deployer }))} OKB`);
const d = loadDeployments();
const terms = d[`${chainId}:KerbTerms`]?.address as Address | undefined;
const clock = d[`${chainId}:KerbClock`]?.address as Address | undefined;
if (!terms || !clock) throw new Error(`KerbTerms or KerbClock missing on ${chainId}`);

async function deploy(name: string, args: unknown[]): Promise<Address> {
  const existing = loadDeployments()[`${chainId}:${name}`];
  if (existing) { console.log(`${name}: reusing ${existing.address}`); return existing.address as Address; }
  const { abi, bytecode } = artifact(name);
  const hash = await wallet.deployContract({ abi, bytecode, args, chain: wallet.chain, account: wallet.account, ...(suffix() ? { dataSuffix: suffix() } : {}) });
  const r = await wallet.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (r.status !== "success" || !r.contractAddress) throw new Error(`${name} deployment failed: ${hash}`);
  saveDeployment(`${chainId}:${name}`, { chainId, name, address: r.contractAddress, deployedAtBlock: r.blockNumber.toString(), deployedAt: new Date().toISOString(), txHash: hash, args, verified: false, explorer: explorerAddress(chainId, r.contractAddress), group: "consumers" } as never);
  console.log(`${name}: ${r.contractAddress}  block ${r.blockNumber}  gas ${r.gasUsed}  ${explorerTx(chainId, hash)}`);
  while ((await wallet.getBlockNumber()) < r.blockNumber) await new Promise((x) => setTimeout(x, 1000));
  return r.contractAddress;
}

const quote = await deploy("KerbQuote", [terms, clock, 6]);
const factory = await deploy("KerbMarkFeedFactory", [terms]);
void quote;

// One feed per asset with posted terms on this chain.
const { sql } = connect();
const assets = await sql<{ asset_id: string; symbol: string }[]>`SELECT DISTINCT ON (asset_id) asset_id, symbol FROM terms_posts WHERE chain_id = ${chainId} ORDER BY asset_id, ts DESC`;
await sql.end();
const fAbi = artifact("KerbMarkFeedFactory").abi;
for (const a of assets) {
  const key = `${chainId}:KerbMarkFeed:${a.symbol}`;
  const onchain = (await wallet.readContract({ address: factory, abi: fAbi, functionName: "feedOf", args: [a.asset_id as Hex] })) as Address;
  if (onchain !== "0x0000000000000000000000000000000000000000") {
    if (!loadDeployments()[key]) saveDeployment(key, { chainId, name: "KerbMarkFeed", address: onchain, deployedAtBlock: "0", deployedAt: new Date().toISOString(), txHash: "", args: [terms, a.asset_id, `Kerb Credit Mark ${a.symbol} / USDG`], verified: false, explorer: explorerAddress(chainId, onchain), group: "consumers", symbol: a.symbol } as never);
    console.log(`feed ${a.symbol}: exists ${onchain}`);
    continue;
  }
  const description = `Kerb Credit Mark ${a.symbol} / USDG`;
  const hash = await wallet.writeContract({ address: factory, abi: fAbi, functionName: "create", args: [a.asset_id as Hex, description], chain: wallet.chain, account: wallet.account, ...(suffix() ? { dataSuffix: suffix() } : {}) });
  const r = await wallet.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (r.status !== "success") throw new Error(`feed ${a.symbol} failed: ${hash}`);
  while ((await wallet.getBlockNumber()) < r.blockNumber) await new Promise((x) => setTimeout(x, 1000));
  const feed = (await wallet.readContract({ address: factory, abi: fAbi, functionName: "feedOf", args: [a.asset_id as Hex] })) as Address;
  saveDeployment(key, { chainId, name: "KerbMarkFeed", address: feed, deployedAtBlock: r.blockNumber.toString(), deployedAt: new Date().toISOString(), txHash: hash, args: [terms, a.asset_id, description], verified: false, explorer: explorerAddress(chainId, feed), group: "consumers", symbol: a.symbol } as never);
  console.log(`feed ${a.symbol}: ${feed}  gas ${r.gasUsed}  ${explorerTx(chainId, hash)}`);
}
console.log(`balance after ${formatEther(await wallet.getBalance({ address: deployer }))} OKB`);
