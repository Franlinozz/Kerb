// The E2E fixture API (V2-11): replays real Kerb API responses so CI can run the suite with no
// network. `record` proxies to a live API and saves each response; `replay` serves them, with every
// timestamp moved forward by the time since capture so countdowns and ages read as they did live.
//
//   node e2e/fixture-api.mjs record http://127.0.0.1:8720   # capture while the suite runs
//   node e2e/fixture-api.mjs replay                          # CI
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
const [mode = "replay", target = "http://127.0.0.1:8720"] = process.argv.slice(2);
const PORT = Number(process.env.FIXTURE_PORT ?? 8799);
mkdirSync(DIR, { recursive: true });

// Query strings that carry "now" (clock windows) vary run to run: key them by path only.
const keyOf = (url) => { const u = new URL(url, "http://x"); return u.pathname.startsWith("/v1/clock/") ? u.pathname : u.pathname + u.search; };
const fileOf = (key) => resolve(DIR, `${createHash("sha1").update(key).digest("hex").slice(0, 16)}.json`);

const ISO = /"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"/g;
function shift(body, capturedAt) {
  const d = Date.now() - capturedAt;
  return body
    .replace(ISO, (_, t) => `"${new Date(Date.parse(t) + d).toISOString()}"`)
    // The demo clock also carries its epoch in seconds.
    .replace(/"epoch":(\d{9,10})/g, (_, s) => `"epoch":${Number(s) + Math.round(d / 1000)}`);
}

const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
createServer(async (req, res) => {
  const key = keyOf(req.url ?? "/");
  if (mode === "record") {
    try {
      const r = await fetch(target + req.url);
      const body = await r.text();
      if (r.status < 500) writeFileSync(fileOf(key), JSON.stringify({ key, status: r.status, capturedAt: Date.now(), body }));
      res.writeHead(r.status, cors).end(body);
    } catch { res.writeHead(502, cors).end(JSON.stringify({ error: "fixture recorder could not reach the API", label: "Unavailable" })); }
    return;
  }
  const f = fileOf(key);
  if (!existsSync(f)) { res.writeHead(404, cors).end(JSON.stringify({ error: `no fixture for ${key}` })); return; }
  const fx = JSON.parse(readFileSync(f, "utf8"));
  res.writeHead(fx.status, cors).end(shift(fx.body, fx.capturedAt));
}).listen(PORT, "127.0.0.1", () => console.log(`fixture api ${mode} on ${PORT}${mode === "record" ? ` -> ${target}` : ` (${readdirSync(DIR).length} fixtures)`}`));
