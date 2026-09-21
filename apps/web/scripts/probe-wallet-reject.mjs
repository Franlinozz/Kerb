// A fake EIP-6963 wallet that rejects the connection: the page must say "Connection cancelled",
// nothing raw. Plain JS on purpose: functions passed to the page must not carry bundler helpers.
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.KERB_WEB_URL ?? "http://127.0.0.1:3301";
const OUT = resolve(process.cwd(), "../../data/screens/v2/shell");
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  const provider = {
    request: async ({ method }) => {
      if (method === "eth_chainId") return "0x7a0";
      if (method === "eth_accounts") return [];
      const e = new Error("User rejected the request.");
      e.code = 4001;
      throw e;
    },
    on() {}, removeListener() {},
  };
  const icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='black'/%3E%3C/svg%3E";
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "0f0f0f0f-0000-4000-8000-000000000001", name: "OKX Wallet", icon, rdns: "com.okex.wallet" }, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
});
const p = await ctx.newPage();
await p.goto(`${BASE}/credit`, { waitUntil: "networkidle" });
await p.click('button:has-text("Connect")');
await p.waitForTimeout(400);
console.log("wallets listed:", await p.locator(".wallet-option").allTextContents());
await p.screenshot({ path: resolve(OUT, "wallet-sheet-discovered-1440.png") });
await p.click('.wallet-option:has-text("OKX Wallet")');
await p.waitForTimeout(800);
console.log("toast:", await p.locator(".toast").allTextContents());
console.log("raw error text anywhere:", /rejected the request|viem|UserRejected/i.test(await p.locator("body").innerText()));
await p.screenshot({ path: resolve(OUT, "wallet-rejected-1440.png") });
await p.waitForTimeout(3200);
console.log("toasts after 4 s:", await p.locator(".toast").count());
await b.close();
