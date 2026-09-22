import { expect, test } from "@playwright/test";

test.describe("Board", () => {
  test("the market filter narrows the rows and lives in the URL", async ({ page }) => {
    await page.goto("/board");
    const rows = page.locator(".board-table tbody tr");
    const total = await rows.count();
    expect(total).toBeGreaterThan(5);
    await page.getByRole("radio", { name: "Hong Kong" }).click();
    await expect(page).toHaveURL(/market=hk/);
    const hk = await rows.count();
    expect(hk).toBeGreaterThan(0);
    expect(hk).toBeLessThan(total);
    for (const t of await page.locator(".board-table tbody tr .dt-under").allTextContents()) expect(t).toContain("XHKG");
    await page.getByRole("radio", { name: "All" }).click();
    await expect(rows).toHaveCount(total);
  });

  test("sorting sets aria-sort and reorders", async ({ page }) => {
    await page.goto("/board");
    const head = page.locator("th", { has: page.getByRole("button", { name: /^Asset/ }) });
    await head.getByRole("button").click();
    await expect(head).toHaveAttribute("aria-sort", "descending");
    const first = await page.locator(".board-table tbody tr .dt-tick").first().textContent();
    await head.getByRole("button").click();
    await expect(head).toHaveAttribute("aria-sort", "ascending");
    const firstAsc = await page.locator(".board-table tbody tr .dt-tick").first().textContent();
    expect(firstAsc).not.toBe(first);
  });

  test("a row click opens the asset", async ({ page }) => {
    await page.goto("/board");
    const sym = (await page.locator(".board-table tbody tr .dt-tick").first().textContent())?.trim() ?? "";
    await page.locator(".board-table tbody tr td:nth-child(3)").first().click();
    await expect(page).toHaveURL(new RegExp(`/asset/${sym.replace(".", "\\.")}`));
    await expect(page.locator("h1")).toHaveText(sym);
  });
});

test.describe("Asset", () => {
  test("tabs switch by click and arrow keys, and the hash follows", async ({ page }) => {
    await page.goto("/asset/KOx");
    await page.getByRole("tab", { name: "Liquidity" }).click();
    await expect(page).toHaveURL(/#liquidity$/);
    await expect(page.getByRole("tabpanel", { name: "Liquidity" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Mark" })).toHaveAttribute("aria-selected", "true");
    await page.goto("/asset/KOx#onchain");
    await expect(page.getByRole("tab", { name: "Onchain" })).toHaveAttribute("aria-selected", "true");
  });

  test("copy buttons copy the full value", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/asset/KOx#onchain");
    const btn = page.getByRole("tabpanel", { name: "Onchain" }).getByRole("button", { name: "Copy inputs hash" });
    await btn.click();
    await expect(page.getByRole("tabpanel", { name: "Onchain" }).getByRole("button", { name: "Copied" }).first()).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("an unknown symbol is the not-found page", async ({ page }) => {
    const r = await page.goto("/asset/NOPEx");
    expect(r?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("No market");
  });
});
