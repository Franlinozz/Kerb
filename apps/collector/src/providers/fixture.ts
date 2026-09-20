/**
 * Fake providers: replay real responses captured once by scripts/capture-fixtures.ts
 * and committed under data/fixtures/. Default mode in dev. Rows written in this mode are
 * tagged mode='fixture' and their sources are prefixed 'fixture:' so they can never be
 * mistaken for live observations.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot, type AssetConfig, type HttpFetcher, type PoolRef, type PoolSnapshot, type RawHttp } from "@kerb/adapters";
import type { PublicClient } from "viem";
import { httpProviders } from "./live.js";
import type { OnchainMultiplier, Providers } from "./types.js";

export function fixturesDir(): string {
  return process.env["KERB_FIXTURES_DIR"] ?? resolve(repoRoot(), "data/fixtures/collector");
}

export function fixtureKey(url: string): string {
  const u = new URL(url);
  return `${u.hostname}${u.pathname}${u.search}`.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 180);
}

function readJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`fixture missing: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

class FixtureHttp implements HttpFetcher {
  async get(url: string): Promise<RawHttp> {
    const rec = readJson<RawHttp>(resolve(fixturesDir(), "http", `${fixtureKey(url)}.json`));
    return { ...rec, fetchedAt: new Date().toISOString() };
  }
}

export function fixtureProviders(): Providers {
  const dir = fixturesDir();
  const base = httpProviders(new FixtureHttp(), undefined as unknown as PublicClient, "fixture");
  return {
    ...base,
    okxQuote: base.okxQuote,
    blockNumber: async () => BigInt(readJson<{ blockNumber: string }>(resolve(dir, "block.json")).blockNumber),
    poolSnapshot: async (pool: PoolRef) => readJson<PoolSnapshot>(resolve(dir, "pools", `${pool.address}.json`)),
    onchainMultiplier: async (a: AssetConfig) => readJson<OnchainMultiplier>(resolve(dir, "onchain", `${a.token.address}.json`)),
  };
}
