import { expect, test } from "@playwright/test";

/**
 * V3-04: every term explains itself. The "why" sentences and the change timeline come from the
 * API's attribution, never from a template left unfilled, and every sentence carries a ProvMark.
 */
test("asset: why these terms, with a ProvMark per sentence, and the change timeline or its empty state", async ({ page }) => {
  await page.goto("/asset/BRK.Bx");
  const why = page.locator(".why-block");
  await expect(why).toBeVisible();
  const items = why.locator(".why-list li");
  const n = await items.count();
  if (n > 0) {
    for (let i = 0; i < n; i++) await expect(items.nth(i).locator(".prov")).toHaveCount(1);
  } else {
    await expect(why).toContainText(/could not be read|not under KTS 0\.2|not retrievable|No explanation/);
  }
  await page.getByRole("tab", { name: "Terms history" }).click();
  const tl = page.locator(".change-tl");
  await expect(tl).toBeVisible();
  const rows = await tl.locator(".change-list li").count();
  if (rows > 0) await expect(tl.locator(".change-list li").first().locator(".prov")).toHaveCount(1);
  else await expect(tl).toContainText(/No material change|could not be read/);
});

test("no template placeholder reaches the page", async ({ page }) => {
  for (const route of ["/", "/board", "/asset/BRK.Bx", "/asset/HKEXCx", "/credit"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle").catch(() => {});
    const text = await page.evaluate(() => {
      const out: string[] = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        if (!el || el.closest("pre, code, script, style")) continue;
        if (/\{[a-zA-Z_]+\}|undefined|NaN/.test(n.textContent ?? "")) out.push((n.textContent ?? "").slice(0, 80));
      }
      return out;
    });
    expect(text, route).toEqual([]);
  }
});

test("board: the Terms cell explains itself on hover", async ({ page }) => {
  await page.goto("/board");
  const cell = page.locator(".terms-hover").first();
  await cell.hover();
  await expect(page.locator(".terms-card")).toContainText("Why these terms");
});
