/** kerb-attribution (V3-04): appends term_changes for new mainnet posts every 60 s. Reads only. */
import { connect } from "@kerb/collector/db";
import { attributeNewPosts } from "./attribution.js";

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
  } catch (e) { log(`error: ${e instanceof Error ? e.message : String(e)}`); }
  finally { busy = false; }
}
log("kerb-attribution starting");
await tick();
setInterval(() => void tick(), 60_000);
