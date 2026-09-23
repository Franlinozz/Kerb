/**
 * The public read API. No secrets in responses or error payloads, CORS open for reads,
 * and every number carries a provenance label and the time it was observed.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { loadAssets, repoRoot, resolvedAssets } from "@kerb/adapters";
import { assetId as toAssetId, keccakText, regimeName } from "@kerb/types";
import { connect, type Sql } from "@kerb/collector/db";
import { loadDeployments } from "@kerb/attester";
import { resolveClock, timeline, type Segment } from "@kerb/calendar";
import { buildBundle, computeReport, engineConfig, explainNow, identifyBundle, loadParams } from "@kerb/engine";
import { buildProof, decodeLatestBuilderCode } from "./proof.js";
import { verifyPosted, type VerifyResult } from "./verify.js";
import { sideOf, type PostRow } from "./attribution.js";
import { buildCreditMarket, buildCreditPosition } from "./credit.js";
import { buildBoard, type Board } from "./board.js";
import { buildDemoClock, defaultReader, readOpenPositions, syncCreditLogs, type ChainReader } from "./v2credit.js";
import { MARKET_META } from "./markets.js";
import { explorerTx } from "@kerb/adapters";
import { fromUnits } from "@kerb/types";

export const BOARD_CACHE_MS = 15_000;
export const REPORT_CACHE_MS = 60_000;
const REPORT_DIR = process.env["KERB_REPORT_DIR"] ?? resolve(repoRoot(), "data/reports/kts");
/** Bundles written by the attester, keyed by the inputsHash that went on chain. */
const BUNDLE_DIR = process.env["KERB_BUNDLE_DIR"] ?? resolve(repoRoot(), "data/reports/bundles");

export interface ServerDeps {
  sql: Sql;
  now?: () => number;
  /** Chain reads for the credit plane; the default is the public X Layer RPC. */
  reader?: (chainId: number) => ChainReader;
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
  const reader = deps.reader ?? defaultReader;
  const shortCache = new Map<string, { at: number; body: unknown }>();
  /** Memoise a response for ttl ms. Errors are never cached. */
  const cached = async <T>(key: string, ttl: number, make: () => Promise<T>): Promise<T> => {
    const hit = shortCache.get(key);
    if (hit && now() - hit.at < ttl) return hit.body as T;
    const body = await make();
    shortCache.set(key, { at: now(), body });
    return body;
  };
  const chainError = (reply: { status: (n: number) => { send: (b: unknown) => unknown } }, err: unknown, chainId: number) => {
    console.error(`${new Date().toISOString()} chain ${chainId}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    return reply.status(502).send({ error: "The chain did not answer. Try again in a moment.", chainId, label: "Unavailable" });
  };

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
    const board = await buildBoard(deps.sql, chainId, contractsFor(chainId), now(), { readLT: (c, ids) => readLiquidationThresholds(reader(c), c, ids) });
    cache.set(chainId, { at: now(), board });
    void reply.header("x-kerb-cache", "miss");
    return board;
  });

  /**
   * Why the current terms are what they are (V3-04, SPEC-TERM-ATTRIBUTION.md section 5): three
   * sentences with their numbers, computed from the latest post's own input bundle. Cached by its
   * inputsHash, so a sentence never outlives the post it describes.
   */
  const whyCache = new Map<string, unknown>();
  app.get("/v1/terms/:chain/:asset/why", async (req, reply) => {
    const { chain, asset } = req.params as { chain: string; asset: string };
    if (chain !== "196") return reply.status(404).send({ error: "attribution covers the mainnet terms, chain 196" });
    const found = findAsset(asset);
    if (!found) return reply.status(404).send({ error: "unknown asset" });
    const [row] = await deps.sql<PostRow[]>`SELECT id, ts, chain_id, symbol, tx_hash, inputs_hash, regime, carry_ltv, session_max_ltv, debt_ceiling, clamped
      FROM terms_posts WHERE chain_id = 196 AND symbol = ${found.symbol} ORDER BY id DESC LIMIT 1`;
    if (!row) return reply.status(404).send({ error: "no posted terms yet" });
    void reply.header("cache-control", "public, max-age=15");
    const hit = whyCache.get(row.inputs_hash);
    if (hit) return hit;
    const side = sideOf(row);
    const sentences = explainNow(side);
    const body = {
      chainId: 196, symbol: found.symbol, asOf: side.at, tx: row.tx_hash, explorer: explorerTx(196, row.tx_hash as `0x${string}`),
      inputsHash: row.inputs_hash, kts: side.kts, label: "Computed" as const,
      sentences: sentences.length ? sentences : null,
      ...(sentences.length ? {} : { note: side.report ? "This post is not under KTS 0.2, so its margins have no horizon to explain." : "This post's input bundle is not retrievable, so its causes are unavailable." }),
    };
    whyCache.set(row.inputs_hash, body);
    if (whyCache.size > 200) whyCache.delete(whyCache.keys().next().value as string);
    return body;
  });

  /**
   * The exit check (V3-06): the latest post's tick-walk C(1%) against the OKX DEX quote at the same
   * notionals, which one bound the capacity, and a summary of the window. Unavailable says why.
   */
  app.get("/v1/exit/:chain/:asset", async (req, reply) => {
    const { chain, asset } = req.params as { chain: string; asset: string };
    if (chain !== "196") return reply.status(404).send({ error: "exit checks cover the mainnet terms, chain 196" });
    const found = findAsset(asset);
    if (!found) return reply.status(404).send({ error: "unknown asset" });
    const hours = Math.min(168, Math.max(1, Number((req.query as { hours?: string }).hours ?? 72) || 72));
    void reply.header("cache-control", "public, max-age=30");
    return cached(`exit:${found.symbol}:${hours}`, 30_000, async () => {
      const rows = await deps.sql<{ at: Date; tx: string; inputs_hash: string; simulated_c1: string | null; quoted_c1: string | null; used_c1: string | null; delta: string | null; bound: string; unavailable_reason: string | null; quote_age_sec: number | null; router: string | null }[]>`
        SELECT at, tx, inputs_hash, simulated_c1, quoted_c1, used_c1, delta, bound, unavailable_reason, quote_age_sec, router
        FROM exit_checks WHERE chain_id = 196 AND symbol = ${found.symbol} AND at > now() - make_interval(hours => ${hours}) ORDER BY at DESC`;
      const latest = rows[0];
      const avail = rows.filter((r) => r.bound !== "unavailable" && r.delta !== null);
      const deltas = avail.map((r) => Number(r.delta)).sort((a, b) => a - b); // summary statistics only, never a posted value
      const reasons: Record<string, number> = {};
      for (const r of rows) if (r.unavailable_reason) reasons[r.unavailable_reason] = (reasons[r.unavailable_reason] ?? 0) + 1;
      return {
        chainId: 196, symbol: found.symbol, hours, label: "Computed" as const, generatedAt: new Date().toISOString(),
        latest: latest ? {
          at: new Date(latest.at).toISOString(), tx: latest.tx, explorer: explorerTx(196, latest.tx as `0x${string}`), inputsHash: latest.inputs_hash,
          simulatedC1: latest.simulated_c1, quotedC1: latest.quoted_c1, usedC1: latest.used_c1, delta: latest.delta, bound: latest.bound,
          unavailableReason: latest.unavailable_reason, quoteAgeSec: latest.quote_age_sec, router: latest.router, source: "okx-dex:v6-quote",
        } : null,
        summary: {
          checks: rows.length,
          okxBound: rows.filter((r) => r.bound === "okx-quote").length,
          medianDelta: deltas.length ? String(deltas[Math.floor(deltas.length / 2)]) : null,
          maxDelta: deltas.length ? String(deltas[deltas.length - 1]) : null,
          unavailable: rows.length - avail.length,
          unavailableReasons: reasons,
        },
        strip: rows.slice(0, 288).map((r) => ({ at: new Date(r.at).toISOString(), bound: r.bound })),
      };
    });
  });

  /** Every material term change in the last hours, newest first, with its computed causes (V3-04). */
  app.get("/v1/terms/:chain/:asset/changes", async (req, reply) => {
    const { chain, asset } = req.params as { chain: string; asset: string };
    if (chain !== "196") return reply.status(404).send({ error: "attribution covers the mainnet terms, chain 196" });
    const found = findAsset(asset);
    if (!found) return reply.status(404).send({ error: "unknown asset" });
    const hours = Math.min(168, Math.max(1, Number((req.query as { hours?: string }).hours ?? 72) || 72));
    void reply.header("cache-control", "public, max-age=30");
    return cached(`changes:${found.symbol}:${hours}`, 30_000, async () => {
      const rows = await deps.sql<{ at: Date; field: string; from_value: string; to_value: string; delta: string | null; headline: string; causes: unknown; residual: string | null; prev_tx: string; next_tx: string; next_inputs_hash: string }[]>`
        SELECT at, field, from_value, to_value, delta, headline, causes, residual, prev_tx, next_tx, next_inputs_hash
        FROM term_changes WHERE chain_id = 196 AND symbol = ${found.symbol} AND at > now() - make_interval(hours => ${hours})
        ORDER BY at DESC, field LIMIT 500`;
      return {
        chainId: 196, symbol: found.symbol, hours, label: "Computed" as const, generatedAt: new Date().toISOString(),
        changes: rows.map((r) => ({
          at: new Date(r.at).toISOString(), field: r.field, from: r.from_value, to: r.to_value, delta: r.delta, headline: r.headline,
          causes: r.causes, residual: r.residual, tx: r.next_tx, explorer: explorerTx(196, r.next_tx as `0x${string}`), prevTx: r.prev_tx, inputsHash: r.next_inputs_hash,
        })),
      };
    });
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

    // Default: the last 50 posts. ?historyHours=N (1 to 168) returns every post in that window instead,
    // capped at 3,000 rows, for the terms-history chart.
    const hoursQ = Number((req.query as { historyHours?: string }).historyHours);
    const hours = Number.isFinite(hoursQ) && hoursQ >= 1 ? Math.min(168, Math.floor(hoursQ)) : null;
    const history = hours === null
      ? await deps.sql<{ observed_at: Date; regime: number; carry_ltv: string; session_max_ltv: string; debt_ceiling: string; executable_depth1: string; credit_mark: string; tx_hash: string }[]>`
          SELECT observed_at, regime, carry_ltv, session_max_ltv, debt_ceiling, executable_depth1, credit_mark, tx_hash
          FROM terms_reports WHERE chain_id = ${chainId} AND lower(asset_id) = ${id} ORDER BY observed_at DESC LIMIT 50`
      : await deps.sql<{ observed_at: Date; regime: number; carry_ltv: string; session_max_ltv: string; debt_ceiling: string; executable_depth1: string; credit_mark: string; tx_hash: string }[]>`
          SELECT observed_at, regime, carry_ltv, session_max_ltv, debt_ceiling, executable_depth1, credit_mark, tx_hash
          FROM terms_reports WHERE chain_id = ${chainId} AND lower(asset_id) = ${id}
            AND observed_at > ${new Date(now() - hours * 3_600_000).toISOString()}
          ORDER BY observed_at DESC LIMIT 3000`;

    // The published bundle behind this report, so a reader can go from a number to its exact inputs.
    const [pin] = await deps.sql<{ bundle_cid: string | null; pin_status: string | null }[]>`
      SELECT bundle_cid, pin_status FROM terms_posts
      WHERE chain_id = ${chainId} AND lower(inputs_hash) = lower(${r.inputs_hash})
      ORDER BY ts DESC LIMIT 1`;
    // Where the inputs actually are. The API copy always exists, because the attester writes the
    // bundle under its own inputsHash before it posts. The IPFS copy is the stronger one and is
    // reported separately, including when pinning is failing and why.
    const storedLocally = existsSync(resolve(BUNDLE_DIR, `${r.inputs_hash.toLowerCase()}.json`));
    const bundle = {
      cid: pin?.bundle_cid ?? null,
      pinStatus: pin?.pin_status ?? null,
      pinned: pin?.pin_status === "pinned",
      ipfsUrl: pin?.bundle_cid && pin.pin_status === "pinned"
        ? `https://gateway.pinata.cloud/ipfs/${pin.bundle_cid}`
        : null,
      /** Always available: the canonical bytes the inputsHash was taken over. */
      url: storedLocally || pin?.pin_status === "pinned"
        ? `/v1/bundle/${r.inputs_hash}`
        : null,
      servedByApi: storedLocally,
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
  const builderCache = new Map<string, string[]>();
  app.get("/v1/proof", async (_req, reply) => {
    const proof = await buildProof(deps.sql, now());
    // Decode the Builder Code from each real transaction rather than repeating the configured value.
    // Calldata never changes, so each tx is decoded once.
    await Promise.all(proof.onchain.latestPosts.map(async (post) => {
      const known = builderCache.get(post.tx);
      if (known !== undefined) { post.builderCode = known; return; }
      const rpc = post.chainId === 196
        ? process.env["KERB_RPC_MAINNET"] ?? "https://rpc.xlayer.tech"
        : process.env["KERB_RPC_TESTNET"] ?? "https://testrpc.xlayer.tech";
      post.builderCode = await decodeLatestBuilderCode(rpc, post.tx);
      if (post.builderCode) { if (builderCache.size > 500) builderCache.clear(); builderCache.set(post.tx, post.builderCode); }
    }));
    // The last verify result: the latest report recomputed from its bundle and compared with the chain.
    let verify: VerifyResult | null = null;
    if (proof.risk.report) {
      try { verify = await verifyPosted(deps.sql, proof.risk.report.inputsHash); } catch { verify = null; }
    }
    (proof as typeof proof & { verify: VerifyResult | null }).verify = verify;
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
      return { ...market, generatedAt: new Date().toISOString() };
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





  /** Newest Terms posts across both chains. */
  app.get("/v1/tape", async (req, reply) => {
    const limit = Math.min(100, Math.max(1, Number((req.query as { limit?: string }).limit ?? 20) || 20));
    return cached(`tape:${limit}`, 15_000, async () => {
      const rows = await deps.sql<{ symbol: string; chain_id: number; regime: number; executable_depth1: string; carry_ltv: string; session_max_ltv: string; tx_hash: string; observed_at: Date }[]>`
        SELECT symbol, chain_id, regime, executable_depth1, carry_ltv, session_max_ltv, tx_hash, observed_at
        FROM terms_posts ORDER BY ts DESC LIMIT ${limit}`;
      return {
        label: "Attested" as const,
        generatedAt: new Date().toISOString(),
        posts: rows.map((r) => ({
          symbol: r.symbol, chainId: r.chain_id, regime: regimeName(r.regime),
          c1: fromUnits(BigInt(r.executable_depth1), 6),
          carryLTV: fromUnits(BigInt(r.carry_ltv), 18), sessionMaxLTV: fromUnits(BigInt(r.session_max_ltv), 18),
          tx: r.tx_hash, explorer: explorerTx(r.chain_id as 196 | 1952, r.tx_hash as `0x${string}`),
          observedAt: new Date(r.observed_at).toISOString(),
        })),
      };
    }).then((b) => { void reply.header("cache-control", "public, max-age=15"); return b; });
  });

  /** Headline counts for the Home page. Exact counts, cached for a minute. */
  app.get("/v1/stats", async () => cached("stats", 60_000, async () => {
    const [counts] = await deps.sql<{ pool: string; price: string; quote: string; mult: string }[]>`
      SELECT (SELECT count(*) FROM obs_pool_state) AS pool, (SELECT count(*) FROM obs_price) AS price,
             (SELECT count(*) FROM obs_quote) AS quote, (SELECT count(*) FROM obs_multiplier) AS mult`;
    const posts = await deps.sql<{ chain_id: number; n: string }[]>`SELECT chain_id, count(*) AS n FROM terms_posts GROUP BY chain_id ORDER BY chain_id`;
    const assets = resolvedAssets(loadAssets());
    const dir = resolve(repoRoot(), "data/reports");
    const latest = existsSync(dir)
      ? readdirSync(dir).filter((f) => /^market-time-\d+\.json$/.test(f)).sort((a, b) => Number(b.match(/\d+/)?.[0]) - Number(a.match(/\d+/)?.[0]))[0]
      : undefined;
    let latestReport: { id: string; title: string; headline: string | null; figure: string | null } | null = null;
    if (latest) {
      const r = JSON.parse(readFileSync(resolve(dir, latest), "utf8")) as { id: string; title: string; findings?: { claim: string }[]; pools?: { symbol: string; role: string; changePct: string | null }[] };
      const falls = (r.pools ?? []).filter((x) => x.role === "asset" && x.changePct !== null).sort((a, b) => Number(a.changePct) - Number(b.changePct));
      const worst = falls[0];
      latestReport = { id: String(r.id), title: r.title, headline: r.findings?.[0]?.claim ?? null, figure: worst ? `${worst.symbol} ${worst.changePct}%` : null };
    }
    const n = (x: string | undefined): number => Number(x ?? 0);
    return {
      label: "Observed" as const,
      generatedAt: new Date().toISOString(),
      obsPoolRows: n(counts?.pool),
      obsTotalRows: n(counts?.pool) + n(counts?.price) + n(counts?.quote) + n(counts?.mult),
      postsByChain: posts.map((p) => ({ chainId: p.chain_id, count: Number(p.n) })),
      assets: assets.length,
      markets: new Set(assets.map((a) => a.underlying.market)).size,
      marketMeta: Object.values(MARKET_META),
      latestReport,
    };
  }));

  /**
   * The demo keeper's status line (V3-02): the standing Session Max position that becomes curable
   * at every demo Last Call. Read-only, from the status file the keeper rewrites every minute; a
   * file older than three minutes means the keeper is not running, and the answer says so.
   */
  app.get("/v1/credit/:chain/keeper", async (req, reply) => {
    if ((req.params as { chain: string }).chain !== "1952") return reply.status(404).send({ error: "the demo keeper runs on X Layer testnet 1952 only" });
    const file = resolve(repoRoot(), "data/keeper-status.json");
    void reply.header("cache-control", "public, max-age=15");
    if (!existsSync(file)) return { running: false, address: KEEPER_ADDRESS, label: "Observed" as const, note: "The demo keeper has not started." };
    try {
      const s = JSON.parse(readFileSync(file, "utf8")) as { updatedAt: string } & Record<string, unknown>;
      const ageSec = Math.round((Date.now() - Date.parse(s.updatedAt)) / 1000);
      return { ...s, running: ageSec < 180, ageSec, label: "Observed" as const };
    } catch {
      return reply.status(503).send({ error: "the keeper status could not be read" });
    }
  });

  /**
   * Kerb for Agents evidence (V3-03): settled x402 calls by network, the latest settlement per
   * network, the listing status the operator records, and where to call. Rows whose network is not
   * an eip155 chain are excluded (one schema test row, 23 Sep, cannot be deleted by design).
   */
  app.get("/v1/agents/stats", async () => cached("agents-stats", 15_000, async () => {
    const cfg = JSON.parse(readFileSync(resolve(repoRoot(), "config/agents.json"), "utf8")) as { listingStatus: string; network: string; price: string; currency: string; endpoints: Record<string, string> };
    const rows = await deps.sql<{ network: string; n: string; last_tx: string | null; last_at: Date | null }[]>`
      SELECT network, count(*) AS n,
        (array_agg(settlement_tx ORDER BY ts DESC))[1] AS last_tx, max(ts) AS last_at
      FROM agent_calls WHERE network LIKE 'eip155:%' GROUP BY network ORDER BY network`;
    const explorer = (network: string, tx: string): string => `${network === "eip155:196" ? "https://www.oklink.com/xlayer" : "https://www.oklink.com/x-layer-testnet"}/tx/${tx}`;
    return {
      label: "Observed" as const,
      generatedAt: new Date().toISOString(),
      listingStatus: cfg.listingStatus,
      live: { network: cfg.network, price: cfg.price, currency: cfg.currency },
      endpoints: cfg.endpoints,
      paidCalls: rows.map((r) => ({ network: r.network, count: Number(r.n), latest: r.last_tx ? { tx: r.last_tx, at: r.last_at ? new Date(r.last_at).toISOString() : null, explorer: explorer(r.network, r.last_tx) } : null })),
    };
  }));

  /** The compressed demo clock the testnet credit plane runs on, as a schedule. */
  app.get("/v1/credit/:chain/demo-clock", async (req, reply) => {
    const chainId = Number((req.params as { chain: string }).chain);
    if (!Number.isFinite(chainId)) return reply.status(400).send({ error: "bad chain" });
    try {
      const body = await cached(`demo:${chainId}`, 5_000, () => buildDemoClock(chainId, reader(chainId), now()));
      if (!body) return reply.status(404).send({ error: "no demo clock is deployed on this chain", chainId });
      return body;
    } catch (err) {
      return chainError(reply, err, chainId);
    }
  });

  /**
   * A per-client budget for the positions feed: it can trigger a chain scan, so it is the one
   * public route worth protecting. 60 requests a minute per address is far above what the page
   * polls (one every 30 s per open tab).
   */
  const budget = new Map<string, { windowStart: number; n: number }>();
  const overBudget = (key: string, limit = 60, windowMs = 60_000): boolean => {
    const t = now();
    const b = budget.get(key);
    if (!b || t - b.windowStart >= windowMs) { if (budget.size > 10_000) budget.clear(); budget.set(key, { windowStart: t, n: 1 }); return false; }
    b.n += 1;
    return b.n > limit;
  };

  /** Every open position, curable first, found from the market's own events. */
  app.get("/v1/credit/:chain/positions", async (req, reply) => {
    const forwarded = req.headers["x-forwarded-for"];
    const client = String(forwarded ?? req.ip).split(",")[0]!.trim();
    // The web app's own server renders read from loopback with no forwarded address: every
    // visitor's render would share one budget, so they are not counted. Public traffic arrives
    // through Caddy, which sets X-Forwarded-For.
    const internal = forwarded === undefined && (client === "127.0.0.1" || client === "::1" || client === "::ffff:127.0.0.1");
    if (!internal && overBudget(client)) {
      void reply.header("retry-after", "60");
      return reply.status(429).send({ error: "too many requests for the positions feed; try again in a minute" });
    }
    const chainId = Number((req.params as { chain: string }).chain);
    const state = (req.query as { state?: string }).state ?? "all";
    const userQ = (req.query as { user?: string }).user;
    if (userQ !== undefined && !/^0x[0-9a-fA-F]{40}$/.test(userQ)) return reply.status(400).send({ error: "bad address" });
    if (!Number.isFinite(chainId)) return reply.status(400).send({ error: "bad chain" });
    if (state !== "all" && state !== "curable") return reply.status(400).send({ error: "state must be curable or all" });
    if (!loadDeployments()[`${chainId}:KerbCredit`]) return reply.status(404).send({ error: "no credit market is deployed on this chain", chainId });
    try {
      const body = await cached(`positions:${chainId}`, 30_000, async () => {
        const scan = await syncCreditLogs(chainId, reader(chainId), deps.reader === undefined);
        const positions = await readOpenPositions(chainId, reader(chainId), scan.pairs, scan.cures);
        return { chainId, label: "Verified" as const, scannedToBlock: scan.scannedTo, eventsSeen: scan.events, positions, cures: scan.cures };
      });
      const { cures, ...rest } = body;
      if (userQ) {
        // One address: every position it has had, open or closed, with its last cure.
        const mine = Object.entries(cures).filter(([k]) => k.startsWith(`${userQ.toLowerCase()}|`));
        return { ...rest, positions: rest.positions.filter((p) => p.user.toLowerCase() === userQ.toLowerCase()), lastCures: Object.fromEntries(mine) };
      }
      return state === "curable" ? { ...rest, positions: rest.positions.filter((p) => p.cure.eligible) } : rest;
    } catch (err) {
      return chainError(reply, err, chainId);
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

  /**
   * Where the holes in a report's record are, so a chart can mark them rather than draw across.
   * Read from the same observation store the report was generated from; the report file itself is
   * never rewritten. A hole is any stretch longer than five minutes with no live pool reading.
   */
  const gapCache = new Map<string, { from: string; to: string; minutes: number }[]>();
  app.get("/v1/market-time/:id/gaps", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^[0-9]{1,4}$/.test(id)) return reply.status(400).send({ error: "bad report id" });
    const p = resolve(repoRoot(), `data/reports/market-time-${id}.json`);
    if (!existsSync(p)) return reply.status(404).send({ error: "no such Market-Time Report" });
    const r = JSON.parse(readFileSync(p, "utf8")) as { window: { from: string; to: string } };
    let gaps = gapCache.get(id);
    if (!gaps) {
      const rows = await deps.sql<{ prev: Date; ts: Date; mins: string }[]>`
        SELECT prev, ts, round(extract(epoch FROM ts - prev) / 60)::text AS mins FROM (
          SELECT ts, lag(ts) OVER (ORDER BY ts) AS prev FROM obs_pool_state
          WHERE mode = 'live' AND ts BETWEEN ${r.window.from} AND ${r.window.to}) s
        WHERE ts - prev > interval '5 minutes' ORDER BY prev`;
      gaps = rows.map((g) => ({ from: new Date(g.prev).toISOString(), to: new Date(g.ts).toISOString(), minutes: Number(g.mins) }));
      gapCache.set(id, gaps);
    }
    void reply.header("cache-control", "public, max-age=300");
    return { label: "Observed", window: r.window, thresholdMinutes: 5, gaps };
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

  /** Serve a published input bundle by its keccak inputs hash or its report id. */
  app.get("/v1/bundle/:hash", async (req, reply) => {
    const { hash } = req.params as { hash: string };

    // The attester writes every bundle under its own inputsHash, so a hash read off a
    // TermsPosted event resolves here whether or not IPFS pinning happened to succeed.
    if (/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      const direct = resolve(BUNDLE_DIR, `${hash.toLowerCase()}.json`);
      if (direct.startsWith(BUNDLE_DIR) && existsSync(direct)) {
        void reply.header("content-type", "application/json");
        return reply.send(readFileSync(direct, "utf8"));
      }
    }

    // Older bundles, and any written by the CLI, live beside their report.
    const byId = safeReportPath(hash, ".bundle.json");
    if (byId) {
      void reply.header("content-type", "application/json");
      return reply.send(readFileSync(byId, "utf8"));
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash) || !existsSync(REPORT_DIR)) {
      return reply.status(404).send({ error: "unknown bundle" });
    }
    for (const f of readdirSync(REPORT_DIR)) {
      if (!f.endsWith(".bundle.json")) continue;
      const b = resolve(REPORT_DIR, f);
      const text = readFileSync(b, "utf8");
      if (keccakText(text).toLowerCase() === hash.toLowerCase()) {
        void reply.header("content-type", "application/json");
        return reply.send(text);
      }
    }
    return reply.status(404).send({ error: "unknown bundle" });
  });

  return app;
}

const LT_ABI = [{ type: "function", name: "guardrails", stateMutability: "view", inputs: [{ name: "assetId", type: "bytes32" }], outputs: [{ type: "tuple", components: [
  { name: "ltvMin", type: "uint64" }, { name: "ltvMax", type: "uint64" }, { name: "ceilingMin", type: "uint128" }, { name: "ceilingMax", type: "uint128" },
  { name: "maxLoosenStepBps", type: "uint64" }, { name: "loosenCooldownSec", type: "uint32" }, { name: "maxReportAgeSec", type: "uint32" },
  { name: "LT", type: "uint64" }, { name: "exists", type: "bool" }] }] }] as const;
const ltCache = new Map<number, { at: number; lts: Map<string, bigint> }>();

/** Fixed liquidation thresholds straight from KerbTerms guardrails. They change only by timelock, so ten minutes of cache is safe. */
async function readLiquidationThresholds(reader: ChainReader, chainId: number, ids: string[]): Promise<Map<string, bigint> | null> {
  const hit = ltCache.get(chainId);
  if (hit && Date.now() - hit.at < 600_000) return hit.lts;
  const terms = contractsFor(chainId).terms as `0x${string}` | undefined;
  if (!terms) return null;
  const lts = new Map<string, bigint>();
  await Promise.all(ids.map(async (id) => {
    const g = (await reader.readContract({ address: terms, abi: LT_ABI, functionName: "guardrails", args: [id] })) as { LT: bigint; exists: boolean };
    if (g.exists) lts.set(id, g.LT);
  }));
  ltCache.set(chainId, { at: Date.now(), lts });
  return lts;
}

const KEEPER_ADDRESS = "0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4";

export async function start(): Promise<void> {
  const { sql } = connect();
  const app = buildServer({ sql });
  // Backfill the testnet credit events once at start, so the first visitor is not the one who waits.
  void syncCreditLogs(1952, defaultReader(1952)).then(
    (s) => console.log(`${new Date().toISOString()} credit scan 1952 to block ${s.scannedTo}: ${s.pairs.length} positions seen, ${s.events} events`),
    (e: unknown) => console.error(`${new Date().toISOString()} credit scan 1952 failed: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`),
  );
  const port = Number(process.env["KERB_API_PORT"] ?? 8720);
  const host = process.env["KERB_API_HOST"] ?? "127.0.0.1";
  await app.listen({ port, host });
  console.log(`${new Date().toISOString()} api listening on ${host}:${port}`);
}
