import { loadAssets, resolvedAssets } from "@kerb/adapters";
import { connect } from "./db/client.js";
import { computeHealth, startHealthServer } from "./health.js";
import { startLoop, type LoopName } from "./loops.js";
import { fixtureProviders } from "./providers/fixture.js";
import { liveProviders } from "./providers/live.js";

const live = process.env["KERB_LIVE"] === "1";
const p = live ? liveProviders() : fixtureProviders();
const cfg = loadAssets();
const { db, sql } = connect();
const startedAt = new Date();
const alarmSec = Number(process.env["KERB_FRESHNESS_ALARM_SEC"] ?? "300");
const port = Number(process.env["KERB_HEALTH_PORT"] ?? "8710");

console.log(`kerb collector starting: mode=${p.mode} assets=${resolvedAssets(cfg).length} health=127.0.0.1:${port}/health`);

const stops = (["pools", "prices", "multipliers"] as LoopName[]).map((n) =>
  startLoop({ db, p, cfg }, n, (name, r) => {
    if (r instanceof Error) console.error(`[${name}] cycle FAILED: ${r.message}`);
    else console.log(`[${name}] ok=${r.ok} failed=${r.failed} ${JSON.stringify(r.detail)}`);
  }),
);

const server = startHealthServer(port, () => computeHealth(sql, p.mode, startedAt, alarmSec));

// Freshness alarm: loud, once a minute, for every source older than the threshold.
const alarm = setInterval(() => {
  computeHealth(sql, p.mode, startedAt, alarmSec)
    .then((h) => {
      if (Date.now() - startedAt.getTime() < alarmSec * 1000) return;
      for (const a of h.alarms) console.error(`!!!!! KERB FRESHNESS ALARM !!!!! ${a}`);
    })
    .catch((e: unknown) => console.error("!!!!! KERB FRESHNESS ALARM !!!!! health query failed", e));
}, 60_000);

const shutdown = (sig: string): void => {
  console.log(`received ${sig}, stopping`);
  stops.forEach((s) => s());
  clearInterval(alarm);
  server.close();
  setTimeout(() => void sql.end({ timeout: 5 }).finally(() => process.exit(0)), 2_000);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
