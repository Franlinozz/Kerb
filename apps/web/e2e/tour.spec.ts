import { expect, test } from "@playwright/test";

/** The guided tour: offered on a first visit, walks across pages, and ends cleanly. */
test("tour: offered on the first visit, steps across pages, ends", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Take the tour" })).toBeVisible({ timeout: 8_000 });
  await page.locator(".tour-offer").getByRole("button", { name: "Start the tour" }).click();
  await expect(page.getByRole("dialog", { name: /Tour step 1 of/ })).toContainText("Credit on the market's clock");
  await page.locator(".tour-card").getByRole("button", { name: "Next" }).click();
  await page.locator(".tour-card").getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/board/);
  await expect(page.getByRole("dialog", { name: /Tour step 3 of/ })).toContainText("The Board");
  await page.locator(".tour-card").getByRole("button", { name: "End", exact: true }).click();
  await expect(page.locator(".tour-card")).toHaveCount(0);
  await expect(page.locator(".tour-ring")).toHaveCount(0);
  await page.goto("/");
  await page.waitForTimeout(3_000);
  await expect(page.locator(".tour-offer")).toHaveCount(0);
});

test("tour: the last step opens the closing card with next steps", async ({ page }) => {
  await page.goto("/developers");
  await page.evaluate(() => { sessionStorage.setItem("kerb-tour-step", "7"); localStorage.setItem("kerb-tour-seen", "1"); });
  await page.reload();
  const card = page.getByRole("dialog", { name: /Tour step 8 of 8/ });
  await expect(card).toContainText("Build on it", { timeout: 10_000 });
  await card.getByRole("button", { name: "Finish" }).click();
  const fin = page.getByRole("dialog", { name: "Tour complete" });
  await expect(fin).toBeVisible();
  await expect(fin.getByRole("link", { name: /Borrow on testnet/ })).toHaveAttribute("href", "/credit");
  await page.keyboard.press("Escape");
  await expect(fin).toHaveCount(0);
});
