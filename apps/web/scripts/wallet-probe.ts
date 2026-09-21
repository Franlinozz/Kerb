/** Does a transaction signed in the page actually reach the chain? Faucet needs no cure window. */
import { chromium } from "playwright";
import { createWalletClient, http, publicActions, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://testrpc.xlayer.tech";
const CHAIN_ID = 1952;
const BASE = process.env["KERB_WEB_URL"] ?? "https://usekerb.xyz";
const key = process.env["KERB_POSTER_KEY"] as Hex;
const account = privateKeyToAccount(key);
const chain = { id: CHAIN_ID, name: "X Layer testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } } as const;
const wallet = createWalletClient({ account, chain, transport: http(RPC) }).extend(publicActions);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
const sent: string[] = [];
await ctx.exposeFunction("__kerbSendTransaction", async (tx: { to: Hex; data: Hex; value?: Hex }) => {
  try {
    const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, account, chain });
    sent.push(hash);
    return hash;
  } catch (err) {
    console.error(`  signer refused: ${err instanceof Error ? err.message.split("\n").slice(0, 4).join(" | ") : String(err)}`);
    throw err;
  }
});
await ctx.addInitScript(({ address, chainIdHex, rpc }: { address: string; chainIdHex: string; rpc: string }) => {
  const provider = {
    isMetaMask: true,
    async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
      (window as unknown as { __rpcLog: string[] }).__rpcLog ??= [];
      (window as unknown as { __rpcLog: string[] }).__rpcLog.push(method);
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
      if (method === "eth_chainId") return chainIdHex;
      if (method === "net_version") return String(parseInt(chainIdHex, 16));
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "eth_sendTransaction") {
        const tx = (params as Record<string, string>[])[0]!;
        return (window as unknown as { __kerbSendTransaction: (t: unknown) => Promise<string> }).__kerbSendTransaction(tx);
      }
      const res = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }) });
      const body = (await res.json()) as { result?: unknown; error?: { message: string } };
      if (body.error) throw new Error(body.error.message);
      return body.result;
    },
    on() { return provider; },
    removeListener() { return provider; },
  };
  Object.defineProperty(window, "ethereum", { value: provider, writable: false, configurable: true });
}, { address: account.address, chainIdHex: `0x${CHAIN_ID.toString(16)}`, rpc: RPC });

const page = await ctx.newPage();
page.on("console", (m) => console.log(`  [${m.type()}] ${m.text().slice(0, 200)}`));
page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message.slice(0, 200)}`));

await page.goto(`${BASE}/market`, { waitUntil: "networkidle", timeout: 60_000 });
await page.getByRole("button", { name: /connect wallet/i }).click();
await page.waitForTimeout(2000);

const faucet = page.getByRole("button", { name: /Get 10,000 mUSDG/i }).first();
console.log("faucet button disabled?", await faucet.isDisabled());
await faucet.click();
await page.waitForTimeout(15_000);

const callouts = await page.locator(".callout").allTextContents();
console.log("callouts on the page:");
for (const c of callouts) console.log("  - " + c.trim().slice(0, 180));
const rpcLog = await page.evaluate(() => (window as unknown as { __rpcLog?: string[] }).__rpcLog ?? []);
console.log("rpc methods the page asked for:", [...new Set(rpcLog)].join(", "));
console.log("sent:", sent);
await browser.close();
