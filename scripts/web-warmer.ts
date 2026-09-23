/**
 * kerb-web-warmer (V3-01, docs/v3/V3-LIVE-AUDIT.md L-01 fix 3). ISR is stale-while-revalidate:
 * on a quiet site the first visitor after a pause gets the page rendered at the previous visit.
 * This process visits every live route on a short cycle so each one keeps regenerating, and a
 * judge's first paint is normally under 25 s old. It also keeps the API's short caches warm.
 *
 * It requests the Next server directly (the ISR cache lives there) with the production Host
 * header, at most two requests at a time, each with a 5 s timeout and 0 to 1 s of jitter. Only
 * failures are logged. It reads nothing private and writes nothing.
 */
const BASE = process.env["KERB_WARM_BASE"] ?? "http://127.0.0.1:3300";
const HOST = process.env["KERB_WARM_HOST"] ?? "www.usekerb.xyz";
const API = process.env["KERB_API_INTERNAL"] ?? "http://127.0.0.1:8720";
const FALLBACK_ASSETS = ["BRK.Bx", "HKEXCx", "COINx", "KUAIx", "ICEx", "MIXUx", "KOx", "SHEINx", "BMNRx", "SLVx"];
const EVERY_MS = 10_000;
const CREDIT_EVERY_MS = 5_000;
const CONCURRENCY = 2;

let assets = FALLBACK_ASSETS;
async function refreshAssets(): Promise<void> {
  try {
    const r = await fetch(`${API}/v1/board?chain=196`, { signal: AbortSignal.timeout(5_000) });
    const b = (await r.json()) as { rows?: { symbol: string }[] };
    if (b.rows?.length) assets = b.rows.map((x) => x.symbol);
  } catch { /* keep the last list */ }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function warm(path: string): Promise<void> {
  await sleep(Math.random() * 1000);
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { host: HOST, "user-agent": "kerb-web-warmer" }, signal: AbortSignal.timeout(5_000) });
    await r.arrayBuffer();
    if (!r.ok) console.error(`${new Date().toISOString()} ${path} ${r.status} in ${Date.now() - t0} ms`);
  } catch (err) {
    console.error(`${new Date().toISOString()} ${path} failed after ${Date.now() - t0} ms: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Run paths with at most CONCURRENCY in flight. */
async function pool(paths: string[]): Promise<void> {
  const queue = [...paths];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { for (let p = queue.shift(); p !== undefined; p = queue.shift()) await warm(p); }));
}

let busy = false;
async function cycle(): Promise<void> {
  if (busy) return; // a slow cycle is never stacked on another
  busy = true;
  try {
    await pool(["/", "/board", "/proof", "/methodology", "/research", "/developers", ...assets.map((a) => `/asset/${encodeURIComponent(a)}`)]);
  } finally { busy = false; }
}

let creditBusy = false;
async function credit(): Promise<void> {
  if (creditBusy) return;
  creditBusy = true;
  try { await warm("/credit"); } finally { creditBusy = false; }
}

void (async () => {
  await refreshAssets();
  console.log(`${new Date().toISOString()} kerb-web-warmer: ${BASE} as ${HOST}, ${6 + assets.length} routes every ${EVERY_MS / 1000} s, /credit every ${CREDIT_EVERY_MS / 1000} s`);
  setInterval(() => void cycle(), EVERY_MS);
  setInterval(() => void credit(), CREDIT_EVERY_MS);
  setInterval(() => void refreshAssets(), 600_000);
  void cycle();
  void credit();
})();
