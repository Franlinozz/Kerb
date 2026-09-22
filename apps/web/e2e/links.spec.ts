import { expect, test } from "@playwright/test";

/** Every internal link on every route answers, and every #anchor exists (or is a hash tab). */
const ROUTES = ["/", "/board", "/asset/BRK.Bx", "/credit", "/research", "/research/1", "/methodology", "/proof", "/developers", "/changelog"];
const HASH_TABS = new Set(["overview", "liquidity", "mark", "history", "onchain", "sdk", "rest", "solidity", "main"]);

test("no dead internal link or anchor", async ({ page, request }) => {
  test.setTimeout(240_000);
  const links = new Map<string, string>();
  for (const r of ROUTES) {
    await page.goto(r, { waitUntil: "networkidle" });
    for (const h of await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""))) {
      if (h.startsWith("/") || h.startsWith("#")) links.set(h.startsWith("#") ? r + h : h, r);
    }
  }
  const bad: string[] = [];
  for (const [href, from] of links) {
    const [path = "/", hash] = href.split("#");
    const res = await request.get(path || "/");
    if (res.status() >= 400) { bad.push(`${href} ${res.status()} from ${from}`); continue; }
    if (hash && !HASH_TABS.has(hash)) {
      await page.goto(href, { waitUntil: "networkidle" });
      if (!(await page.$(`[id="${hash}"]`))) bad.push(`${href} has no #${hash} (from ${from})`);
    }
  }
  expect(bad).toEqual([]);
});
