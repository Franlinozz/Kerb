/**
 * Credit plane reads the V2 frontend needs: the demo clock as a schedule, and every open position
 * with its covenant status, so a visitor can find a curable position without knowing an address.
 *
 * ABIs are inline fragments, not build artifacts, so this module and its tests run anywhere.
 * Every chain call goes through an injectable reader, and a chain that does not answer is a
 * labelled 502, never a stack trace.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { encodeAbiParameters, keccak256, parseAbi, parseAbiItem, type Address, type Hex } from "viem";
import { publicClient, repoRoot } from "@kerb/adapters";
import { loadDeployments } from "@kerb/attester";

export interface ChainReader {
  readContract(args: { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }): Promise<unknown>;
  getLogs(args: { address: Address; events: readonly unknown[]; fromBlock: bigint; toBlock: bigint }): Promise<{ args: Record<string, unknown>; blockNumber: bigint | null }[]>;
  getBlockNumber(): Promise<bigint>;
}

export const defaultReader = (chainId: number): ChainReader => publicClient(chainId as 196 | 1952) as unknown as ChainReader;

const DEMO_ABI = parseAbi([
  "function weekLength() view returns (uint64)",
  "function sessionEnd() view returns (uint64)",
  "function cureStart() view returns (uint64)",
  "function epoch() view returns (uint64)",
]);

const CREDIT_ABI = parseAbi([
  "function position(address user, bytes32 assetId) view returns ((uint128 collateralShares, uint128 debtShares, uint64 carryTarget, uint8 mode, uint64 lastCureAt))",
  "function debtOf(address user, bytes32 assetId) view returns (uint256)",
  "function positionLTV(address user, bytes32 assetId) view returns (uint256)",
  "function healthFactor(address user, bytes32 assetId) view returns (uint256)",
  "function cureStatus(address user, bytes32 assetId) view returns (bool eligible, uint64 deadline, uint256 requiredRepay)",
]);

const EVENTS = [
  parseAbiItem("event Borrowed(address indexed user, bytes32 indexed assetId, uint256 amount, uint8 mode, uint64 carryTarget)"),
  parseAbiItem("event Repaid(address indexed payer, address indexed user, bytes32 indexed assetId, uint256 amount, uint256 shares)"),
  parseAbiItem("event Cured(address indexed curer, address indexed user, bytes32 indexed assetId, uint256 repaid, uint256 seized, uint64 target)"),
  parseAbiItem("event Liquidated(address indexed liquidator, address indexed user, bytes32 indexed assetId, uint256 repaid, uint256 seized)"),
] as const;

// ---------------------------------------------------------------------------------------------
// Demo clock
// ---------------------------------------------------------------------------------------------

export interface DemoClock {
  address: Address;
  weekLengthSec: number;
  sessionEndSec: number;
  cureStartSec: number;
  epoch: number;
  now: string;
  phaseSec: number;
  state: "SESSION" | "LAST_CALL" | "CLOSED";
  nextCureOpensAt: string;
  nextCureClosesAt: string;
  nextSessionAt: string;
  cycleStartedAt: string;
  label: "Verified";
  note: string;
}

const immutables = new Map<number, { weekLength: number; sessionEnd: number; cureStart: number; epoch: number }>();

export async function buildDemoClock(chainId: number, reader: ChainReader, nowMs: number): Promise<DemoClock | null> {
  const address = loadDeployments()[`${chainId}:KerbClockDemo`]?.address as Address | undefined;
  if (!address) return null;
  let im = immutables.get(chainId);
  if (!im) {
    const read = async (functionName: string): Promise<number> => Number(await reader.readContract({ address, abi: DEMO_ABI, functionName }));
    const [weekLength, sessionEnd, cureStart, epoch] = await Promise.all([read("weekLength"), read("sessionEnd"), read("cureStart"), read("epoch")]);
    im = { weekLength, sessionEnd, cureStart, epoch };
    immutables.set(chainId, im); // immutable onchain, so read once
  }
  return demoSchedule(address, im, nowMs);
}

/** The same arithmetic KerbClockDemo.phase and cureWindowOpen use, from its immutables. */
export function demoSchedule(address: Address, im: { weekLength: number; sessionEnd: number; cureStart: number; epoch: number }, nowMs: number): DemoClock {
  const ts = Math.floor(nowMs / 1000);
  const phase = (((ts - im.epoch) % im.weekLength) + im.weekLength) % im.weekLength;
  const weekStart = ts - phase;
  const state = phase < im.cureStart ? "SESSION" : phase < im.sessionEnd ? "LAST_CALL" : "CLOSED";
  const iso = (s: number): string => new Date(s * 1000).toISOString();
  return {
    address,
    weekLengthSec: im.weekLength,
    sessionEndSec: im.sessionEnd,
    cureStartSec: im.cureStart,
    epoch: im.epoch,
    now: iso(ts),
    phaseSec: phase,
    state,
    nextCureOpensAt: iso(phase < im.cureStart ? weekStart + im.cureStart : weekStart + im.weekLength + im.cureStart),
    nextCureClosesAt: iso(phase < im.sessionEnd ? weekStart + im.sessionEnd : weekStart + im.weekLength + im.sessionEnd),
    nextSessionAt: iso(weekStart + im.weekLength),
    cycleStartedAt: iso(weekStart),
    label: "Verified",
    note: "Demo clock, testnet only: one compressed market week per cycle. Not a real market calendar.",
  };
}

// ---------------------------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------------------------

interface ScanState { cursor: number; pairs: string[]; events: number }
const LOG_SPAN = 100n; // the public X Layer RPC refuses a wider getLogs range
const CONCURRENCY = 8;
const scans = new Map<number, { state: ScanState; running: Promise<void> | null }>();

const scanFile = (chainId: number): string => process.env["KERB_CREDIT_SCAN_FILE"]?.replace("{chain}", String(chainId)) ?? resolve(repoRoot(), `var/credit-scan-${chainId}.json`);

function loadScan(chainId: number, deployBlock: number): ScanState {
  const f = scanFile(chainId);
  if (existsSync(f)) {
    try { return JSON.parse(readFileSync(f, "utf8")) as ScanState; } catch { /* rescan */ }
  }
  return { cursor: deployBlock - 1, pairs: [], events: 0 };
}

/** Scan Borrowed, Repaid, Cured and Liquidated from the deploy block, incrementally, in bounded chunks. */
export async function syncCreditLogs(chainId: number, reader: ChainReader, persist = true): Promise<{ scannedTo: number; head: number; pairs: string[]; events: number }> {
  const dep = loadDeployments()[`${chainId}:KerbCredit`] as { address: Address; deployedAtBlock?: string | number } | undefined;
  if (!dep) throw new Error("no credit market is deployed on this chain");
  let entry = scans.get(chainId);
  if (!entry) { entry = { state: loadScan(chainId, Number(dep.deployedAtBlock ?? 0)), running: null }; scans.set(chainId, entry); }
  const e = entry;
  if (!e.running) {
    e.running = (async () => {
      const head = Number(await reader.getBlockNumber());
      const pairs = new Set(e.state.pairs);
      let from = e.state.cursor + 1;
      while (from <= head) {
        const ranges: [bigint, bigint][] = [];
        for (let i = 0; i < CONCURRENCY && from <= head; i++) {
          const to = Math.min(head, from + Number(LOG_SPAN) - 1);
          ranges.push([BigInt(from), BigInt(to)]);
          from = to + 1;
        }
        const results = await Promise.all(ranges.map(([f, t]) => reader.getLogs({ address: dep.address, events: EVENTS, fromBlock: f, toBlock: t })));
        for (const logs of results) {
          for (const l of logs) {
            const user = l.args["user"] as string | undefined;
            const asset = l.args["assetId"] as string | undefined;
            if (user && asset) pairs.add(`${user.toLowerCase()}|${asset.toLowerCase()}`);
            e.state.events++;
          }
        }
        e.state.cursor = Number((ranges[ranges.length - 1] as [bigint, bigint])[1]);
        e.state.pairs = [...pairs];
        if (persist) {
          const f = scanFile(chainId);
          mkdirSync(dirname(f), { recursive: true });
          writeFileSync(f, JSON.stringify(e.state));
        }
      }
    })().finally(() => { e.running = null; });
  }
  await e.running;
  return { scannedTo: e.state.cursor, head: e.state.cursor, pairs: e.state.pairs, events: e.state.events };
}

export interface OpenPosition {
  user: Address;
  assetId: Hex;
  symbol: string | null;
  mode: "Carry" | "Session Max";
  debt: string;
  positionLTV: string | null;
  carryTarget: string;
  healthFactor: string | null;
  cure: { eligible: boolean; deadline: string | null; requiredRepay: string };
  label: "Verified";
}

export function mirrorSymbols(chainId: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, d] of Object.entries(loadDeployments())) {
    const m = /^(\d+):KerbMirror:(.+)$/.exec(k);
    if (!m || Number(m[1]) !== chainId) continue;
    const id = keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [BigInt(chainId), (d as { address: Address }).address]));
    out.set(id.toLowerCase(), `k${m[2]}`);
  }
  return out;
}

export async function readOpenPositions(chainId: number, reader: ChainReader, pairs: string[]): Promise<OpenPosition[]> {
  const credit = loadDeployments()[`${chainId}:KerbCredit`]?.address as Address | undefined;
  if (!credit) return [];
  const symbols = mirrorSymbols(chainId);
  const read = (functionName: string, args: readonly unknown[]): Promise<unknown> => reader.readContract({ address: credit, abi: CREDIT_ABI, functionName, args });
  const out: OpenPosition[] = [];
  for (const pair of pairs) {
    const [user, assetId] = pair.split("|") as [Address, Hex];
    const debt = (await read("debtOf", [user, assetId])) as bigint;
    if (debt === 0n) continue;
    const [p, status] = await Promise.all([
      read("position", [user, assetId]) as Promise<{ carryTarget: bigint; mode: number }>,
      read("cureStatus", [user, assetId]) as Promise<readonly [boolean, bigint, bigint]>,
    ]);
    let ltv: string | null = null;
    let hf: string | null = null;
    try {
      ltv = ((await read("positionLTV", [user, assetId])) as bigint).toString();
      hf = ((await read("healthFactor", [user, assetId])) as bigint).toString();
    } catch { /* no usable mark: a real answer, reported as null */ }
    out.push({
      user, assetId, symbol: symbols.get(assetId.toLowerCase()) ?? null,
      mode: p.mode === 1 ? "Session Max" : "Carry",
      debt: debt.toString(), positionLTV: ltv, carryTarget: p.carryTarget.toString(), healthFactor: hf,
      cure: { eligible: status[0], deadline: status[1] === 0n ? null : new Date(Number(status[1]) * 1000).toISOString(), requiredRepay: status[2].toString() },
      label: "Verified",
    });
  }
  // Curable first, then the nearest deadline.
  return out.sort((a, b) =>
    Number(b.cure.eligible) - Number(a.cure.eligible)
    || (a.cure.deadline ?? "9999").localeCompare(b.cure.deadline ?? "9999"));
}

/** Tests only: forget what has been read from chain. */
export function resetCreditCaches(): void {
  immutables.clear();
  scans.clear();
}
