import { chromium } from "playwright";
const b = await chromium.launch();
for (const [w, theme] of [[1440, "night"], [390, "day"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 } });
  await ctx.addInitScript((t) => {
    localStorage.setItem("kerb-theme", t);
    const address = "0x0d8c00000000000000000000000000000000e999";
    const provider = { async request({ method }) { if (method === "eth_requestAccounts" || method === "eth_accounts") return [address]; if (method === "eth_chainId") return "0x7a0"; if (method === "net_version") return "1952"; return null; }, on() {}, removeListener() {} };
    window.ethereum = provider;
    const info = { uuid: "0f0f0f0f-0000-4000-8000-000000000001", name: "Test Wallet", icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8'/%3E%3C/svg%3E", rdns: "xyz.test" };
    const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
    window.addEventListener("eip6963:requestProvider", announce); announce();
  }, theme);
  const p = await ctx.newPage();
  await p.goto(process.env.URL + "/credit", { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  if (!(await p.locator(".net-badge").first().isVisible().catch(() => false))) {
    await p.locator("header").getByRole("button", { name: /Connect/ }).first().click();
    await p.getByRole("button", { name: /Test Wallet|Browser wallet/ }).first().click();
    await p.waitForTimeout(2500);
  }
  await p.locator(".net-badge").first().click(); await p.waitForTimeout(500);
  await p.screenshot({ path: `/root/kerb/data/screens/v3/audit/wallet-menu-${w}.png`, clip: { x: w < 500 ? 0 : 900, y: 0, width: w < 500 ? 390 : 540, height: 320 } });
  await ctx.close();
}
await b.close();
