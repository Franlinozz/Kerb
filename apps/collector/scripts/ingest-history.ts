/**
 * Ingest daily bar history for every resolved asset's underlying. Append-only: existing
 * (source, symbol, date) rows are left untouched. The raw payload is stored as a blob.
 */
import { LiveHttp, loadAssets, resolvedAssets, yahooDailyHistory, yahooSymbol } from "@kerb/adapters";
import { connect } from "../src/db/client.js";
import { refDailyBars } from "../src/db/schema.js";
import { putBlob } from "../src/store.js";

const http = new LiveHttp(40_000);
const cfg = loadAssets();
const { db, sql } = connect();
const range = process.argv[2] ?? "10y";

for (const a of resolvedAssets(cfg)) {
  const sym = yahooSymbol(a.underlying.listingCountry, a.underlying.symbol);
  try {
    const h = await yahooDailyHistory(http, sym, range);
    const blob = await putBlob(db, h.raw.body, "application/json");
    let inserted = 0;
    for (const bar of h.bars) {
      const r = await db.insert(refDailyBars).values({
        source: "yahoo:chart", symbol: sym, underlying: a.underlying.symbol, date: bar.date, open: bar.open, close: bar.close,
        currency: h.currency, rawBlobCid: blob.cid, contentHash: blob.contentHash,
      }).onConflictDoNothing();
      inserted += r.count ?? 0;
    }
    console.log(`${a.symbol.padEnd(7)} ${sym.padEnd(9)} bars=${String(h.bars.length).padStart(5)} new=${String(inserted).padStart(5)} ${h.bars[0]?.date}..${h.bars[h.bars.length - 1]?.date} ${h.currency}`);
  } catch (e) {
    console.error(`${a.symbol}: FAILED ${(e as Error).message}`);
  }
}
const [{ n }] = await sql<{ n: string }[]>`SELECT count(*) AS n FROM ref_daily_bars`;
console.log(`ref_daily_bars now holds ${n} rows`);
await sql.end();
