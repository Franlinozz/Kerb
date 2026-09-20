/**
 * Export the calendar data KerbClock needs, in the shape the deployer writes onchain.
 * XNAS and ARCX keep the same sessions and holidays as XNYS, so they share its calendar
 * onchain; each asset's own MIC is still reported offchain and in its report.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MARKETS, type MarketCode, type SessionKind } from "../src/index.js";

const KIND: Record<SessionKind, number> = { CLOSED: 0, LUNCH: 1, PRE: 2, POST: 3, REGULAR: 4 };
const ONCHAIN: MarketCode[] = ["XNYS", "XHKG"];
/** Markets that follow another market's calendar onchain. */
export const CALENDAR_ALIAS: Record<string, MarketCode> = { XNAS: "XNYS", ARCX: "XNYS", XCOM: "XNYS" };

const hm = (s: string): number => {
  const [h, m] = s.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
const dayNumber = (d: string): number => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000);
const FROM = "2025-12-01";
const TO = "2027-12-31";

const markets = ONCHAIN.map((code) => {
  const spec = MARKETS[code];
  const isUs = spec.tz === "America/New_York";
  return {
    code,
    tz: spec.tz,
    utcOffsetMin: isUs ? -300 : 480,
    dstRule: isUs ? 1 : 0,
    dstOffsetMin: isUs ? 60 : 0,
    coverageFromDay: dayNumber(FROM),
    coverageToDay: dayNumber(TO),
    cureWindowSec: spec.defaultCureWindowSec,
    weekly: Array.from({ length: 7 }, (_, dow) =>
      (spec.weekly[dow] ?? []).map((s) => ({ startMin: hm(s.start), endMin: hm(s.end), kind: KIND[s.kind] }))),
    overrides: Object.entries(spec.overrides)
      .filter(([date]) => date >= FROM && date <= TO)
      .map(([date, o]) => ({
        date, day: dayNumber(date), name: o.name, reason: o.reason,
        sessions: o.sessions.map((s) => ({ startMin: hm(s.start), endMin: hm(s.end), kind: KIND[s.kind] })),
      }))
      .sort((a, b) => a.day - b.day),
  };
});

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../../../config/clock-onchain.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify({
  version: 1,
  generatedAt: new Date().toISOString(),
  calendarVersion: "kerb-calendar@0.1.0",
  note: "Sessions in local wall-clock minutes. kind: 0 CLOSED, 1 LUNCH, 2 PRE, 3 POST, 4 REGULAR. A holiday is an override with no sessions.",
  alias: CALENDAR_ALIAS,
  markets,
}, null, 2)}\n`);
for (const m of markets) console.log(`${m.code}: weekly ${m.weekly.flat().length} rows, ${m.overrides.length} day overrides, cure ${m.cureWindowSec}s`);
console.log(`wrote ${out}`);
