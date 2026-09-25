/** API contract tests against an in-memory database stand-in: offline and deterministic. */
import { describe, expect, it, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Sql } from "@kerb/collector/db";
import { BOARD_CACHE_MS, buildServer } from "../src/server.js";
import { resetCreditCaches, type ChainReader } from "../src/v2credit.js";
import { loadDeployments } from "@kerb/attester";
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
    if (q.includes("floor(extract(epoch FROM observed_at) / 1800)")) {
      return [
        { asset_id: KOX_ID, observed_at: new Date("2026-09-20T14:00:00Z"), executable_depth1: "14000000000", regime: 4 },
        { asset_id: KOX_ID, observed_at: new Date("2026-09-20T14:30:00Z"), executable_depth1: "14916843749", regime: 4 },
      ];
    }
    if (q.includes("FROM terms_reports")) return reports;
    if (q.includes("FROM terms_posts ORDER BY ts DESC LIMIT")) {
      return [{ symbol: "KOx", chain_id: 196, regime: 1, executable_depth1: "14916843749", carry_ltv: "556041938054855748", session_max_ltv: "612000000000000000", tx_hash: `0x${"ef".repeat(32)}`, observed_at: new Date("2026-09-20T15:00:00Z") }];
    }
    if (q.includes("(SELECT count(*) FROM obs_pool_state) AS pool")) return [{ pool: "100", price: "200", quote: "30", mult: "4" }];
    if (q.includes("FROM terms_posts GROUP BY chain_id ORDER BY chain_id") && q.includes("AS n FROM")) return [{ chain_id: 196, n: "44", last: new Date("2026-09-20T15:01:00Z") }];
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

const DEPLOY = loadDeployments();
const CREDIT_BLOCK = BigInt(String((DEPLOY["1952:KerbCredit"] as { deployedAtBlock: string }).deployedAtBlock));
const MIRROR_ID = "0x254b3d27" + "0".repeat(56);
const BORROWER = "0x00000000000000000000000000000000000000b1";

/** A chain that answers like the testnet does, from fixed values. */
function fakeReader(): ChainReader {
  return {
    async readContract({ functionName }) {
      switch (functionName) {
        case "weekLength": return 3600n;
        case "sessionEnd": return 3000n;
        case "cureStart": return 2400n;
        case "epoch": return 1789942438n;
        case "guardrails": return { LT: 650000000000000000n, exists: true };
        case "debtOf": return 2000000000n;
        case "position": return { collateralShares: 1n, debtShares: 1n, carryTarget: 550000000000000000n, mode: 1, lastCureAt: 0n };
        case "cureStatus": return [true, 1790000000n, 123000000n] as const;
        case "positionLTV": return 600000000000000000n;
        case "healthFactor": return 1080000000000000000n;
        default: throw new Error(`unexpected read ${functionName}`);
      }
    },
    async getLogs({ fromBlock }) {
      return fromBlock === CREDIT_BLOCK ? [{ args: { user: BORROWER, assetId: MIRROR_ID }, blockNumber: CREDIT_BLOCK }] : [];
    },
    async getBlockNumber() { return CREDIT_BLOCK + 250n; },
  };
}

/** A chain that does not answer, with the kind of detail that must never reach a client. */
const deadReader = (): ChainReader => {
  const fail = async (): Promise<never> => { throw new Error("HTTP request failed. URL: https://secret-rpc.example/key123 Details: socket hang up"); };
  return { readContract: fail, getLogs: fail, getBlockNumber: fail };
};

describe("API", () => {
  let app: FastifyInstance;
  beforeEach(() => { resetCreditCaches(); app = buildServer({ sql: fakeSql(), now: () => NOW, reader: () => fakeReader() }); });

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


  it("declares loan-asset decimals for depth and ceilings, not WAD", async () => {
    // These are posted in loan-asset units. Declaring 18 here would be a 1e12 error in every
    // SDK consumer: the board says 11,187.63 and /v1/terms must agree with it.
    const r = await app.inject({ method: "GET", url: "/v1/terms/196/KOx" });
    const body = r.json() as {
      debtCeiling: { raw: string; decimals: number };
      executableDepth1: { raw: string; decimals: number };
      creditMark: { decimals: number };
      loanAsset: { symbol: string; decimals: number };
    };
    expect(body.loanAsset.decimals).toBe(6);
    expect(body.debtCeiling.decimals).toBe(6);
    expect(body.executableDepth1.decimals).toBe(6);
    // The mark and the ratios stay WAD.
    expect(body.creditMark.decimals).toBe(18);
    expect(fromUnits(BigInt(body.debtCeiling.raw), body.debtCeiling.decimals)).toBe("11187.632812");

    const board = await app.inject({ method: "GET", url: "/v1/board?chain=196" });
    const row = (board.json() as { rows: { symbol: string; debtCeiling: { value: string } }[] }).rows
      .find((x) => x.symbol === "KOx");
    expect(row?.debtCeiling.value).toBe(fromUnits(BigInt(body.debtCeiling.raw), body.debtCeiling.decimals));
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

describe("proof verification label", async () => {
  const { verificationLabel } = await import("../src/proof.js");
  const deployments = (await import("../../../config/deployments.json", { with: { type: "json" } })).default as Record<string, { verification?: { service: string; match: string } }>;

  it("names the service and the match, and never answers a bare no", () => {
    expect(verificationLabel({ service: "sourcify", match: "exact_match" })).toBe("Sourcify exact match");
    expect(verificationLabel({ service: "sourcify", match: "partial_match" })).toBe("Sourcify partial match");
    expect(verificationLabel(undefined)).toBe("Source in repo, verification pending");
  });

  it("labels every deployment Kerb has made", () => {
    for (const d of Object.values(deployments)) {
      const label = verificationLabel(d.verification);
      expect(label).not.toBe("no");
      expect(label.length).toBeGreaterThan(3);
    }
  });
});

describe("V2 API additions (V2-02)", () => {
  let app: FastifyInstance;
  beforeEach(() => { resetCreditCaches(); app = buildServer({ sql: fakeSql(), now: () => NOW, reader: () => fakeReader() }); });

  it("board rows carry the fixed LT, market, next transition, Last Call, spark and a summary", async () => {
    const b = (await app.inject({ method: "GET", url: "/v1/board?chain=196" })).json();
    const kox = b.rows.find((x: { symbol: string }) => x.symbol === "KOx");
    expect(kox.lt).toMatchObject({ value: "0.65", label: "Verified" });
    expect(kox.market).toMatchObject({ code: "XNYS", city: "New York", tz: "America/New_York" });
    expect(kox.next.label).toBe("Computed");
    expect(typeof kox.cure.open).toBe("boolean");
    expect(kox.spark.map((p: { c1: string }) => p.c1)).toEqual(["14000", "14916.843749"]);
    expect(b.summary).toMatchObject({ c1Total: "14916.843749", ceilingTotal: "11187.632812", label: "Computed" });
    expect(b.summary.sourcesTotal).toBeGreaterThan(0);
  });

  it("board LT is null, not invented, when the chain does not answer", async () => {
    const dead = buildServer({ sql: fakeSql(), now: () => NOW, reader: deadReader });
    const b = (await dead.inject({ method: "GET", url: "/v1/board?chain=1952" })).json();
    expect(b.rows[0].lt.value).toBeNull();
  });

  it("GET /v1/tape lists the newest posts with explorer links", async () => {
    const b = (await app.inject({ method: "GET", url: "/v1/tape?limit=5" })).json();
    expect(b.label).toBe("Attested");
    expect(b.posts[0]).toMatchObject({ symbol: "KOx", chainId: 196, regime: "NORMAL", c1: "14916.843749", carryLTV: "0.556041938054855748" });
    expect(b.posts[0].explorer).toContain("/tx/0x");
  });

  it("GET /v1/stats counts observations and names the latest report", async () => {
    const b = (await app.inject({ method: "GET", url: "/v1/stats" })).json();
    expect(b).toMatchObject({ obsPoolRows: 100, obsTotalRows: 334, assets: resolvedAssets(cfg).length, label: "Observed" });
    expect(b.postsByChain[0]).toMatchObject({ chainId: 196, count: 44 });
    expect(b.latestReport?.id).toBe("2"); // Report #2 published 24 Sep
  });

  it("GET /v1/credit/1952/demo-clock returns the compressed schedule", async () => {
    const r = await app.inject({ method: "GET", url: "/v1/credit/1952/demo-clock" });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    const phase = (((Math.floor(NOW / 1000) - 1789942438) % 3600) + 3600) % 3600;
    expect(b.phaseSec).toBe(phase);
    expect(b.state).toBe(phase < 2400 ? "SESSION" : phase < 3000 ? "LAST_CALL" : "CLOSED");
    expect(Date.parse(b.nextCureClosesAt) - Date.parse(b.nextCureOpensAt)).toBe(600_000);
  });

  it("demo-clock: a chain without one is a 404, a dead RPC a labelled 502 with no detail", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/credit/196/demo-clock" })).statusCode).toBe(404);
    const dead = buildServer({ sql: fakeSql(), now: () => NOW, reader: deadReader });
    const r = await dead.inject({ method: "GET", url: "/v1/credit/1952/demo-clock" });
    expect(r.statusCode).toBe(502);
    expect(r.json().label).toBe("Unavailable");
    expect(r.body).not.toContain("secret-rpc");
  });

  it("GET /v1/credit/1952/positions finds positions from events, curable first", async () => {
    const b = (await app.inject({ method: "GET", url: "/v1/credit/1952/positions?state=curable" })).json();
    expect(b.positions).toHaveLength(1);
    expect(b.positions[0]).toMatchObject({ user: BORROWER, mode: "Session Max", debt: "2000000000", cure: { eligible: true, requiredRepay: "123000000" } });
    expect(b.scannedToBlock).toBe(Number(CREDIT_BLOCK + 250n));
  });

  it("positions: one client past 60 requests a minute gets 429 with a plain reason", async () => {
    const limited = buildServer({ sql: fakeSql(), now: () => NOW, reader: deadReader });
    const hit = () => limited.inject({ method: "GET", url: "/v1/credit/1952/positions?state=nope", headers: { "x-forwarded-for": "203.0.113.7" } });
    for (let i = 0; i < 60; i++) expect((await hit()).statusCode).toBe(400);
    const r = await hit();
    expect(r.statusCode).toBe(429);
    expect(r.headers["retry-after"]).toBe("60");
    expect(r.json().error).toMatch(/too many requests/);
    const other = await limited.inject({ method: "GET", url: "/v1/credit/1952/positions?state=nope", headers: { "x-forwarded-for": "198.51.100.2" } });
    expect(other.statusCode).toBe(400);
  });

  it("positions: bad state 400, no market 404, dead RPC labelled 502", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/credit/1952/positions?state=nope" })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/v1/credit/196/positions" })).statusCode).toBe(404);
    resetCreditCaches();
    const dead = buildServer({ sql: fakeSql(), now: () => NOW, reader: deadReader });
    const r = await dead.inject({ method: "GET", url: "/v1/credit/1952/positions" });
    expect(r.statusCode).toBe(502);
    expect(r.body).not.toContain("secret-rpc");
  });
});
