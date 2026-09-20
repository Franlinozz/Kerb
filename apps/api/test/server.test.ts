/** API contract tests against an in-memory database stand-in: offline and deterministic. */
import { describe, expect, it, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Sql } from "@kerb/collector/db";
import { BOARD_CACHE_MS, buildServer } from "../src/server.js";
import { assetId, fromUnits } from "@kerb/types";
import { loadAssets, resolvedAssets } from "@kerb/adapters";

const cfg = loadAssets();
const KOX = resolvedAssets(cfg).find((a) => a.symbol === "KOx")!;
const KOX_ID = assetId(196, KOX.token.address);

function fakeSql(overrides: { reports?: Record<string, unknown>[] } = {}): Sql {
  const reports = overrides.reports ?? [{
    asset_id: KOX_ID, symbol: "KOx", observed_at: new Date("2026-09-20T15:00:00Z"), regime: 4,
    credit_mark: "86779048089853339159", carry_ltv: "550000000000000000", session_max_ltv: "600000000000000000",
    debt_ceiling: "11187632812", executable_depth1: "14916843749", inputs_hash: `0x${"ab".repeat(32)}`,
    tx_hash: `0x${"cd".repeat(32)}`, block_number: "1", attester: "0x000000000000000000000000000000000000AaAa",
  }];
  return (async (strings: TemplateStringsArray) => {
    const q = strings.join(" ").replace(/\s+/g, " ");
    if (q.includes("FROM terms_reports")) return reports;
    if (q.includes("FROM obs_pool_state WHERE mode = 'live' ORDER BY pool")) return [{ pool: KOX.pool!.address, ts: new Date("2026-09-20T15:04:30Z") }];
    if (q.includes("count(*) AS pools")) return [{ pools: "16140", last: new Date("2026-09-20T15:04:30Z") }];
    if (q.includes("FROM terms_posts")) return [{ chain_id: 196, n: "44", last: new Date("2026-09-20T15:01:00Z") }];
    if (q.includes("FROM obs_price WHERE mode = 'live' GROUP BY source")) {
      return [{ source: "yahoo:chart:KO", last: new Date("2026-09-20T15:04:50Z") }, { source: "xstocks:price-data", last: new Date("2026-09-20T02:00:00Z") }];
    }
    return [];
  }) as unknown as Sql;
}

const NOW = Date.parse("2026-09-20T15:05:00Z");

describe("API", () => {
  let app: FastifyInstance;
  beforeEach(() => { app = buildServer({ sql: fakeSql(), now: () => NOW }); });

  it("GET /health reports observation freshness", async () => {
    const r = await app.inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.status).toBe("ok");
    expect(b.observations.ageSec).toBe(30);
    expect(b.posts[0]).toMatchObject({ chainId: 196, count: 44 });
  });

  it("GET /v1/board returns every asset with provenance and observation times", async () => {
    const r = await app.inject({ method: "GET", url: "/v1/board?chain=196" });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.rows).toHaveLength(resolvedAssets(cfg).length);
    const kox = b.rows.find((x: { symbol: string }) => x.symbol === "KOx");
    expect(kox.status).toBe("live");
    expect(kox.regime.value).toBe("REFERENCE_CLOSED");
    expect(kox.regime.label).toBe("Attested");
    expect(kox.creditMark.value).toBe("86.779048089853339159");
    // Depth and ceiling are loan-asset units (USDG, 6 decimals), not 1e18.
    expect(kox.executableDepth1.value).toBe("14916.843749");
    expect(kox.debtCeiling.value).toBe("11187.632812");
    expect(kox.reportAgeSec).toBe(300);
    expect(kox.creditMark.inputsHash).toMatch(/^0xabab/);
    for (const row of b.rows) {
      for (const field of ["creditMark", "executableDepth1", "carryLTV", "sessionMaxLTV", "debtCeiling", "coverageRatio"]) {
        expect(row[field].label).toBeTruthy();
      }
    }
  });

  it("marks an asset with no posted report rather than inventing one", async () => {
    const b = (await app.inject({ method: "GET", url: "/v1/board?chain=196" })).json();
    const other = b.rows.find((x: { symbol: string }) => x.symbol === "HKEXCx");
    expect(other.status).toBe("no report");
    expect(other.creditMark.value).toBeNull();
    expect(other.regime.value).toBeNull();
  });

  it("reports an unhealthy source honestly", async () => {
    const b = (await app.inject({ method: "GET", url: "/v1/board?chain=196" })).json();
    const dead = b.sources.find((s: { name: string }) => s.name === "xstocks:price-data");
    expect(dead.healthy).toBe(false);
  });

  it("caches the board for 15 seconds", async () => {
    let t = NOW;
    const a = buildServer({ sql: fakeSql(), now: () => t });
    expect((await a.inject({ method: "GET", url: "/v1/board" })).headers["x-kerb-cache"]).toBe("miss");
    expect((await a.inject({ method: "GET", url: "/v1/board" })).headers["x-kerb-cache"]).toBe("hit");
    t += BOARD_CACHE_MS + 1;
    expect((await a.inject({ method: "GET", url: "/v1/board" })).headers["x-kerb-cache"]).toBe("miss");
  });

  it("GET /v1/terms resolves a symbol, a token address and an assetId", async () => {
    for (const key of ["KOx", KOX.token.address, KOX_ID]) {
      const r = await app.inject({ method: "GET", url: `/v1/terms/196/${key}` });
      expect(r.statusCode, key).toBe(200);
      expect(r.json().symbol).toBe("KOx");
    }
  });

  it("GET /v1/terms says usable=false once the report passes the freshness window", async () => {
    const stale = buildServer({ sql: fakeSql(), now: () => NOW + 1_000_000 });
    const b = (await stale.inject({ method: "GET", url: "/v1/terms/196/KOx" })).json();
    expect(b.usable).toBe(false);
  });

  it("404s an unknown asset and a bad chain", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/terms/196/NOPEx" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/v1/terms/abc/KOx" })).statusCode).toBe(400);
  });

  it("refuses path traversal on reports and bundles", async () => {
    for (const bad of ["../../etc/passwd", "..%2f..%2fetc%2fpasswd", "a/b"]) {
      const r = await app.inject({ method: "GET", url: `/v1/reports/${bad}` });
      expect([400, 404]).toContain(r.statusCode);
    }
  });

  it("serves CORS headers for reads", async () => {
    const r = await app.inject({ method: "GET", url: "/v1/board", headers: { origin: "https://usekerb.xyz" } });
    expect(r.headers["access-control-allow-origin"]).toBeTruthy();
  });

  it("never leaks internals in an error payload", async () => {
    const broken = buildServer({ sql: (async () => { throw new Error("connection string postgres://kerb:secret@host/db"); }) as unknown as Sql, now: () => NOW });
    const r = await broken.inject({ method: "GET", url: "/v1/board" });
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toContain("secret");
    expect(r.json()).toEqual({ error: "internal error" });
  });

  it("formats raw values consistently with the decimals it declares", () => {
    expect(fromUnits(14916843749n, 6)).toBe("14916.843749");
  });
});
