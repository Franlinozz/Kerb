// Finish a flow run that stopped before its withdraw: load /credit in a real browser as the saved
// throwaway borrower (from /root/.kerb/flow-wallets.log), open Withdraw, MAX, send. Testnet only.
//   node scripts/finish-withdraw.mjs <borrower address>
import { readFileSync, appendFileSync } from "node:fs";
import { chromium } from "playwright";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://testrpc.xlayer.tech";
const BASE = process.env.KERB_WEB_URL ?? "https://v2.usekerb.xyz";
const addr = (process.argv[2] ?? "").toLowerCase();
const line = readFileSync("/root/.kerb/flow-wallets.log", "utf8").split("\n").find((l) => l.split(" ")[2]?.toLowerCase() === addr);
if (!line) throw new Error("no saved key for that address");
const account = privateKeyToAccount(line.split(" ")[3]);
const chain = { id: 1952, name: "X Layer testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const wallet = createWalletClient({ account, chain, transport: http(RPC) }).extend(publicActions);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
await ctx.exposeFunction("__send", async (tx) => {
  const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, ...(tx.gas ? { gas: (BigInt(tx.gas) * 15n) / 10n } : {}) });
  console.log(`${new Date().toISOString().slice(11, 19)} signed ${hash} ${tx.data.slice(0, 10)}`);
  appendFileSync("/tmp/finish-withdraw.log", `${hash}\n`);
  return hash;
});
await ctx.addInitScript(({ address, rpc }) => {
  localStorage.setItem("kerb-theme", "day");
  window.ethereum = { async request({ method, params }) {
    if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
    if (method === "eth_chainId") return "0x7a0";
    if (method === "wallet_switchEthereumChain") return null;
    if (method === "eth_sendTransaction") return window.__send(params[0]);
    const r = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }) });
    const j = await r.json(); if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code, data: j.error.data }); return j.result;
  }, on() {}, removeListener() {} };
}, { address: account.address, rpc: RPC });
const p = await ctx.newPage();
await p.goto(`${BASE}/credit`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: "Connect a wallet" }).first().click();
await p.getByRole("button", { name: /Browser wallet|Injected|MetaMask/ }).first().click();
await p.getByText("Connected on chain 1952.").waitFor({ timeout: 30_000 });
await p.getByRole("tab", { name: "Withdraw" }).click();
const panel = p.locator('.zone-centre [role="tabpanel"]:not([hidden])');
await panel.getByText(/Deposited [1-9]/).waitFor({ timeout: 60_000 });
console.log(`owing shown: ${await p.locator(".zone-right").innerText().then((t) => (t.match(/Owing[^\n]*\n?[^\n]*/) ?? ["none"])[0].replace(/\n/g, " "))}`);
await panel.getByRole("button", { name: "MAX" }).click();
const go = panel.locator(".action-go");
const t0 = Date.now();
await go.click({ timeout: 60_000 });
console.log(`withdraw enabled after ${Math.round((Date.now() - t0) / 1000)} s`);
await p.locator(".stepper-note").filter({ hasText: "Withdrew" }).first().waitFor({ timeout: 240_000 });
await p.waitForTimeout(5000);
await p.screenshot({ path: "../../data/screens/v2/credit-states-day/state-closed-1440.png" });
await p.locator(".zone-right").screenshot({ path: "../../data/screens/v2/credit-states-day/state-closed-panel.png" });
console.log("withdrew");
await b.close();
