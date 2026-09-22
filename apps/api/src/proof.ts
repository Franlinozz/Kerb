/**
 * /v1/proof: everything a judge needs to check Kerb against reality, assembled from live state.
 * docs/ARCHITECTURE.md section 8. Nothing on this surface is hardcoded and nothing is estimated: if a
 * value cannot be read right now, the field says so rather than carrying a stale or invented number.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";
import { decodeBuilderCode, loadDeployments } from "@kerb/attester";
import type { Sql } from "@kerb/collector/db";

export interface PinningState {
  /** Posts in the last 24 hours, and where each one's bundle can actually be fetched from. */
  recentPosts: number;
  pinned: number;
  unpinned: number;
  storedByApi: number;
  retrievable: number;
  note: string;
}

export interface Proof {
  generatedAt: string;
  build: {
    repo: string;
    firstCommitAt: string | null;
    latestCommitAt: string | null;
    commits: number;
    commitsPerDay: { date: string; count: number }[];
    buildPeriodMarkdown: string | null;
    tests: unknown | null;
  };
  onchain: {
    deployments: { key: string; chainId: number; contract: string; address: string; block: string | null; deployedAt: string | null; verification: string | null; verificationUrl: string | null; explorer: string }[];
    latestPosts: { chainId: number; symbol: string | null; observedAt: string; tx: string; explorer: string; gasUsed: string | null; builderCode: string[] | null }[];
    postCounts: { chainId: number; count: number }[];
  };
  data: {
    sources: { source: string; lastObservedAt: string | null; ageSec: number | null; rows: number }[];
    totals: { table: string; rows: number }[];
    latestBundle: { symbol: string | null; inputsHash: string; cid: string | null; pinStatus: string | null; gateway: string | null; apiUrl: string } | null;
    pinning: PinningState;
  };
  risk: {
    report: { symbol: string | null; observedAt: string; inputsHash: string; cid: string | null; recomputeCommand: string } | null;
  };
  limitations: { subsystem: string; rung: string; note: string }[];
  /** The latest real browser run of the credit lifecycle on testnet, as recorded by the flow script. */
  creditFlow: { file: string; what: string; borrower: string | null; curer: string | null; steps: { at: string; note: string; tx?: string; status?: string; explorer?: string }[] } | null;
}

/**
 * The truth about pinning, whatever it is. A page that says "not configured" when the account is
 * actually over its quota is a page that hides the thing a reader most needs to know.
 */
async function pinningState(sql: Sql): Promise<PinningState> {
  const rows = await sql<{ inputs_hash: string; pin_status: string | null }[]>`
    SELECT DISTINCT inputs_hash, pin_status FROM terms_posts WHERE ts > now() - interval '24 hours'`;

  let pinned = 0;
  let unpinned = 0;
  let storedByApi = 0;
  let retrievable = 0;
  for (const r of rows) {
    const isPinned = r.pin_status === "pinned";
    if (isPinned) pinned += 1;
    else unpinned += 1;
    // Counted, not assumed: the attester only began writing bundles to disk part way through.
    const stored = existsSync(resolve(BUNDLE_DIR, `${r.inputs_hash.toLowerCase()}.json`));
    if (stored) storedByApi += 1;
    if (stored || isPinned) retrievable += 1;
  }

  const total = rows.length;
  const history =
    "Every bundle posted after K-43 resolves from its inputsHash through the Kerb API. Earlier posts have a documented IPFS gap caused by the pinning quota.";
  const note = total === 0
    ? `No terms have been posted in the last 24 hours. ${history}`
    : `${history} In the last 24 hours ${retrievable} of ${total} distinct input bundles can be fetched back: ${pinned} from IPFS and ${storedByApi} from this API.`;
  return { recentPosts: total, pinned, unpinned, storedByApi, retrievable, note };
}

const BUNDLE_DIR = process.env["KERB_BUNDLE_DIR"] ?? resolve(repoRoot(), "data/reports/bundles");

const explorerFor = (chainId: number): string =>
  chainId === 196 ? "https://www.oklink.com/xlayer" : "https://www.oklink.com/x-layer-testnet";

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: repoRoot(), encoding: "utf8", timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

export async function buildProof(sql: Sql, nowMs: number): Promise<Proof> {
  const root = repoRoot();

  // ---------------------------------------------------------------- build period
  const log = git(["log", "--pretty=format:%cI", "--reverse"]);
  const stamps = log ? log.split("\n").filter(Boolean) : [];
  const perDay = new Map<string, number>();
  for (const s of stamps) {
    const d = s.slice(0, 10);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  const buildPeriodPath = resolve(root, "BUILD_PERIOD.md");
  const testsPath = resolve(root, "data/test-report.json");

  // ---------------------------------------------------------------- onchain
  const deployments = Object.entries(loadDeployments()).map(([key, d]) => {
    // Keys look like "1952:KerbMirror:KOx": everything after the chain is the display name, so
    // two deployments of the same contract stay distinguishable.
    const [chain, ...rest] = key.split(":");
    const chainId = Number(chain);
    const label = rest.join(":");
    const record = d as unknown as {
      address: string;
      deployedAtBlock?: string | number;
      deployedAt?: string;
      verified?: boolean;
      explorer?: string;
      verification?: { service: string; match: string; url: string };
    };
    return {
      key,
      chainId,
      contract: label || key,
      address: record.address,
      block: record.deployedAtBlock === undefined ? null : String(record.deployedAtBlock),
      deployedAt: record.deployedAt ?? null,
      verification: verificationLabel(record.verification),
      verificationUrl: record.verification?.url ?? null,
      explorer: record.explorer ?? `${explorerFor(chainId)}/address/${record.address}`,
    };
  });

  const posts = await sql<{ chain_id: number; symbol: string | null; observed_at: Date; tx_hash: string; gas_used: string | null }[]>`
    SELECT chain_id, symbol, observed_at, tx_hash, gas_used FROM terms_posts ORDER BY ts DESC LIMIT 10`;
  const postCounts = await sql<{ chain_id: number; count: string }[]>`
    SELECT chain_id, count(*)::text AS count FROM terms_posts GROUP BY chain_id ORDER BY chain_id`;

  // ---------------------------------------------------------------- data
  const priceSources = await sql<{ source: string; last: Date | null; rows: string }[]>`
    SELECT source, max(ts) AS last, count(*)::text AS rows FROM obs_price GROUP BY source ORDER BY source`;
  const poolSource = await sql<{ source: string; last: Date | null; rows: string }[]>`
    SELECT source, max(ts) AS last, count(*)::text AS rows FROM obs_pool_state GROUP BY source`;
  const quoteSource = await sql<{ source: string; last: Date | null; rows: string }[]>`
    SELECT source, max(ts) AS last, count(*)::text AS rows FROM obs_quote GROUP BY source`;
  const multSource = await sql<{ source: string; last: Date | null; rows: string }[]>`
    SELECT source, max(ts) AS last, count(*)::text AS rows FROM obs_multiplier GROUP BY source`;

  const totals = await sql<{ table: string; rows: string }[]>`
    SELECT 'obs_pool_state' AS table, count(*)::text AS rows FROM obs_pool_state
    UNION ALL SELECT 'obs_price', count(*)::text FROM obs_price
    UNION ALL SELECT 'obs_quote', count(*)::text FROM obs_quote
    UNION ALL SELECT 'obs_multiplier', count(*)::text FROM obs_multiplier
    UNION ALL SELECT 'ref_daily_bars', count(*)::text FROM ref_daily_bars
    UNION ALL SELECT 'terms_posts', count(*)::text FROM terms_posts`;

  const [bundle] = await sql<{ symbol: string | null; inputs_hash: string; bundle_cid: string | null; pin_status: string | null; observed_at: Date }[]>`
    SELECT symbol, inputs_hash, bundle_cid, pin_status, observed_at FROM terms_posts ORDER BY ts DESC LIMIT 1`;

  const asSource = (rows: { source: string; last: Date | null; rows: string }[]): Proof["data"]["sources"] =>
    rows.map((r) => ({
      source: r.source,
      lastObservedAt: r.last ? new Date(r.last).toISOString() : null,
      ageSec: r.last ? Math.round((nowMs - new Date(r.last).getTime()) / 1000) : null,
      rows: Number(r.rows),
    }));

  return {
    generatedAt: new Date(nowMs).toISOString(),
    build: {
      repo: "https://github.com/Franlinozz/Kerb",
      firstCommitAt: stamps[0] ?? null,
      latestCommitAt: stamps[stamps.length - 1] ?? null,
      commits: stamps.length,
      commitsPerDay: [...perDay.entries()].map(([date, count]) => ({ date, count })),
      buildPeriodMarkdown: existsSync(buildPeriodPath) ? readFileSync(buildPeriodPath, "utf8") : null,
      tests: existsSync(testsPath) ? (JSON.parse(readFileSync(testsPath, "utf8")) as unknown) : null,
    },
    onchain: {
      deployments,
      latestPosts: posts.map((p) => ({
        chainId: p.chain_id,
        symbol: p.symbol,
        observedAt: new Date(p.observed_at).toISOString(),
        tx: p.tx_hash,
        explorer: `${explorerFor(p.chain_id)}/tx/${p.tx_hash}`,
        gasUsed: p.gas_used,
        builderCode: null,
      })),
      postCounts: postCounts.map((c) => ({ chainId: c.chain_id, count: Number(c.count) })),
    },
    data: {
      sources: [...asSource(poolSource), ...asSource(priceSources), ...asSource(quoteSource), ...asSource(multSource)],
      totals: totals.map((t) => ({ table: t.table, rows: Number(t.rows) })),
      latestBundle: bundle
        ? {
            symbol: bundle.symbol,
            inputsHash: bundle.inputs_hash,
            cid: bundle.bundle_cid,
            pinStatus: bundle.pin_status,
            gateway: bundle.bundle_cid && bundle.pin_status === "pinned" ? `https://gateway.pinata.cloud/ipfs/${bundle.bundle_cid}` : null,
            apiUrl: `/v1/bundle/${bundle.inputs_hash}`,
          }
        : null,
      pinning: await pinningState(sql),
    },
    risk: {
      report: bundle
        ? {
            symbol: bundle.symbol,
            observedAt: new Date(bundle.observed_at).toISOString(),
            inputsHash: bundle.inputs_hash,
            cid: bundle.bundle_cid,
            recomputeCommand: `pnpm --filter @kerb/engine kerb verify ${bundle.inputs_hash}`,
          }
        : null,
    },
    limitations: LIMITATIONS,
    creditFlow: latestCreditFlow(root),
  };
}

/** The rung each subsystem is actually on, per the ladders in AGENTS.md section 7. */
const LIMITATIONS: Proof["limitations"] = [
  { subsystem: "Reference price", rung: "2 + independent check", note: "xStocks issuer price data, plus Yahoo as an independent Observed reference. Chainlink Data Streams (rung 1) needs credentials Kerb does not have." },
  { subsystem: "Executable depth", rung: "1", note: "Exact Uniswap V3 tick-walk on the real X Layer pools, cross-checked against OKX DEX v6 aggregator quotes at the same notionals. The conservative value is taken whenever they diverge." },
  { subsystem: "Corporate action data", rung: "1 partial + 2", note: "The issuer multiplier endpoint gives current and next values; the full corporate action schedule needs an API key. Kerb also polls multiplier() and convertToAssets() on chain every ten minutes." },
  { subsystem: "Credit market deployment", rung: "2", note: "Credit runs on X Layer testnet with mirror collateral. The risk plane is live on mainnet." },
  { subsystem: "Jurisdiction", rung: "n/a", note: "The operator does not acquire, hold, or route around restrictions on the production tokenized assets. The credit demonstration uses clearly labelled mirror collateral on testnet." },
  { subsystem: "Audit", rung: "n/a", note: "These contracts are unaudited. They hold no user funds on mainnet: the mainnet deployment is the risk plane only." },
];

/** Decode the Builder Code from a transaction's calldata, for one of the latest posts. */
export async function decodeLatestBuilderCode(rpcUrl: string, txHash: string): Promise<string[] | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [txHash] }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json()) as { result?: { input?: string } };
    const input = body.result?.input;
    if (!input) return null;
    const codes = decodeBuilderCode(input as `0x${string}`);
    return codes.length > 0 ? codes : null;
  } catch {
    return null;
  }
}

export const PROOF_REPORT_DIR = (): string => resolve(repoRoot(), "data/reports/kts");
export const listBundles = (): string[] => {
  const dir = PROOF_REPORT_DIR();
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".bundle.json")) : [];
};

/**
 * The verification column in words. Never a bare "no": a contract is either matched on a named
 * service, or its source is in the repo and the verification is still pending.
 */
export function verificationLabel(v: { service: string; match: string } | undefined): string {
  if (!v) return "Source in repo, verification pending";
  const service = v.service.toLowerCase() === "sourcify" ? "Sourcify" : v.service;
  const match = v.match.replace(/_/g, " ").replace(/^full match$/, "exact match").replace(/^perfect$/, "exact match").replace(/^match$/, "partial match");
  return `${service} ${match}`;
}

/** data/credit-flow-<date>.json, newest first; each tx in it carries its receipt status. */
function latestCreditFlow(root: string): Proof["creditFlow"] {
  const dir = resolve(root, "data");
  const f = existsSync(dir) ? readdirSync(dir).filter((x) => /^credit-flow-\d{4}-\d{2}-\d{2}.*\.json$/.test(x)).sort().pop() : undefined;
  if (!f) return null;
  try {
    const j = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as { what?: string; borrower?: string; curer?: string; steps?: { at: string; note?: string; what?: string; tx?: string; status?: string; explorer?: string }[] };
    return {
      file: `data/${f}`, what: j.what ?? "Credit lifecycle on X Layer testnet", borrower: j.borrower ?? null, curer: j.curer ?? null,
      steps: (j.steps ?? []).map((st) => ({ at: st.at, note: st.note ?? st.what ?? "", ...(st.tx ? { tx: st.tx, explorer: st.explorer ?? `https://www.oklink.com/x-layer-testnet/tx/${st.tx}` } : {}), ...(st.status ? { status: st.status } : {}) })),
    };
  } catch { return null; }
}
