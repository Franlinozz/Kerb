import { expect, test, type Page } from "@playwright/test";

/**
 * V3-01, docs/v3/V3-LIVE-AUDIT.md L-01 and L-02. A judge who opens a live page cold must never be
 * shown an old value as current: the first paint is either under 60 s old or visibly Refreshing,
 * and within 5 s the page is fresh. Runs against the fixture API in CI and against production
 * with e2e:live. The lag scenario (an ISR page rendered hours ago) needs the fixture API's
 * server-lag control, so it runs only where KERB_API_PUBLIC points at the fixture server.
 */
const LIVE = ["/", "/board", "/credit", "/proof", "/methodology", "/asset/BRK.Bx"];
const ALL = [...LIVE, "/research", "/research/1", "/developers", "/changelog"];
const FIXTURE = process.env["KERB_API_PUBLIC"] ?? "";
const isFixture = /127\.0\.0\.1:8799/.test(FIXTURE);
const SHOTS = "../../data/screens/v3/freshness";

const asOfAge = async (page: Page): Promise<number | null> => {
  const s = await page.locator("[data-asof]").first().getAttribute("data-asof").catch(() => null);
  return s ? Date.now() - Date.parse(s) : null;
};
const state = (page: Page): Promise<string | null> => page.locator("[data-fresh]").first().getAttribute("data-fresh");

for (const route of LIVE) {
  test(`${route}: first paint is fresh or Refreshing, and fresh within 5 s`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const first = await asOfAge(page);
    expect(first, "every live route stamps data-asof").not.toBeNull();
    const stale = (first as number) > 60_000;
    if (stale) {
      // Stale on arrival: the guard must say so as soon as the page hydrates.
      await expect(page.locator(".live-guard")).toBeVisible({ timeout: 3_000 });
    }
    // Fresh within 5 s. A stale server-only page waits on an ISR regeneration, which the warmer
    // makes rare in production; there it may take the guard's whole 15 s grace.
    await expect.poll(async () => (await state(page)) === "fresh" && ((await asOfAge(page)) ?? 0) < 60_000 ? "fresh" : "stale", { timeout: stale ? 15_000 : 5_000 }).toBe("fresh");
  });
}

test("no raw enum (UPPER_SNAKE) is visible outside code on any route (L-02)", async ({ page }) => {
  for (const route of ALL) {
    await page.goto(route);
    await page.waitForLoadState("networkidle").catch(() => {});
    const hits = await page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || el.closest("pre, code, script, style, [aria-hidden='true'], .mono-code")) continue;
        if (!el.checkVisibility?.()) continue;
        const m = (n.textContent ?? "").match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b(?!\.\w)/g); // BUILD_PERIOD.md is a file name
        if (m) out.push(...m);
      }
      return out;
    });
    expect(hits, `raw enum on ${route}`).toEqual([]);
  }
});

test.describe("an ISR page rendered hours ago (fixture API only)", () => {
  test.skip(!isFixture, "needs the fixture API's server-lag control");
  test.setTimeout(180_000);
  test.afterAll(async ({ request }) => { await request.post(`${FIXTURE}/__lag?ms=0`); });

  test("Board refreshes from the client; Proof admits Last known with Retry", async ({ page, request }) => {
    await request.post(`${FIXTURE}/__lag?ms=${3 * 3600_000}`);
    // Let Next's data cache and the ISR page both regenerate from the lagged answers.
    for (const route of ["/board", "/proof"]) {
      await expect.poll(async () => {
        const html = await (await request.get(route)).text();
        const m = html.match(/data-asof="([^"]+)"/);
        return m ? Date.now() - Date.parse(m[1] as string) : 0;
      }, { timeout: 90_000, intervals: [2_000] }).toBeGreaterThan(3_600_000);
    }

    await page.goto("/board", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".live-guard")).toContainText("Refreshing live data", { timeout: 3_000 });
    await page.screenshot({ path: `${SHOTS}/board-refreshing.png` });
    // The Board's own query refetches at once from the browser, which the lag does not touch.
    await expect(page.locator("[data-fresh]").first()).toHaveAttribute("data-fresh", "fresh", { timeout: 5_000 });
    await expect(page.locator(".live-line")).toContainText(/Updated \d+s ago/);

    await page.goto("/proof", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".live-guard")).toContainText("Refreshing live data", { timeout: 3_000 });
    await expect(page.locator(".live-guard")).toContainText(/Last known, \d+h \d+m old/, { timeout: 25_000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/proof-last-known.png` });
  });
});
