import { keccak256, toBytes, type Hex } from "viem";

/**
 * Canonical JSON: sorted keys, no whitespace. bigint serialised as a decimal string.
 * Numbers are rejected outside of safe integers so no float can hide in a hashed payload.
 */
export function canonicalJson(v: unknown): string {
  return JSON.stringify(sortDeep(v));
}

function sortDeep(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("non-finite number in canonical payload");
    return v;
  }
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v !== null && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined) out[k] = sortDeep(x);
    }
    return out;
  }
  return v;
}

export function keccakBytes(b: Uint8Array): Hex {
  return keccak256(b);
}

export function keccakText(s: string): Hex {
  return keccak256(toBytes(s));
}
