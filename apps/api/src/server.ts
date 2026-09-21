/**
 * The public read API. No secrets in responses or error payloads, CORS open for reads,
 * and every number carries a provenance label and the time it was observed.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { loadAssets, repoRoot, resolvedAssets } from "@kerb/adapters";
import { assetId as toAssetId, regimeName } from "@kerb/types";
import { connect, type Sql } from "@kerb/collector/db";
import { loadDeployments } from "@kerb/attester";
import { resolveClock, timeline, type Segment } from "@kerb/calendar";
import { buildBundle, computeReport, engineConfig, identifyBundle, loadParams } from "@kerb/engine";
import { buildProof, decodeLatestBuilderCode } from "./proof.js";
import { buildCreditMarket, buildCreditPosition } from "./credit.js";
import { buildBoard, type Board } from "./board.js";

export const BOARD_CACHE_MS = 15_000;
export const REPORT_CACHE_MS = 60_000;
const REPORT_DIR = process.env["KERB_REPORT_DIR"] ?? resolve(repoRoot(), "data/reports/kts");

export interface ServerDeps {
  sql: Sql;
  now?: () => number;
}

interface CacheEntry {
  at: number;
  board: Board;
}

export function contractsFor(chainId: number): { clock?: string; terms?: string } {
  const d = loadDeployments();
  const out: { clock?: string; terms?: string } = {};
  const clock = d[`${chainId}:KerbClock`];
  const terms = d[`${chainId}:KerbTerms`];
  if (clock) out.clock = clock.address;
  if (terms) out.terms = terms.address;
  return out;
}

/** Bundles and reports are files on disk, named by report id. Paths are never taken from input. */
function safeReportPath(id: string, suffix: string): string | null {
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(id)) return null;
  const p = resolve(REPORT_DIR, `${id}${suffix}`);
  if (!p.startsWith(REPORT_DIR)) return null;
  return existsSync(p) ? p : null;
}


/** Accept a symbol, a token address, or an assetId. Returns the configured asset when there is one. */
function findAsset(asset: string): ReturnType<typeof resolvedAssets>[number] | null {
  const all = resolvedAssets(loadAssets());
  const needle = asset.toLowerCase();
  return all.find((a) => a.symbol.toLowerCase() === needle)
    ?? all.find((a) => a.token.address.toLowerCase() === needle)
    ?? all.find((a) => toAssetId(196, a.token.address).toLowerCase() === needle)
    ?? null;
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false, disableRequestLogging: true });
  const now = deps.now ?? ((): number => Date.now());
  const cache = new Map<number, CacheEntry>();
  const reportCache = new Map<string, { at: number; body: unknown }>();

  void app.register(cors, { origin: true, methods: ["GET", "HEAD", "OPTIONS"] });

  app.setErrorHandler((err, _req, reply) => {
    // Never leak internals: the client gets a shape, the operator gets the detail in the log.
    console.error(`${new Date().toISOString()} api error: ${err instanceof Error ? err.message : String(err)}`);
    void reply.status(500).send({ error: "internal error" });
  });

  app.get("/health", async () => {
    const [obs] = await deps.sql<{ pools: string; last: Date | null }[]>`
      SELECT count(*) AS pools, max(ts) AS last FROM obs_pool_state WHERE mode = 'live'`;
    const lastObs = obs?.last ? new Date(obs.last) : null;
    const ageSec = lastObs ? Math.round((now() - lastObs.getTime()) / 1000) : null;
    const posts = await deps.sql<{ chain_id: number; n: string; last: Date }[]>`
      SELECT chain_id, count(*) AS n, max(ts) AS last FROM terms_posts GROUP BY chain_id ORDER BY chain_id`;
    const healthy = ageSec !== null && ageSec < 300;
    return {
      status: healthy ? "ok" : "degraded",
      now: new Date(now()).toISOString(),
      observations: { poolRows: Number(obs?.pools ?? 0), lastObservedAt: lastObs?.toISOString() ?? null, ageSec },
      posts: posts.map((p) => ({ chainId: p.chain_id, count: Number(p.n), lastAt: new Date(p.last).toISOString() })),
    };
  });

  app.get("/v1/board", async (req, reply) => {
    const q = req.query as { chain?: string };
    const chainId = Number(q.chain ?? 196);
    const hit = cache.get(chainId);
    if (hit && now() - hit.at < BOARD_CACHE_MS) {
      void reply.header("x-kerb-cache", "hit");
      return hit.board;
    }
    const board = await buildBoard(deps.sql, chainId, contractsFor(chainId), now());
    cache.set(chainId, { at: now(), board });
    void reply.header("x-kerb-cache", "miss");
    return board;
  });

  app.get("/v1/terms/:chain/:asset", async (req, reply) => {
    const { chain, asset } = req.params as { chain: string; asset: string };
    const chainId = Number(chain);
    if (!Number.isFinite(chainId)) return reply.status(400).send({ error: "bad chain" });
    const cfg = loadAssets();
    // Accept a symbol, a token address, or an assetId.
    const bySymbol = resolvedAssets(cfg).find((a) => a.symbol.toLowerCase() === asset.toLowerCase());
    const byToken = resolvedAssets(cfg).find((a) => a.token.address.toLowerCase() === asset.toLowerCase());
    const id = bySymbol || byToken
      ? toAssetId(196, (bySymbol ?? byToken)!.token.address).toLowerCase()
      : /^0x[0-9a-fA-F]{64}$/.test(asset) ? asset.toLowerCase() : null;
    if (!id) return reply.status(404).send({ error: "unknown asset" });

    const [r] = await deps.sql<{
      asset_id: string; symbol: string | null; observed_at: Date; regime: number; credit_mark: string; carry_ltv: string;
      session_max_ltv: string; debt_ceiling: string; executable_depth1: string; inputs_hash: string; tx_hash: string; block_number: string;
    }[]>`
      SELECT * FROM terms_reports WHERE chain_id = ${chainId} AND lower(asset_id) = ${id}
      ORDER BY observed_at DESC LIMIT 1`;
    if (!r) return reply.status(404).send({ error: "no terms posted for this asset yet", assetId: id, chainId });

    const history = await deps.sql<{ observed_at: Date; regime: number; carry_ltv: string; session_max_ltv: string; debt_ceiling: string; executable_depth1: string; credit_mark: string; tx_hash: string }[]>`
      SELECT observed_at, regime, carry_ltv, session_max_ltv, debt_ceiling, executable_depth1, credit_mark, tx_hash
      FROM terms_reports WHERE chain_id = ${chainId} AND lower(asset_id) = ${id} ORDER BY observed_at DESC LIMIT 50`;

    // The pinned bundle behind this report, so a reader can go from a number to its exact inputs.
    const [pin] = await deps.sql<{ bundle_cid: string | null; pin_status: string | null }[]>`
      SELECT bundle_cid, pin_status FROM terms_posts
      WHERE chain_id = ${chainId} AND lower(inputs_hash) = lower(${r.inputs_hash})
      ORDER BY ts DESC LIMIT 1`;
    const bundle = {
      cid: pin?.bundle_cid ?? null,
      pinStatus: pin?.pin_status ?? null,
      url: pin?.bundle_cid && pin.pin_status === "pinned"
        ? `https://gateway.pinata.cloud/ipfs/${pin.bundle_cid}`
        : null,
      verifyCommand: `pnpm --filter @kerb/engine kerb verify ${r.inputs_hash}`,
    };

    const ageSec = Math.round((now() - new Date(r.observed_at).getTime()) / 1000);
    const assetCfg = loadAssets();
    const loanAsset = assetCfg.loanAsset;
    const loanDecimals = assetCfg.quoteTokens[loanAsset]?.decimals ?? 18;
    return {
      chainId,
      assetId: r.asset_id,
      symbol: r.symbol,
      observedAt: new Date(r.observed_at).toISOString(),
      ageSec,
      usable: ageSec <= 900 && r.regime !== 7 && r.regime !== 6,
      regime: { value: regimeName(r.regime), index: r.regime, label: "Attested" },
      // Marks and ratios are WAD. Depth and ceilings are posted in loan-asset units, which for
      // USDG is 6 decimals, not 18: declaring the wrong scale here is a 1e12 error in the SDK.
      creditMark: { raw: r.credit_mark, decimals: 18, label: "Attested" },
      carryLTV: { raw: r.carry_ltv, decimals: 18, label: "Attested" },
      sessionMaxLTV: { raw: r.session_max_ltv, decimals: 18, label: "Attested" },
      debtCeiling: { raw: r.debt_ceiling, decimals: loanDecimals, label: "Attested" },
      executableDepth1: { raw: r.executable_depth1, decimals: loanDecimals, label: "Attested" },
      loanAsset: { symbol: loanAsset, decimals: loanDecimals },
      inputsHash: r.inputs_hash,
      bundle,
      tx: r.tx_hash,
      contracts: contractsFor(chainId),
      history: history.map((h) => ({
        observedAt: new Date(h.observed_at).toISOString(), regime: regimeName(h.regime), carryLTV: h.carry_ltv,
        sessionMaxLTV: h.session_max_ltv, debtCeiling: h.debt_ceiling, executableDepth1: h.executable_depth1,
        creditMark: h.credit_mark, tx: h.tx_hash,
      })),
    };
  });


  /**
   * The Clock for one asset: the session it is in now, the transitions ahead, the Last Call
   * window, and the session geometry of the surrounding week for the Session Strip.
   * Computed by the same resolver the onchain KerbClock is equivalence-tested against.
   */
  app.get("/v1/clock/:chain/:asset", async (req, reply) => {
    const { chain, asset } = req.params as { chain: string; asset: string };
    const q = req.query as { from?: string; to?: string };
    const chainId = Number(chain);
    if (!Number.isFinite(chainId)) return reply.status(400).send({ error: "bad chain" });
    const found = findAsset(asset);
    if (!found) return reply.status(404).send({ error: "unknown asset" });

    const atMs = now();
    const fromMs = q.from ? Date.parse(q.from) : atMs - 3 * 86_400_000;
    const toMs = q.to ? Date.parse(q.to) : atMs + 4 * 86_400_000;
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
      return reply.status(400).send({ error: "bad window" });
    }
    if (toMs - fromMs > 31 * 86_400_000) return reply.status(400).send({ error: "window too long" });

    let clock;
    let segments: Segment[];
    try {
      clock = resolveClock({ market: found.underlying.market, atMs });
      segments = timeline(found.underlying.market, fromMs, toMs);
    } catch (err) {
      // Outside calendar coverage is a real answer, not a 500.
      return reply.status(422).send({ error: err instanceof Error ? err.message : "clock unavailable" });
    }

    return {
      chainId,
      symbol: found.symbol,
      market: found.underlying.market,
      timezone: found.underlying.exchangeTimezone,
      at: new Date(atMs).toISOString(),
      label: "Computed" as const,
      clock,
      window: { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() },
      segments: segments.map((g) => ({
        kind: g.kind,
        reason: g.reason,
        startsAt: new Date(g.startMs).toISOString(),
        endsAt: new Date(g.endMs).toISOString(),
        names: g.names,
      })),
    };
  });


  /**
   * The full Market-Time Report for one asset, recomputed from the observations on hand: the
   * impact curve venue by venue, every component of the Credit Mark with its provenance, the
   * stress statistics and the capacity that falls out of them. Cached briefly because the
   * computation reads the observation store, not because the answer is approximate.
   */
  app.get("/v1/report/:chain/:asset", async (req, reply) => {
    const { chain, asset } = req.params as { chain: string; asset: string };
    const chainId = Number(chain);
    if (!Number.isFinite(chainId)) return reply.status(400).send({ error: "bad chain" });
    const found = findAsset(asset);
    if (!found) return reply.status(404).send({ error: "unknown asset" });

    const key = `${chainId}:${found.symbol}`;
    const hit = reportCache.get(key);
    if (hit && now() - hit.at < REPORT_CACHE_MS) {
      void reply.header("x-kerb-cache", "hit");
      return hit.body;
    }

    try {
      const params = loadParams();
      const bundle = await buildBundle(deps.sql, found.symbol, params, {});
      const cfg = engineConfig(params, found.symbol, bundle.market.cureWindowSec);
      const report = computeReport(bundle, cfg);
      const id = identifyBundle(bundle);
      const body = { ...report, inputsHash: id.inputsHash, inputsCidV1Raw: id.cidV1Raw, bundleBytes: id.bytes, label: "Computed" as const };
      reportCache.set(key, { at: now(), body });
      void reply.header("x-kerb-cache", "miss");
      return body;
    } catch (err) {
      // A report that cannot be computed says why. It never falls back to an older number.
      const message = err instanceof Error ? err.message : "report unavailable";
      return reply.status(422).send({ error: message, symbol: found.symbol });
    }
  });


  /**
   * Everything needed to check Kerb against reality: the build period, the chain, the observation
   * store, a report with the command that recomputes it, and the degradation rung of each subsystem.
   */
  app.get("/v1/proof", async (_req, reply) => {
    const proof = await buildProof(deps.sql, now());
    // Decode the Builder Code from a real transaction rather than repeating the configured value.
    const first = proof.onchain.latestPosts[0];
    if (first) {
      const rpc = first.chainId === 196
        ? process.env["KERB_RPC_MAINNET"] ?? "https://rpc.xlayer.tech"
        : process.env["KERB_RPC_TESTNET"] ?? "https://testrpc.xlayer.tech";
      first.builderCode = await decodeLatestBuilderCode(rpc, first.tx);
    }
    void reply.header("cache-control", "public, max-age=15");
    return proof;
  });


  /**
   * The credit plane. Read from chain rather than from the indexer: a borrower deciding whether
   * to repay must not be shown a number that is one block behind.
   */
  app.get("/v1/credit/:chain", async (req, reply) => {
    const chainId = Number((req.params as { chain: string }).chain);
    if (!Number.isFinite(chainId)) return reply.status(400).send({ error: "bad chain" });
    try {
      const market = await buildCreditMarket(chainId);
      if (!market) return reply.status(404).send({ error: "no credit market is deployed on this chain", chainId });
      return market;
    } catch (err) {
      return reply.status(502).send({ error: err instanceof Error ? err.message : "the chain did not answer" });
    }
  });

  app.get("/v1/credit/:chain/position/:user/:assetId", async (req, reply) => {
    const { chain, user, assetId } = req.params as { chain: string; user: string; assetId: string };
    const chainId = Number(chain);
    if (!Number.isFinite(chainId)) return reply.status(400).send({ error: "bad chain" });
    if (!/^0x[0-9a-fA-F]{40}$/.test(user)) return reply.status(400).send({ error: "bad address" });
    if (!/^0x[0-9a-fA-F]{64}$/.test(assetId)) return reply.status(400).send({ error: "bad assetId" });
    try {
      const p = await buildCreditPosition(chainId, user as `0x${string}`, assetId as `0x${string}`);
      if (!p) return reply.status(404).send({ error: "no credit market is deployed on this chain", chainId });
      return p;
    } catch (err) {
      return reply.status(502).send({ error: err instanceof Error ? err.message : "the chain did not answer" });
    }
  });




  /** The KTS parameter set the engine is actually running on, read from the live params file. */
  app.get("/v1/params", async (_req, reply) => {
    const p = resolve(repoRoot(), "config/kts-params.json");
    if (!existsSync(p)) return reply.status(404).send({ error: "no params file" });
    void reply.header("content-type", "application/json");
    return reply.send(readFileSync(p, "utf8"));
  });

  /** The Market-Time Report index: whatever has actually been published. */
  app.get("/v1/market-time", async () => {
    const dir = resolve(repoRoot(), "data/reports");
    if (!existsSync(dir)) return { reports: [] };
    const reports = readdirSync(dir)
      .filter((f) => /^market-time-\d+\.json$/.test(f))
      .map((f) => {
        const r = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as {
          id: number; title: string; generatedAt: string;
          window: { from: string; to: string; hours: string; observations: number };
        };
        return {
          id: r.id, title: r.title, generatedAt: r.generatedAt,
          window: r.window.from, windowTo: r.window.to,
          hours: r.window.hours, observations: r.window.observations,
        };
      })
      .sort((a, b) => b.id - a.id);
    return { reports };
  });

  /** Market-Time Reports: measured write-ups generated from the observation store. */
  app.get("/v1/market-time/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^[0-9]{1,4}$/.test(id)) return reply.status(400).send({ error: "bad report id" });
    const p = resolve(repoRoot(), `data/reports/market-time-${id}.json`);
    if (!p.startsWith(resolve(repoRoot(), "data/reports")) || !existsSync(p)) {
      return reply.status(404).send({ error: "no such Market-Time Report" });
    }
    void reply.header("content-type", "application/json");
    return reply.send(readFileSync(p, "utf8"));
  });

  app.get("/v1/reports/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = safeReportPath(id, ".report.json");
    if (!p) return reply.status(404).send({ error: "unknown report id" });
    void reply.header("content-type", "application/json");
    return reply.send(readFileSync(p, "utf8"));
  });

  app.get("/v1/reports", async () => {
    if (!existsSync(REPORT_DIR)) return { reports: [] };
    return {
      reports: readdirSync(REPORT_DIR)
        .filter((f) => f.endsWith(".report.json"))
        .map((f) => f.replace(".report.json", ""))
        .sort()
        .slice(-200),
    };
  });

  /** Serve a pinned input bundle by its keccak inputs hash or its report id. */
  app.get("/v1/bundle/:hash", async (req, reply) => {
    const { hash } = req.params as { hash: string };
    const direct = safeReportPath(hash, ".bundle.json");
    if (direct) {
      void reply.header("content-type", "application/json");
      return reply.send(readFileSync(direct, "utf8"));
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash) || !existsSync(REPORT_DIR)) return reply.status(404).send({ error: "unknown bundle" });
    for (const f of readdirSync(REPORT_DIR).filter((x) => x.endsWith(".report.json"))) {
      const body = JSON.parse(readFileSync(resolve(REPORT_DIR, f), "utf8")) as { inputsHash?: string };
      if (body.inputsHash?.toLowerCase() === hash.toLowerCase()) {
        const b = safeReportPath(f.replace(".report.json", ""), ".bundle.json");
        if (b) {
          void reply.header("content-type", "application/json");
          return reply.send(readFileSync(b, "utf8"));
        }
      }
    }
    return reply.status(404).send({ error: "unknown bundle" });
  });

  return app;
}

export async function start(): Promise<void> {
  const { sql } = connect();
  const app = buildServer({ sql });
  const port = Number(process.env["KERB_API_PORT"] ?? 8720);
  const host = process.env["KERB_API_HOST"] ?? "127.0.0.1";
  await app.listen({ port, host });
  console.log(`${new Date().toISOString()} api listening on ${host}:${port}`);
}
