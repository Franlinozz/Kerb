import { expect, test } from "@playwright/test";

/** The guided tour: offered on a first visit, walks across pages, and ends cleanly. */
test("tour: offered on the first visit, steps across pages, ends", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Take the tour" })).toBeVisible({ timeout: 8_000 });
  await page.getByRole("button", { name: "Take the tour" }).last().click();
  await expect(page.getByRole("dialog", { name: /Tour step 1 of/ })).toContainText("Credit on the market's clock");
  await page.locator(".tour-card").getByRole("button", { name: "Next" }).click();
  await page.locator(".tour-card").getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/board/);
  await expect(page.getByRole("dialog", { name: /Tour step 3 of/ })).toContainText("The Board");
  await page.locator(".tour-card").getByRole("button", { name: "End tour" }).click();
  await expect(page.locator(".tour-card")).toHaveCount(0);
  await page.goto("/");
  await page.waitForTimeout(3_000);
  await expect(page.locator(".tour-offer")).toHaveCount(0);
});
