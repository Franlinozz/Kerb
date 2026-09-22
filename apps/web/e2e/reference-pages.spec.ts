import { expect, test, type Page } from "@playwright/test";

/** Every element that sticks out past the viewport, ignoring content inside a scroller. */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
      let p: HTMLElement | null = el.parentElement, scrolled = false;
      while (p) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") { scrolled = true; break; } p = p.parentElement; }
      if (scrolled) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1) out.push(`${el.tagName}.${el.className} right=${Math.round(r.right)}`);
    }
    return out.slice(0, 5);
  });
}

for (const width of [390, 1440]) {
  test(`methodology: nothing wider than the viewport at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/methodology");
    for (const d of await page.locator(".params details").all()) await d.evaluate((e) => ((e as HTMLDetailsElement).open = true));
    expect(await overflowing(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}

test("methodology: the live regime rule is highlighted and the contents rail follows the scroll", async ({ page }) => {
  await page.goto("/methodology");
  await expect(page.locator(".regime-ladder li[data-live]")).toHaveCount(1);
  await page.locator("#parameters").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 10));
  await expect(page.locator('.spy a[aria-current="location"]')).toHaveText("Parameters");
});

test("proof: no verification cell reads a bare no, and every tile has a state and a link", async ({ page }) => {
  await page.goto("/proof");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kerb is independently verifiable.");
  const tiles = page.locator(".ptile");
  expect(await tiles.count()).toBeGreaterThanOrEqual(7);
  for (const t of await tiles.all()) {
    expect(await t.getAttribute("data-state")).toMatch(/ok|warn|info/);
    await expect(t.locator("a")).toHaveCount(1);
  }
  for (const cell of await page.locator(".ptable td").allTextContents()) expect(cell.trim().toLowerCase()).not.toBe("no");
});

test("developers: each tab shows a live response from the public API", async ({ page }) => {
  await page.goto("/developers");
  for (const name of ["SDK", "REST", "Solidity"]) {
    await page.getByRole("tab", { name }).click();
    await expect(page.getByRole("tabpanel").locator(".dev-live pre")).toContainText("{", { timeout: 15_000 });
  }
});
