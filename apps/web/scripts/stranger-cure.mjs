// V3-02 step 4: a stranger cures the demo keeper's standing position through the real Credit page.
// One fresh testnet wallet (funded from the deployer, key kept in /root/.kerb/flow-wallets.log),
// the page's injected provider signing from node as a real wallet would, then: connect, mint
// mUSDG from the faucet, wait for the keeper's row in "Curable now" at the demo Last Call, press
// Cure. Testnet 1952 only. Evidence: data/keeper-cure-<date>.json and screenshots in data/screens/v3/keeper.
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createWalletClient, http, parseEther, publicActions } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const RPC = "https://testrpc.xlayer.tech";
const BASE = process.env.KERB_WEB_URL ?? "https://www.usekerb.xyz";
const KEEPER = "0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4";
const OUT = resolve(process.cwd(), "../../data/screens/v3/keeper");
mkdirSync(OUT, { recursive: true });
const chain = { id: 1952, name: "X Layer testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const funder = createWalletClient({ account: privateKeyToAccount(process.env.KERB_DEPLOYER_KEY), chain, transport: http(RPC) }).extend(publicActions);
if ((await funder.getChainId()) !== 1952) throw new Error("testnet 1952 only");
const log = [];
const note = (what, extra = {}) => { const e = { at: new Date().toISOString(), what, ...extra }; log.push(e); console.log(`${e.at.slice(11, 19)} ${what}${extra.tx ? ` ${extra.tx}` : ""}`); };

const key = generatePrivateKey();
const account = privateKeyToAccount(key);
appendFileSync("/root/.kerb/flow-wallets.log", `${new Date().toISOString()} stranger-curer ${account.address} ${key}\n`, { mode: 0o600 });
const fund = await funder.sendTransaction({ to: account.address, value: parseEther("0.003") });
await funder.waitForTransactionReceipt({ hash: fund });
note(`curer ${account.address} funded with 0.003 test OKB`, { tx: fund });
const wallet = createWalletClient({ account, chain, transport: http(RPC) }).extend(publicActions);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await ctx.exposeFunction("__send", async (tx) => {
  const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, ...(tx.value && tx.value !== "0x0" ? { value: BigInt(tx.value) } : {}), ...(tx.gas ? { gas: (BigInt(tx.gas) * 15n) / 10n } : {}) });
  note("curer signed", { tx: hash, to: tx.to, selector: tx.data.slice(0, 10) });
  return hash;
});
await ctx.addInitScript(({ address, rpc }) => {
  window.ethereum = {
    async request({ method, params }) {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
      if (method === "eth_chainId") return "0x7a0";
      if (method === "net_version") return "1952";
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "eth_sendTransaction") return window.__send(params[0]);
      const r = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }) });
      const j = await r.json();
      if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code, data: j.error.data });
      return j.result;
    },
    on() {}, removeListener() {},
  };
}, { address: account.address, rpc: RPC });
const page = await ctx.newPage();
page.on("pageerror", (e) => note(`page error: ${e.message.slice(0, 500)}`));
await page.goto(`${BASE}/credit`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Connect a wallet" }).first().click();
await page.getByRole("button", { name: /Browser wallet|Injected|MetaMask/ }).first().click();
await page.getByText("Connected on chain 1952.").waitFor({ timeout: 30_000 });
await page.getByRole("button", { name: /^Mint 10,000 mUSDG/ }).click();
await page.locator(".stepper-note").filter({ hasText: "Minted 10,000 mUSDG" }).first().waitFor({ timeout: 120_000 });
note("curer minted mUSDG through the page");

const row = page.locator(".curable tbody tr").filter({ hasText: KEEPER.slice(0, 6) });
note("waiting for the keeper's position in Curable now");
await row.waitFor({ timeout: 75 * 60_000 });
await page.screenshot({ path: resolve(OUT, "curable-now-keeper-1440.png") });
await page.locator(".curable").screenshot({ path: resolve(OUT, "curable-now-keeper-table.png") });
note("the keeper's standing position is in Curable now");
await row.getByRole("button", { name: "Cure" }).click();
await page.locator(".stepper-note").filter({ hasText: "Cured" }).first().waitFor({ timeout: 240_000 });
note("stranger cured the keeper's position from the public table");
await page.screenshot({ path: resolve(OUT, "cured-by-stranger-1440.png") });
writeFileSync(resolve(process.cwd(), `../../data/keeper-cure-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify({ base: BASE, keeper: KEEPER, curer: account.address, steps: log }, null, 1));
await browser.close();
