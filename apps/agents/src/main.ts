/** kerb-agents: Kerb for Agents on 127.0.0.1:8740, behind Caddy on api.usekerb.xyz. */
import { connect } from "@kerb/collector/db";
import { createApp } from "./app.js";
import { okxFacilitator, payConfigFromEnv, resourceServer } from "./pay.js";
import { callStore } from "./store.js";
import { httpUpstream } from "./upstream.js";

const pay = payConfigFromEnv();
const { sql } = connect();
const store = callStore(sql as never);
const server = resourceServer(okxFacilitator(), pay, store, (e) => console.error(`${new Date().toISOString()} payment record failed: ${e instanceof Error ? e.message : String(e)}`));
const app = createApp({ upstream: httpUpstream(), pay, server });
const port = Number(process.env["KERB_AGENTS_PORT"] ?? 8740);
app.listen(port, "127.0.0.1", () => console.log(`${new Date().toISOString()} kerb-agents on 127.0.0.1:${port}, x402 ${pay.network} ${pay.price} to ${pay.payTo}`));
