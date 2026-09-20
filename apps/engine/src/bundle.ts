/**
 * KTS-0.1 section 10: the input bundle. Canonical JSON (sorted keys, no whitespace, decimal
 * strings), keccak256 for the onchain inputsHash, plus a deterministic IPFS CIDv1 computed
 * locally so the identifier exists whether or not a pinning service is reachable.
 */
import { createHash } from "node:crypto";
import { canonicalJson, keccakText, type DecString } from "@kerb/types";
import type { PoolSnapshot } from "@kerb/adapters";
import type { DailyBar } from "./stress.js";

export interface BundleAsset {
  chainId: number;
  symbol: string;
  token: string;
  decimals: number;
  wrapper: { address: string; version: string; symbol: string; decimals: number; assetsPerShare: DecString } | null;
  poolToken: "token" | "wrapper";
  underlying: { symbol: string; isin: string; currency: string; listingCountry: string; market: string };
  corporateActionMethod: string;
  multiplier: { onchain: DecString; issuer: DecString | null; pending: { value: DecString; activatesAtMs: number } | null };
  halted: { adapter: boolean; underlying: boolean };
}

export interface BundleVenue {
  pool: string;
  quote: string;
  /** ["wKOx","USDG"]: what is sold into this pool and what comes out. */
  path: string[];
  /** Address of the token sold in this leg. Stated, never inferred. */
  sellToken: string;
  /** Order of this leg within its path, 0-based. */
  legIndex: number;
  /** Identifies the path this leg belongs to (the first leg's pool). Legs never regroup by symbol. */
  pathId: string;
  observedAtMs: number;
  contentHash: string;
  snapshot: PoolSnapshot;
  decimals0: number;
  decimals1: number;
}

export interface BundleStress {
  /** keccak256 of the canonical bar series. The series itself is not redistributed (data/SOURCES.md). */
  seriesDigest: string;
  source: string;
  bars: number;
  firstDate: string | null;
  lastDate: string | null;
  historySufficient: boolean;
  /** Gap quantile by number of underlying sessions in the horizon. */
  gapQuantileBySessions: Record<string, { value: DecString; sampleSize: number; source: string }>;
  volScaler: { value: DecString; source: string; recentVol: DecString; medianVol: DecString; clamped: boolean; sampleSize: number };
}

export interface InputBundle {
  kts: "0.1";
  bundleVersion: 1;
  engineVersion: string;
  paramsVersion: string;
  calendarVersion: string;
  /** Time is an input. The engine never reads a clock. */
  observedAtMs: number;
  asset: BundleAsset;
  market: { code: string; cureWindowSec: number };
  references: { source: string; value: DecString; currency: string; observedAtMs: number; contentHash: string }[];
  fx: { source: string; currency: string; perUsd: DecString; observedAtMs: number; contentHash: string }[];
  venues: BundleVenue[];
  routes: { from: string; to: string; pool: string }[];
  quotes: { source: string; notional: DecString; quoteOut: DecString; observedAtMs: number; contentHash: string }[];
  stress: BundleStress;
  previous: {
    observedAtMs: number; regime: number; carryLTV: DecString; sessionMaxLTV: DecString; debtCeiling: DecString;
    loosenConfirmations: number; lastLoosenAtMs: number | null;
  } | null;
  config: Record<string, unknown>;
}

export interface BundleIdentity {
  canonical: string;
  bytes: number;
  /** keccak256 of the canonical bytes: this is what goes onchain. */
  inputsHash: `0x${string}`;
  /** IPFS CIDv1, raw codec, sha2-256, computed locally and deterministically. */
  cidV1Raw: string;
}

const B32 = "abcdefghijklmnopqrstuvwxyz234567";

export function base32Lower(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/** CIDv1, raw codec (0x55), sha2-256 (0x12, 32 bytes), base32 multibase prefix "b". */
export function cidV1Raw(bytes: Buffer): string {
  const digest = createHash("sha256").update(bytes).digest();
  return `b${base32Lower(Uint8Array.from([0x01, 0x55, 0x12, 0x20, ...digest]))}`;
}

export function identifyBundle(bundle: InputBundle): BundleIdentity {
  const canonical = canonicalJson(bundle);
  const bytes = Buffer.from(canonical, "utf8");
  return { canonical, bytes: bytes.length, inputsHash: keccakText(canonical), cidV1Raw: cidV1Raw(bytes) };
}

export function seriesOf(bars: DailyBar[]): DailyBar[] {
  return bars.map((b) => ({ date: b.date, open: b.open, close: b.close }));
}
