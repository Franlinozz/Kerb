/**
 * Execute a cure from the UI, in a real browser, against X Layer testnet.
 *
 * Phase 6 asks for a cure executed from the interface rather than from a script, so this drives
 * the actual page: it injects an EIP-1193 provider, clicks Connect, types the borrower's address
 * into the cure panel and presses the button. The private key never enters the browser — the page
 * calls back into node to sign, which is exactly the boundary a real wallet enforces.
 */
import { chromium } from "playwright";
import { createWalletClient, http, publicActions, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://testrpc.xlayer.tech";
const CHAIN_ID = 1952;
const BASE = process.env["KERB_WEB_URL"] ?? "https://usekerb.xyz";
const BORROWER = process.env["KERB_BORROWER"] ?? "0x0d63f9EeB86813230B72017444cea16Cd4A453F2";

const key = process.env["KERB_POSTER_KEY"] as Hex | undefined;
if (!key) throw new Error("KERB_POSTER_KEY is not set");
const account = privateKeyToAccount(key);

const chain = {
  id: CHAIN_ID,
  name: "X Layer testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
} as const;

const wallet = createWalletClient({ account, chain, transport: http(RPC) }).extend(publicActions);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const sent: string[] = [];

// Node signs and sends. The browser only ever sees the request and the resulting hash.
await ctx.exposeFunction("__kerbSendTransaction", async (tx: { to: Hex; data: Hex; value?: Hex }) => {
  try {
    const hash = await wallet.sendTransaction({
      to: tx.to,
      data: tx.data,
      ...(tx.value && tx.value !== "0x0" ? { value: BigInt(tx.value) } : {}),
      account,
      chain,
    });
    sent.push(hash);
    console.log(`  signed and sent ${hash}`);
    return hash;
  } catch (err) {
    console.error(`  signer refused: ${err instanceof Error ? err.message.split("\n").slice(0, 5).join(" | ") : String(err)}`);
    throw err;
  }
});

await ctx.addInitScript(
  ({ address, chainIdHex, rpc }: { address: string; chainIdHex: string; rpc: string }) => {
    const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
    const provider = {
      isMetaMask: true,
      async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
        switch (method) {
          case "eth_requestAccounts":
          case "eth_accounts":
            return [address];
          case "eth_chainId":
            return chainIdHex;
          case "net_version":
            return String(parseInt(chainIdHex, 16));
          case "wallet_switchEthereumChain":
          case "wallet_addEthereumChain":
            return null;
          case "eth_sendTransaction": {
            const tx = (params as { to: string; data: string; value?: string }[])[0]!;
            return (window as unknown as { __kerbSendTransaction: (t: unknown) => Promise<string> })
              .__kerbSendTransaction(tx);
          }
          default: {
            const res = await fetch(rpc, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params: params ?? [] }),
            });
            const body = (await res.json()) as { result?: unknown; error?: { message: string } };
            if (body.error) throw new Error(body.error.message);
            return body.result;
          }
        }
      },
      on(event: string, cb: (...a: unknown[]) => void) {
        (listeners[event] ??= []).push(cb);
        return provider;
      },
      removeListener(event: string, cb: (...a: unknown[]) => void) {
        listeners[event] = (listeners[event] ?? []).filter((f) => f !== cb);
        return provider;
      },
    };
    Object.defineProperty(window, "ethereum", { value: provider, writable: false, configurable: true });
  },
  { address: account.address, chainIdHex: `0x${CHAIN_ID.toString(16)}`, rpc: RPC },
);

page.on("console", (m) => {
  if (m.type() === "error") console.error(`  page error: ${m.text().slice(0, 160)}`);
});

console.log(`curer   ${account.address}`);
console.log(`borrower ${BORROWER}`);
console.log(`opening ${BASE}/market`);
await page.goto(`${BASE}/market`, { waitUntil: "networkidle", timeout: 60_000 });

await page.getByRole("button", { name: /connect wallet/i }).click();
await page.waitForTimeout(1500);
console.log("connected");

// Target the cure panel's own field by its label, not by placeholder: the lookup form further
// down the page uses the same placeholder, and filling that one does nothing.
const target = page.getByLabel("Position to cure");
await target.fill(BORROWER);
await page.waitForTimeout(4000);

await page.screenshot({ path: "shots/cure-before.png", fullPage: true });

// Approve first if the panel asks for it, then cure.
const approve = page.getByRole("button", { name: /^Approve /i }).last();
if (await approve.isVisible().catch(() => false)) {
  console.log("approving the loan asset from the UI");
  await approve.click();
  await page.waitForTimeout(12_000);
}

const cureButton = page.getByRole("button", { name: /^Cure for /i });
await cureButton.waitFor({ state: "visible", timeout: 30_000 });
const label = await cureButton.textContent();
console.log(`clicking: ${label?.trim()}`);
await cureButton.click();

await page.waitForTimeout(20_000);
await page.screenshot({ path: "shots/cure-after.png", fullPage: true });

const notice = await page.locator(".callout").first().textContent().catch(() => null);
console.log(`panel says: ${notice?.trim().slice(0, 200) ?? "(nothing)"}`);

await browser.close();

if (sent.length === 0) {
  console.error("no transaction was sent from the UI");
  process.exitCode = 1;
} else {
  console.log(`\ntransactions sent from the UI:`);
  for (const h of sent) console.log(`  https://www.oklink.com/x-layer-testnet/tx/${h}`);
}
