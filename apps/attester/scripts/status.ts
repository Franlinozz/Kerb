/** Onchain status: deployments, calendar load, per-asset config, and a live clock spot check. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatEther, stringToHex, type Address, type Hex } from "viem";
import { assetId, fromUnits, regimeName, type MarketCode } from "@kerb/types";
import { explorerAddress, loadAssets, publicClient, repoRoot, resolvedAssets, type KerbChainId } from "@kerb/adapters";
import { resolveClock } from "@kerb/calendar";
import { artifact, deploymentOf } from "../src/chain.js";

const chainId = Number(process.argv[2] ?? 1952) as KerbChainId;
const client = publicClient(chainId);
const clock = deploymentOf(chainId, "KerbClock");
const terms = deploymentOf(chainId, "KerbTerms");
const clockAbi = artifact("KerbClock").abi;
const termsAbi = artifact("KerbTerms").abi;
const code8 = (c: string): Hex => stringToHex(c, { size: 8 });
const cfg = JSON.parse(readFileSync(resolve(repoRoot(), "config/clock-onchain.json"), "utf8")) as {
  alias: Record<string, string>; markets: { code: string; overrides: { day: number; date: string }[]; weekly: unknown[][] }[];
};
const assets = loadAssets();
const now = BigInt(Math.floor(Date.now() / 1000));

console.log(`chain ${chainId}`);
console.log(`KerbClock ${clock.address}  block ${clock.deployedAtBlock}  ${explorerAddress(chainId, clock.address)}`);
console.log(`KerbTerms ${terms.address}  block ${terms.deployedAtBlock}  ${explorerAddress(chainId, terms.address)}`);

for (const m of cfg.markets) {
  const cal = (await client.readContract({ address: clock.address, abi: clockAbi, functionName: "calendar", args: [code8(m.code)] })) as { exists: boolean; coverageFromDay: number; coverageToDay: number };
  let loaded = 0;
  for (const o of m.overrides) {
    const [isSet] = (await client.readContract({ address: clock.address, abi: clockAbi, functionName: "dayOverride", args: [code8(m.code), o.day] })) as [boolean, unknown[]];
    if (isSet) loaded++;
  }
  let weekly = 0;
  for (let d = 0; d < 7; d++) {
    const w = (await client.readContract({ address: clock.address, abi: clockAbi, functionName: "weekly", args: [code8(m.code), d] })) as unknown[];
    weekly += w.length;
  }
  console.log(`${m.code}: calendar=${cal.exists} coverage ${cal.coverageFromDay}..${cal.coverageToDay} weekly ${weekly} rows, overrides ${loaded}/${m.overrides.length}`);
}

console.log("\nasset                 market  cure   LT     onchain session  TS session  next transition (onchain == TS)");
for (const a of resolvedAssets(assets)) {
  const id = assetId(196, a.token.address);
  const am = (await client.readContract({ address: clock.address, abi: clockAbi, functionName: "assetMarket", args: [id] })) as { marketCode: Hex; cureWindowSec: number; exists: boolean };
  const g = (await client.readContract({ address: terms.address, abi: termsAbi, functionName: "guardrails", args: [id] })) as { LT: bigint; exists: boolean };
  const [kind] = (await client.readContract({ address: clock.address, abi: clockAbi, functionName: "sessionAt", args: [id, now] })) as [number, bigint, bigint];
  const [, at] = (await client.readContract({ address: clock.address, abi: clockAbi, functionName: "nextTransition", args: [id, now] })) as [number, bigint];
  const ts = resolveClock({ market: (cfg.alias[a.underlying.market] ?? a.underlying.market) as MarketCode, atMs: Number(now) * 1000, cureWindowSec: am.cureWindowSec });
  const KINDS = ["CLOSED", "LUNCH", "PRE", "POST", "REGULAR"];
  const match = Number(at) * 1000 === Date.parse(ts.nextTransition.at) && KINDS[kind] === ts.session.kind;
  console.log(
    `${a.symbol.padEnd(8)} ${a.underlying.market.padEnd(6)} -> ${(am.exists ? String(am.marketCode).slice(0, 10) : "MISSING").padEnd(6)} ${String(am.cureWindowSec).padStart(5)}s ${g.exists ? fromUnits(g.LT, 18) : "-"}   ${(KINDS[kind] ?? "?").padEnd(9)} ${ts.session.kind.padEnd(10)} ${new Date(Number(at) * 1000).toISOString()} ${match ? "OK" : "MISMATCH"}`,
  );
}

const attester = process.env["KERB_ATTESTER_ADDRESS"] as Address;
const poster = process.env["KERB_POSTER_ADDRESS"] as Address;
for (const [label, addr, abi] of [["clock", clock.address, clockAbi], ["terms", terms.address, termsAbi]] as const) {
  console.log(`\nattester enabled on ${label}: ${await client.readContract({ address: addr, abi, functionName: "isAttester", args: [attester] })}`);
}
console.log(`poster ${poster} balance ${formatEther(await client.getBalance({ address: poster }))} OKB`);
void regimeName;
