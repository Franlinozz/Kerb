// V2-08 (C): the whole credit lifecycle, driven through the real Credit page in a real browser,
// with two fresh testnet wallets: a borrower and a separate curer.
//   fresh wallets -> faucets -> deposit -> borrow Session Max -> wait for the demo Last Call ->
//   the curer cures from "Curable now" -> the borrower repays and withdraws.
// Keys stay in node: the page's injected provider calls back to sign, as a real wallet would.
// Testnet only: the script refuses any chain but 1952. Evidence: data/credit-flow-<date>.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createWalletClient, http, parseEther, publicActions } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const RPC = "https://testrpc.xlayer.tech";
const BASE = process.env.KERB_WEB_URL ?? "http://127.0.0.1:3301";
const OUT = resolve(process.cwd(), "../../data/screens/v2/credit-states");
mkdirSync(OUT, { recursive: true });
const chain = { id: 1952, name: "X Layer testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const funder = createWalletClient({ account: privateKeyToAccount(process.env.KERB_DEPLOYER_KEY), chain, transport: http(RPC) }).extend(publicActions);
if ((await funder.getChainId()) !== 1952) throw new Error("not X Layer testnet");

const log = [];
const note = (what, extra = {}) => { const e = { at: new Date().toISOString(), what, ...extra }; log.push(e); console.log(`${e.at.slice(11, 19)} ${what}${extra.tx ? ` ${extra.tx}` : ""}`); };

async function fresh(label) {
  const key = generatePrivateKey();
  const account = privateKeyToAccount(key);
  const hash = await funder.sendTransaction({ to: account.address, value: parseEther("0.004") });
  await funder.waitForTransactionReceipt({ hash });
  note(`${label} ${account.address} funded with 0.004 test OKB`, { tx: hash });
  return { label, account, wallet: createWalletClient({ account, chain, transport: http(RPC) }).extend(publicActions) };
}

async function browserFor(who, browser, theme = "night") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.exposeFunction("__send", async (tx) => {
    const hash = await who.wallet.sendTransaction({ to: tx.to, data: tx.data, ...(tx.value && tx.value !== "0x0" ? { value: BigInt(tx.value) } : {}), ...(tx.gas ? { gas: (BigInt(tx.gas) * 15n) / 10n } : {}) });
    note(`${who.label} signed`, { tx: hash, to: tx.to, selector: tx.data.slice(0, 10) });
    return hash;
  });
  await ctx.addInitScript(({ address, rpc, theme }) => {
    localStorage.setItem("kerb-theme", theme);
    const provider = {
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
    window.ethereum = provider;
  }, { address: who.account.address, rpc: RPC, theme });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => note(`${who.label} page error: ${e.message.slice(0, 120)}`));
  await page.goto(`${BASE}/credit`, { waitUntil: "networkidle" });
  return { ctx, page };
}

async function connect(page) {
  await page.getByRole("button", { name: "Connect a wallet" }).first().click();
  await page.getByRole("button", { name: /Browser wallet|Injected|MetaMask/ }).first().click();
  await page.getByText("Connected on chain 1952.").waitFor({ timeout: 30_000 });
}

async function flowDone(page, doneText, timeout = 120_000) {
  await page.locator(".stepper-note").filter({ hasText: doneText }).first().waitFor({ timeout });
}

const shots = async (page, name) => { await page.screenshot({ path: resolve(OUT, `${name}-1440.png`), fullPage: false }); await page.locator(".zone-right").screenshot({ path: resolve(OUT, `${name}-panel.png`) }); };

const browser = await chromium.launch();
const borrower = await fresh("borrower");
const curer = await fresh("curer");

// ---- borrower: setup, deposit, borrow Session Max
const B = await browserFor(borrower, browser);
await shots(B.page, "state-no-wallet");
await connect(B.page);
await B.page.getByRole("button", { name: /^Mint 100 kKOx/ }).click();
await flowDone(B.page, "Minted 100 kKOx");
await B.page.getByRole("button", { name: /^Mint 10,000 mUSDG/ }).click();
await flowDone(B.page, "Minted 10,000 mUSDG");
await B.page.waitForTimeout(3000);
await shots(B.page, "state-no-position");
await B.page.getByLabel("Collateral to add (kKOx)").fill("100");
await B.page.getByRole("button", { name: /^Session Max/ }).click();
// Session Max room, less 1%, so the position sits between Carry and Session Max.
const smaxText = await B.page.locator(".mode-opt").nth(1).locator(".t-num-l").textContent();
const room = Number((smaxText.match(/[\d,]+\.\d{2}/)?.[0] ?? "0").replace(/,/g, ""));
const want = (Math.floor(room * 0.99 * 100) / 100).toFixed(2);
await B.page.getByLabel("Borrow (mUSDG)").fill(want);
note(`borrowing ${want} mUSDG with Session Max (room ${room})`);
await B.page.locator(".zone-centre .action-go").click();
await flowDone(B.page, "Borrowed", 240_000);
await B.page.waitForTimeout(8000);
await shots(B.page, "state-ready-to-carry");

// ---- wait for the demo Last Call
note("waiting for the demo Last Call");
await B.page.locator(".pos-lastcall").waitFor({ timeout: 70 * 60_000 });
await B.page.waitForTimeout(2500);
await shots(B.page, "state-last-call");
const required = await B.page.locator(".pos-lastcall .pos-big").textContent();
note(`Last Call on the borrower's panel: ${required}`);

// ---- curer: a stranger cures from "Curable now"
const C = await browserFor(curer, browser);
await connect(C.page);
await C.page.getByRole("button", { name: /^Mint 10,000 mUSDG/ }).click();
await flowDone(C.page, "Minted 10,000 mUSDG");
const row = C.page.locator(".curable tbody tr").filter({ hasText: borrower.account.address.slice(0, 6) });
await row.waitFor({ timeout: 120_000 });
await C.page.locator(".curable").screenshot({ path: resolve(OUT, "curable-now-1440.png") });
await row.getByRole("button", { name: "Cure" }).click();
await flowDone(C.page, "Cured", 240_000);
note("curer cured the position from the public table");

// ---- borrower sees the cure, then repays and withdraws
await B.page.reload({ waitUntil: "networkidle" });
await B.page.locator(".pos").filter({ hasText: "Cured" }).waitFor({ timeout: 120_000 }).catch(() => note("cured state not shown yet (positions feed caches 30 s)"));
await B.page.waitForTimeout(4000);
await shots(B.page, "state-cured");
await B.page.getByRole("tab", { name: "Repay" }).click();
await B.page.locator(".zone-centre").getByRole("button", { name: "MAX" }).click();
await B.page.locator(".zone-centre .action-go").click();
await flowDone(B.page, "Repaid", 240_000);
await B.page.getByRole("tab", { name: "Withdraw" }).click();
await B.page.locator(".zone-centre").getByRole("button", { name: "MAX" }).click();
await B.page.locator(".zone-centre .action-go").click();
await flowDone(B.page, "Withdrew", 240_000);
await B.page.waitForTimeout(4000);
await shots(B.page, "state-closed");

writeFileSync(resolve(process.cwd(), `../../data/credit-flow-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify({ base: BASE, borrower: borrower.account.address, curer: curer.account.address, steps: log }, null, 1));
await browser.close();
console.log("done");
