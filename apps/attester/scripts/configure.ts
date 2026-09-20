/**
 * Load calendars, holidays, asset-to-market mappings and guardrails into the deployed
 * contracts. Idempotent: it reads current state and only sends what is missing or different.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAddress, stringToHex, type Address, type Hex } from "viem";
import { assetId, toUnitsFloor, type DecString } from "@kerb/types";
import { explorerTx, loadAssets, repoRoot, resolvedAssets, type KerbChainId } from "@kerb/adapters";
import { loadParams, guardrailsFor } from "@kerb/engine";
import { artifact, deploymentOf, walletFor, suffix } from "../src/chain.js";

const chainId = Number(process.argv[2] ?? 1952) as KerbChainId;
const wallet = walletFor(chainId, "KERB_DEPLOYER_KEY");
const clockAddr = deploymentOf(chainId, "KerbClock").address;
const termsAddr = deploymentOf(chainId, "KerbTerms").address;
const clockAbi = artifact("KerbClock").abi;
const termsAbi = artifact("KerbTerms").abi;
const attester = getAddress(process.env["KERB_ATTESTER_ADDRESS"] as Address);

interface OnchainSession { startMin: number; endMin: number; kind: number }
interface OnchainMarket {
  code: string; utcOffsetMin: number; dstRule: number; dstOffsetMin: number;
  coverageFromDay: number; coverageToDay: number; cureWindowSec: number;
  weekly: OnchainSession[][]; overrides: { date: string; day: number; name: string; sessions: OnchainSession[] }[];
}
const cfg = JSON.parse(readFileSync(resolve(repoRoot(), "config/clock-onchain.json"), "utf8")) as {
  alias: Record<string, string>; markets: OnchainMarket[];
};
const assetsCfg = loadAssets();
const params = loadParams();
const code8 = (c: string): Hex => stringToHex(c, { size: 8 });

let sent = 0;
async function send(label: string, to: Address, abi: typeof clockAbi, functionName: string, args: unknown[]): Promise<void> {
  const hash = await wallet.writeContract({
    address: to, abi, functionName, args, chain: wallet.chain, account: wallet.account,
    ...(suffix() ? { dataSuffix: suffix() } : {}),
  });
  const r = await wallet.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (r.status !== "success") throw new Error(`${label} failed: ${explorerTx(chainId, hash)}`);
  sent++;
  console.log(`  ${label}  gas ${r.gasUsed}  ${hash}`);
}

// ---- calendars
for (const m of cfg.markets) {
  const existing = (await wallet.readContract({ address: clockAddr, abi: clockAbi, functionName: "calendar", args: [code8(m.code)] })) as { exists: boolean };
  console.log(`${m.code}: calendar ${existing.exists ? "already set" : "setting"}`);
  if (!existing.exists) {
    await send(`setCalendar ${m.code}`, clockAddr, clockAbi, "setCalendar", [code8(m.code), {
      exists: true, dstRule: m.dstRule, utcOffsetMin: m.utcOffsetMin, dstOffsetMin: m.dstOffsetMin,
      coverageFromDay: m.coverageFromDay, coverageToDay: m.coverageToDay,
    }]);
  }
  for (let dow = 0; dow < 7; dow++) {
    const want = m.weekly[dow] ?? [];
    if (want.length === 0) continue;
    const have = (await wallet.readContract({ address: clockAddr, abi: clockAbi, functionName: "weekly", args: [code8(m.code), dow] })) as unknown[];
    if (have.length === want.length) continue;
    await send(`setWeekly ${m.code} dow ${dow}`, clockAddr, clockAbi, "setWeekly", [code8(m.code), dow, want]);
  }
  for (const o of m.overrides) {
    const [isSet] = (await wallet.readContract({ address: clockAddr, abi: clockAbi, functionName: "dayOverride", args: [code8(m.code), o.day] })) as [boolean, unknown[]];
    if (isSet) continue;
    await send(`override ${m.code} ${o.date} (${o.name})`, clockAddr, clockAbi, "setDayOverride", [code8(m.code), o.day, o.sessions]);
  }
}

// ---- assets: market mapping and guardrails. assetId always refers to the mainnet asset.
for (const a of resolvedAssets(assetsCfg)) {
  const id = assetId(196, a.token.address);
  const market = cfg.alias[a.underlying.market] ?? a.underlying.market;
  const am = (await wallet.readContract({ address: clockAddr, abi: clockAbi, functionName: "assetMarket", args: [id] })) as { exists: boolean };
  const cure = cfg.markets.find((m) => m.code === market)?.cureWindowSec ?? 3600;
  if (!am.exists) await send(`setAssetMarket ${a.symbol} -> ${market}`, clockAddr, clockAbi, "setAssetMarket", [id, code8(market), cure]);

  const g = guardrailsFor(params, a.symbol);
  // Exact decimal -> integer conversion. Never Number(), which cannot represent 250000e18.
  const wad = (x: DecString): bigint => toUnitsFloor(x, 18);
  const units = (x: DecString): bigint => toUnitsFloor(x, 18);
  const have = (await wallet.readContract({ address: termsAddr, abi: termsAbi, functionName: "guardrails", args: [id] })) as { exists: boolean };
  if (!have.exists) {
    await send(`setGuardrails ${a.symbol} (LT ${g.LT})`, termsAddr, termsAbi, "setGuardrails", [id, {
      ltvMin: wad(g.ltvMin), ltvMax: wad(g.ltvMax), ceilingMin: units(g.ceilingMin), ceilingMax: units(g.ceilingMax),
      maxLoosenStepBps: toUnitsFloor(params.asymmetry.maxLoosenStep, 4),
      loosenCooldownSec: params.asymmetry.recoveryCooldownSec, maxReportAgeSec: 900, LT: wad(g.LT), exists: true,
    }]);
  }
}

// ---- attester set on both contracts
for (const [label, addr, abi] of [["clock", clockAddr, clockAbi], ["terms", termsAddr, termsAbi]] as const) {
  const ok = (await wallet.readContract({ address: addr, abi, functionName: "isAttester", args: [attester] })) as boolean;
  if (!ok) await send(`setAttester ${label} ${attester}`, addr, abi, "setAttester", [attester, true]);
}

console.log(`configuration complete: ${sent} transaction(s) sent`);
