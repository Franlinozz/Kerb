import { expect, test, type Page } from "@playwright/test";

const ROUTES = ["/", "/board", "/asset/BRK.Bx", "/credit", "/research", "/research/1", "/methodology", "/proof", "/developers", "/changelog"];

/** A fake EIP-6963 wallet. `mode` decides what it does when asked to connect. */
async function wallet(page: Page, mode: "reject" | "ok" | "wrong-chain"): Promise<void> {
  await page.addInitScript((m) => {
    const w = window as unknown as { __sent: number };
    w.__sent = 0;
    const addr = "0x000000000000000000000000000000000000dEaD";
    const provider = {
      request: async ({ method }: { method: string }) => {
        if (method === "eth_chainId") return m === "wrong-chain" ? "0x1" : "0x7a0";
        if (method === "eth_accounts") return m === "reject" ? [] : [addr];
        if (method === "eth_requestAccounts") { if (m === "reject") throw Object.assign(new Error("User rejected the request."), { code: 4001 }); return [addr]; }
        if (method === "eth_sendTransaction") { w.__sent++; throw Object.assign(new Error("User rejected the request."), { code: 4001 }); }
        if (method === "wallet_switchEthereumChain") throw Object.assign(new Error("User rejected the request."), { code: 4001 });
        return null;
      },
      on() {}, removeListener() {},
    };
    const icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8'/%3E%3C/svg%3E";
    const announce = (): void => { window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "0f0f0f0f-0000-4000-8000-000000000001", name: "Test Wallet", icon, rdns: "xyz.usekerb.test" }, provider }) })); };
    window.addEventListener("eip6963:requestProvider", announce);
    announce();
  }, mode);
}

test("home renders its h1 and either board rows or a labelled error", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  const rows = await page.locator("table.dt tbody tr").count();
  const err = await page.locator(".state-error").count();
  expect(rows + err).toBeGreaterThan(0);
});

test("every nav link resolves and every route has exactly one, distinct h1", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page.locator(".main-nav a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const seen = new Map<string, string>();
  for (const r of [...new Set([...hrefs, ...ROUTES])]) {
    const res = await page.goto(r!);
    expect(res?.status(), r!).toBeLessThan(400);
    await expect(page.locator("h1"), r!).toHaveCount(1);
    const h = (await page.locator("h1").innerText()).trim();
    if (r === "/research/1") continue;
    expect(seen.get(h), `${r} repeats the h1 of ${seen.get(h)}`).toBeUndefined();
    seen.set(h, r!);
  }
});

test("old paths redirect permanently", async ({ request }) => {
  for (const [from, to] of [["/market", "/credit"], ["/reports", "/research"], ["/reports/1", "/research/1"]] as const) {
    const r = await request.get(from, { maxRedirects: 0 });
    expect(r.status(), from).toBe(308);
    expect(r.headers()["location"], from).toContain(to);
  }
});

test("theme menu: night, day and market persist across a reload with no flash", async ({ page }) => {
  await page.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { (window as unknown as { __first: string | null }).__first = document.documentElement.getAttribute("data-theme"); }, { once: true }); });
  await page.goto("/board");
  for (const [label, painted] of [["Day", "day"], ["Night", "night"]] as const) {
    await page.getByRole("button", { name: /Change theme/ }).click();
    await page.getByRole("menuitemradio", { name: new RegExp(label) }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", painted);
    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { __first: string | null }).__first), `${label} painted before hydration`).toBe(painted);
  }
  await page.getByRole("button", { name: /Change theme/ }).click();
  await page.getByRole("menuitemradio", { name: /Market/ }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "market");
  expect(["day", "night"]).toContain(await page.locator("html").getAttribute("data-theme"));
});

test("wallet: an EIP-6963 wallet is listed, a rejection says Connection cancelled and the header stays clean", async ({ page }) => {
  await wallet(page, "reject");
  await page.goto("/credit");
  await page.locator(".header-tools").getByRole("button", { name: /Connect/ }).first().click();
  await expect(page.locator(".wallet-option").filter({ hasText: "Test Wallet" })).toHaveCount(1);
  await page.locator(".wallet-option").filter({ hasText: "Test Wallet" }).click();
  await expect(page.locator(".toast").filter({ hasText: "Connection cancelled" })).toBeVisible();
  expect(/rejected the request|viem|UserRejected/i.test(await page.locator("body").innerText())).toBe(false);
  await expect(page.locator(".header-tools").getByRole("button", { name: /Connect/ }).first()).toBeVisible();
});

test("wallet: on the wrong network the page offers the switch", async ({ page }) => {
  // The wallet already authorised this site (eth_accounts answers), so it reconnects on load,
  // but it is on Ethereum mainnet: the page must say so and offer the switch, never claim 1952.
  await wallet(page, "wrong-chain");
  await page.goto("/credit");
  await expect(page.getByRole("button", { name: "Switch to X Layer testnet" }).first()).toBeVisible();
  await expect(page.locator(".header-tools")).not.toContainText("X Layer testnet");
});

test("credit: the borrow preview follows the input and nothing is sent", async ({ page }) => {
  await wallet(page, "ok");
  await page.goto("/credit");
  const ltv = page.locator(".zone-centre [role='tabpanel']:not([hidden])").getByText("LTV after").locator("xpath=following-sibling::*[1]");
  await page.getByLabel(/Collateral to add/).fill("40");
  await page.getByRole("button", { name: /^Session Max/ }).click();
  await page.getByLabel(/^Borrow \(/).fill("500");
  const a = (await ltv.innerText()).trim();
  await page.getByLabel(/^Borrow \(/).fill("1500");
  await expect(ltv).not.toHaveText(a);
  expect(await page.evaluate(() => (window as unknown as { __sent: number }).__sent)).toBe(0);
});

test("at 390 px no route scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const r of [...ROUTES, "/no-such-page"]) {
    await page.goto(r, { waitUntil: "networkidle" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), r).toBeLessThanOrEqual(0);
  }
});

test("reduced motion leaves the Tape still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const track = page.locator(".tape-track").first();
  await expect(track).toBeVisible();
  const a = await track.evaluate((e) => e.getBoundingClientRect().left);
  await page.waitForTimeout(1500);
  expect(await track.evaluate((e) => e.getBoundingClientRect().left)).toBe(a);
});

test("the header stays on screen, firms up on scroll, and the nav pill sits on the current page", async ({ page }) => {
  await page.goto("/methodology");
  await expect(page.locator(".nav-pill[data-on]")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 3000));
  await expect(page.locator(".site-header")).toHaveAttribute("data-scrolled", "");
  expect(await page.locator(".site-header").evaluate((e) => e.getBoundingClientRect().top)).toBe(0);
});
