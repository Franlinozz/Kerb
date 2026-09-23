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
  getLogs(args: { address: Address; events: readonly unknown[]; fromBlock: bigint; toBlock: bigint }): Promise<{ args: Record<string, unknown>; blockNumber: bigint | null; transactionHash?: string | null; eventName?: string }[]>;
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
  // V3 profile: the rest of an address's own history in the market.
  parseAbiItem("event Supplied(address indexed user, uint256 assets, uint256 shares)"),
  parseAbiItem("event Withdrawn(address indexed user, uint256 assets, uint256 shares)"),
  parseAbiItem("event CollateralDeposited(address indexed user, bytes32 indexed assetId, uint256 amount)"),
  parseAbiItem("event CollateralWithdrawn(address indexed user, bytes32 indexed assetId, uint256 amount)"),
] as const;

/** One event in an address's history, from its own point of view. */
export interface Activity { kind: string; role: "self" | "by-other" | "for-other"; assetId: string | null; amount: string | null; other: string | null; block: number; tx: string | null }
const ACTIVITY_CAP = 300;

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

export interface LastCure { tx: string | null; block: number; repaid: string; seized: string; target: string; curer: string }
interface ScanState { v?: number; cursor: number; pairs: string[]; events: number; cures?: Record<string, LastCure>; borrows?: number; cureCount?: number; lastCure?: LastCure | null; activity?: Record<string, Activity[]> }
/** Bumped when the scan starts counting something new: an older cache is rescanned from the deploy block. */
const SCAN_VERSION = 3;
const LOG_SPAN = 100n; // the public X Layer RPC refuses a wider getLogs range
const CONCURRENCY = 8;
const scans = new Map<number, { state: ScanState; running: Promise<void> | null }>();

const scanFile = (chainId: number): string => process.env["KERB_CREDIT_SCAN_FILE"]?.replace("{chain}", String(chainId)) ?? resolve(repoRoot(), `var/credit-scan-${chainId}.json`);

function loadScan(chainId: number, deployBlock: number, persist: boolean): ScanState {
  const f = scanFile(chainId);
  // A non-persisting scan (tests, a custom reader) never reads a file another process wrote.
  if (persist && existsSync(f)) {
    try { const st = JSON.parse(readFileSync(f, "utf8")) as ScanState; if (st.v === SCAN_VERSION) return st; } catch { /* rescan */ }
  }
  return { v: SCAN_VERSION, cursor: deployBlock - 1, pairs: [], events: 0, borrows: 0, cureCount: 0, lastCure: null };
}

/** Scan Borrowed, Repaid, Cured and Liquidated from the deploy block, incrementally, in bounded chunks. */
export async function syncCreditLogs(chainId: number, reader: ChainReader, persist = true): Promise<{ scannedTo: number; head: number; pairs: string[]; events: number; cures: Record<string, LastCure>; activity: { borrows: number; cures: number; lastCure: LastCure | null }; byAddress: Record<string, Activity[]> }> {
  const dep = loadDeployments()[`${chainId}:KerbCredit`] as { address: Address; deployedAtBlock?: string | number } | undefined;
  if (!dep) throw new Error("no credit market is deployed on this chain");
  let entry = scans.get(chainId);
  if (!entry) { entry = { state: loadScan(chainId, Number(dep.deployedAtBlock ?? 0), persist), running: null }; scans.set(chainId, entry); }
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
            if (l.eventName === "Borrowed") e.state.borrows = (e.state.borrows ?? 0) + 1;
            {
              // Per-address history for the profile (V3): each party sees the event from its side.
              const a = l.args;
              const add = (who: unknown, act: Omit<Activity, "block" | "tx">): void => {
                if (typeof who !== "string") return;
                e.state.activity ??= {};
                const k = who.toLowerCase();
                const list = (e.state.activity[k] ??= []);
                list.push({ ...act, block: Number(l.blockNumber ?? 0n), tx: l.transactionHash ?? null });
                if (list.length > ACTIVITY_CAP) list.shift();
              };
              const asset = (a["assetId"] as string | undefined) ?? null;
              const n = (x: unknown): string | null => (x === undefined ? null : String(x));
              switch (l.eventName) {
                case "Supplied": case "Withdrawn": add(a["user"], { kind: l.eventName, role: "self", assetId: null, amount: n(a["assets"]), other: null }); break;
                case "CollateralDeposited": case "CollateralWithdrawn": case "Borrowed": add(a["user"], { kind: l.eventName, role: "self", assetId: asset, amount: n(a["amount"]), other: null }); break;
                case "Repaid": {
                  const self = String(a["payer"]).toLowerCase() === String(a["user"]).toLowerCase();
                  add(a["user"], { kind: "Repaid", role: self ? "self" : "by-other", assetId: asset, amount: n(a["amount"]), other: self ? null : String(a["payer"]) });
                  if (!self) add(a["payer"], { kind: "Repaid", role: "for-other", assetId: asset, amount: n(a["amount"]), other: String(a["user"]) });
                  break;
                }
                case "Cured": add(a["user"], { kind: "Cured", role: "by-other", assetId: asset, amount: n(a["repaid"]), other: String(a["curer"]) }); add(a["curer"], { kind: "Cured", role: "for-other", assetId: asset, amount: n(a["repaid"]), other: String(a["user"]) }); break;
                case "Liquidated": add(a["user"], { kind: "Liquidated", role: "by-other", assetId: asset, amount: n(a["repaid"]), other: String(a["liquidator"]) }); add(a["liquidator"], { kind: "Liquidated", role: "for-other", assetId: asset, amount: n(a["repaid"]), other: String(a["user"]) }); break;
              }
            }
            if (user && asset && l.eventName === "Cured") {
              e.state.cures ??= {};
              const cure = {
                tx: l.transactionHash ?? null, block: Number(l.blockNumber ?? 0n),
                repaid: String(l.args["repaid"] ?? "0"), seized: String(l.args["seized"] ?? "0"),
                target: String(l.args["target"] ?? "0"), curer: String(l.args["curer"] ?? ""),
              };
              e.state.cures[`${user.toLowerCase()}|${asset.toLowerCase()}`] = cure;
              e.state.cureCount = (e.state.cureCount ?? 0) + 1;
              if (!e.state.lastCure || cure.block >= e.state.lastCure.block) e.state.lastCure = cure;
            }
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
  return { scannedTo: e.state.cursor, head: e.state.cursor, pairs: e.state.pairs, events: e.state.events, cures: e.state.cures ?? {}, activity: { borrows: e.state.borrows ?? 0, cures: e.state.cureCount ?? 0, lastCure: e.state.lastCure ?? null }, byAddress: e.state.activity ?? {} };
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
  /** The most recent cure of this position, from the Cured events; null if never cured. */
  lastCure: LastCure | null;
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

export async function readOpenPositions(chainId: number, reader: ChainReader, pairs: string[], cures: Record<string, LastCure> = {}, includeClosed = false): Promise<OpenPosition[]> {
  const credit = loadDeployments()[`${chainId}:KerbCredit`]?.address as Address | undefined;
  if (!credit) return [];
  const symbols = mirrorSymbols(chainId);
  const read = (functionName: string, args: readonly unknown[]): Promise<unknown> => reader.readContract({ address: credit, abi: CREDIT_ABI, functionName, args });
  const out: OpenPosition[] = [];
  for (const pair of pairs) {
    const [user, assetId] = pair.split("|") as [Address, Hex];
    const debt = (await read("debtOf", [user, assetId])) as bigint;
    if (debt === 0n && !includeClosed) continue;
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
      lastCure: cures[pair] ?? null,
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
