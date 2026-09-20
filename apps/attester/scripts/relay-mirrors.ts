/**
 * Relay the real mainnet Credit Mark onto the testnet mirror assets.
 *
 * This is what keeps the credit demonstration honest: the collateral is test tokens, but the
 * risk data underneath it is the same Market-Time Report Kerb posts to X Layer mainnet, for the
 * same underlying, at the same moment. Nothing is invented for the demo.
 *
 * Runs once per invocation; loop it or call it before a demo.
 */
import { encodeAbiParameters, keccak256, parseUnits, type Address, type Hex } from "viem";
import { explorerTx, loadAssets, resolvedAssets, type KerbChainId } from "@kerb/adapters";
import { buildBundle, computeReport, engineConfig, identifyBundle, loadParams, pinBundle } from "@kerb/engine";
import { connect } from "@kerb/collector/db";
import { artifact, deploymentOf, walletFor, suffix } from "../src/chain.js";
import { prepareTerms, regimeIndex, type OnchainGuardrails } from "../src/post.js";
import { signTerms, type TermsStruct } from "../src/sign.js";

const chainId = 1952 as KerbChainId;
const wallet = walletFor(chainId, "KERB_POSTER_KEY");
const terms = deploymentOf(chainId, "KerbTerms").address;
const termsAbi = artifact("KerbTerms").abi;

const MIRRORS = [
  { key: "KerbMirror:KOx", symbol: "KOx" },
  { key: "KerbMirror:HKEXCx", symbol: "HKEXCx" },
] as const;

const assetIdOf = (chain: number, token: Address): Hex =>
  keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [BigInt(chain), token]));

const { sql } = connect();
const params = loadParams();
const cfg = loadAssets();
const loanDecimals = cfg.quoteTokens[cfg.loanAsset]?.decimals ?? 6;

try {
  for (const m of MIRRORS) {
    const token = deploymentOf(chainId, m.key).address;
    const assetId = assetIdOf(chainId, token);

    // The report is the real one, built from mainnet observations for the real underlying.
    const asset = resolvedAssets(cfg).find((a) => a.symbol === m.symbol);
    if (!asset) throw new Error(`${m.symbol} is not a resolved asset`);
    const bundle = await buildBundle(sql, m.symbol, params, {});
    const engine = engineConfig(params, m.symbol, bundle.market.cureWindowSec);
    const report = computeReport(bundle, engine);
    const id = identifyBundle(bundle);
    const pin = await pinBundle(id.canonical, id.cidV1Raw, `mirror-${m.symbol}-${report.observedAt}`);

    const rails = (await wallet.readContract({
      address: terms, abi: termsAbi, functionName: "guardrails", args: [assetId],
    })) as OnchainGuardrails;
    if (!rails.exists) throw new Error(`no guardrails for the ${m.symbol} mirror; run list-collateral first`);

    const previous = (await wallet.readContract({
      address: terms, abi: termsAbi, functionName: "latest", args: [assetId],
    })) as TermsStruct;
    const prev = previous.observedAt === 0n ? null : previous;

    const { terms: t, clamped } = prepareTerms(report, rails, prev, loanDecimals);
    if (prev && t.observedAt <= prev.observedAt) {
      console.log(`${m.symbol}: no newer observation than the one already posted, skipping`);
      continue;
    }

    const sig = await signTerms(chainId, terms as Address, assetId, t);
    const hash = await wallet.writeContract({
      address: terms, abi: termsAbi, functionName: "postTerms", args: [assetId, t, sig],
      chain: wallet.chain, account: wallet.account, ...(suffix() ? { dataSuffix: suffix() } : {}),
    } as never);
    const receipt = await wallet.waitForTransactionReceipt({ hash, timeout: 180_000 });
    if (receipt.status !== "success") throw new Error(`${m.symbol}: postTerms reverted ${hash}`);

    console.log(
      `${m.symbol} mirror  regime ${report.regime}  mark ${t.creditMark}  carry ${t.carryLTV}  sessionMax ${t.sessionMaxLTV}` +
        `  ceiling ${t.debtCeiling}  pin=${pin.status}${clamped.length ? `  clamped:${clamped.map((c) => c.field).join(",")}` : ""}`,
    );
    console.log(`   assetId ${assetId}`);
    console.log(`   ${explorerTx(chainId, hash)}`);
    void regimeIndex;
    void parseUnits;
  }
} finally {
  await sql.end();
}
