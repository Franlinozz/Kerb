/**
 * Reads the internal Kerb API (127.0.0.1:8720) and nothing else: no chain, no keys. The report
 * behind an answer is recomputed from the posted input bundle, verified against its inputsHash
 * exactly as `kerb verify` does, and cached by that hash, so it is the report of the posted
 * terms, never of a newer live observation.
 */
import { computeReport, engineConfigFromBundle, type InputBundle, type Report } from "@kerb/engine";
import { keccakText } from "@kerb/types";
import { loadAssets, resolvedAssets } from "@kerb/adapters";
import type { AssetRef, BoardFields, PostedTerms } from "./compute.js";

export class UpstreamError extends Error {}

/** The report of a posted bundle: its bytes must hash to the posted inputsHash, as in `kerb verify`. */
export function reportFromBundle(text: string, inputsHash: string): Report {
  if (keccakText(text).toLowerCase() !== inputsHash.toLowerCase()) throw new UpstreamError("the bundle bytes do not hash to the posted inputsHash");
  const bundle = JSON.parse(text) as InputBundle;
  return computeReport(bundle, engineConfigFromBundle(bundle));
}

export interface Upstream {
  assets(): AssetRef[];
  terms(symbol: string): Promise<PostedTerms>;
  boardRow(symbol: string): Promise<BoardFields & { symbol: string }>;
  board(): Promise<{ generatedAt: string; rows: (BoardFields & Record<string, unknown> & { symbol: string })[] }>;
  report(inputsHash: string): Promise<Report>;
  json<T>(path: string, ttlMs?: number): Promise<T>;
}

export function httpUpstream(base = process.env["KERB_API_INTERNAL"] ?? "http://127.0.0.1:8720"): Upstream {
  const cache = new Map<string, { at: number; v: unknown }>();
  const reports = new Map<string, Report>();
  async function json<T>(path: string, ttlMs = 10_000): Promise<T> {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
    let r: Response;
    try { r = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(8_000) }); } catch { throw new UpstreamError("the Kerb API did not answer"); }
    if (!r.ok) throw new UpstreamError(`the Kerb API answered ${r.status} for ${path.split("?")[0]}`);
    const v = (await r.json()) as T;
    cache.set(path, { at: Date.now(), v });
    if (cache.size > 200) cache.clear();
    return v;
  }
  // The Credit Mark prices the token that trades in the pools: the xStocks wrapper where there is one.
  const refs = resolvedAssets(loadAssets()).map((a) => {
    const t = a.poolToken === "wrapper" && a.wrapper ? a.wrapper : a.token;
    return { symbol: a.symbol, token: t.address, tokenDecimals: t.decimals, assetId: "" };
  });
  let withIds: AssetRef[] | null = null;
  return {
    assets: () => withIds ?? refs,
    async terms(symbol) {
      const t = await json<PostedTerms>(`/v1/terms/196/${encodeURIComponent(symbol)}`);
      // Learn the assetId from the posted terms, so an agent may ask by it.
      if (!withIds || !withIds.some((a) => a.symbol === t.symbol && a.assetId)) withIds = (withIds ?? refs).map((a) => (a.symbol === t.symbol ? { ...a, assetId: t.assetId } : a));
      return t;
    },
    async board() { return json(`/v1/board?chain=196`, 15_000); },
    async boardRow(symbol) {
      const b = await this.board();
      const row = b.rows.find((r) => r.symbol === symbol);
      if (!row) throw new UpstreamError(`the Board has no row for ${symbol}`);
      return row;
    },
    async report(inputsHash) {
      const key = inputsHash.toLowerCase();
      const hit = reports.get(key);
      if (hit) return hit;
      let text: string;
      try {
        const r = await fetch(`${base}/v1/bundle/${key}`, { signal: AbortSignal.timeout(8_000) });
        if (!r.ok) throw new UpstreamError(`the posted bundle ${key.slice(0, 10)} is not retrievable (${r.status})`);
        text = await r.text();
      } catch (e) { throw e instanceof UpstreamError ? e : new UpstreamError("the Kerb API did not answer"); }
      const report = reportFromBundle(text, key);
      reports.set(key, report);
      if (reports.size > 100) reports.delete(reports.keys().next().value as string);
      return report;
    },
    json,
  };
}
