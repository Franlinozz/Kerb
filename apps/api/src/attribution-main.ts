/** kerb-attribution (V3-04, V3-06): appends term_changes and exit_checks for new mainnet posts every 60 s. */
import { connect } from "@kerb/collector/db";
import { attributeNewPosts, exitChecksForNewPosts } from "./attribution.js";

const { sql } = connect();
const log = (s: string): void => console.log(`${new Date().toISOString()} ${s}`);
let busy = false;
async function tick(): Promise<void> {
  if (busy) return;
  busy = true;
  const t0 = Date.now();
  try {
    const n = await attributeNewPosts(sql, 196, log);
    if (n > 0) log(`attributed ${n} changes in ${Date.now() - t0} ms`);
    const e = await exitChecksForNewPosts(sql, 196);
    if (e > 0) log(`recorded ${e} exit checks`);
  } catch (e) { log(`error: ${e instanceof Error ? e.message : String(e)}`); }
  finally { busy = false; }
}
log("kerb-attribution starting");
await tick();
setInterval(() => void tick(), 60_000);
