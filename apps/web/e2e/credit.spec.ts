import { expect, test } from "@playwright/test";

test.describe("Credit", () => {
  test("says testnet, shows the demo clock, and reads without a wallet", async ({ page }) => {
    await page.goto("/credit");
    await expect(page.getByText("Kerb Credit · X Layer testnet 1952 · demo clock")).toBeVisible();
    await expect(page.locator(".rail-demo")).toBeVisible();
    await expect(page.locator(".rail-demo .rail-next strong")).not.toHaveText(/—|^-/);
    await expect(page.getByRole("button", { name: "Connect a wallet" })).toBeVisible();
    await expect(page.getByText("No wallet connected")).toBeVisible();
    await expect(page.locator(".coll-card")).toHaveCount(2);
    await expect(page.locator(".pool-strip")).toContainText("Supplied");
  });

  test("the testnet drawer names every contract and closes on Escape", async ({ page }) => {
    await page.goto("/credit");
    await page.getByRole("button", { name: /Testnet · mirror collateral/ }).click();
    const drawer = page.getByRole("dialog", { name: "About this testnet market" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("KerbCredit");
    await expect(drawer).toContainText("liquidation threshold three points above mainnet");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("the mode question and the action tabs work from the keyboard", async ({ page }) => {
    await page.goto("/credit");
    const carry = page.getByRole("button", { name: /^Carry/ });
    await carry.focus();
    await page.keyboard.press("Enter");
    await expect(carry).toHaveAttribute("aria-pressed", "true");
    const borrowTab = page.getByRole("tab", { name: "Borrow" });
    await borrowTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Supply" })).toHaveAttribute("aria-selected", "true");
  });

  test("the curable table says when the next Last Call is, or lists positions", async ({ page }) => {
    await page.goto("/credit");
    const section = page.locator(".curable");
    await expect(section).toBeVisible();
    await expect(section).toContainText(/Last Call/);
  });
});
