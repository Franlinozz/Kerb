import { expect, test } from "@playwright/test";

/** V3 profile: without a wallet the page says how to use it; with ?addr= it reads that address. */
test("account: empty without a wallet, with the lookup form", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByText("Connect a wallet to see your account")).toBeVisible();
  await expect(page.getByLabel("Look up any address")).toBeVisible();
});

test("account: any address through ?addr=, holdings and history read from chain", async ({ page }) => {
  await page.goto("/account?addr=0x66AE377c2441d85c2B08A7e14B331A5dbaeE9EC0");
  await expect(page.getByRole("heading", { name: /Holdings/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".acct-activity li").first()).toContainText(/Cured|Repaid|Borrowed|Deposited|Supplied/);
});

test("docs: every section is there", async ({ page }) => {
  await page.goto("/docs");
  for (const id of ["overview", "concepts", "borrow", "rest", "contracts", "agents", "verify", "addresses", "limits", "glossary"]) await expect(page.locator(`#${id}`)).toBeAttached();
});
