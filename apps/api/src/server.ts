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
import { buildBoard, type Board } from "./board.js";

export const BOARD_CACHE_MS = 15_000;
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

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false, disableRequestLogging: true });
  const now = deps.now ?? ((): number => Date.now());
  const cache = new Map<number, CacheEntry>();

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

    const ageSec = Math.round((now() - new Date(r.observed_at).getTime()) / 1000);
    return {
      chainId,
      assetId: r.asset_id,
      symbol: r.symbol,
      observedAt: new Date(r.observed_at).toISOString(),
      ageSec,
      usable: ageSec <= 900 && r.regime !== 7 && r.regime !== 6,
      regime: { value: regimeName(r.regime), index: r.regime, label: "Attested" },
      creditMark: { raw: r.credit_mark, decimals: 18, label: "Attested" },
      carryLTV: { raw: r.carry_ltv, decimals: 18, label: "Attested" },
      sessionMaxLTV: { raw: r.session_max_ltv, decimals: 18, label: "Attested" },
      debtCeiling: { raw: r.debt_ceiling, decimals: 18, label: "Attested" },
      executableDepth1: { raw: r.executable_depth1, decimals: 18, label: "Attested" },
      inputsHash: r.inputs_hash,
      tx: r.tx_hash,
      contracts: contractsFor(chainId),
      history: history.map((h) => ({
        observedAt: new Date(h.observed_at).toISOString(), regime: regimeName(h.regime), carryLTV: h.carry_ltv,
        sessionMaxLTV: h.session_max_ltv, debtCeiling: h.debt_ceiling, executableDepth1: h.executable_depth1,
        creditMark: h.credit_mark, tx: h.tx_hash,
      })),
    };
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
