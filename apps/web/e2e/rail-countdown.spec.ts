import { expect, test } from "@playwright/test";

/**
 * V2-05 acceptance: the rail's countdown never shows a dash or a negative number across a
 * transition. The page clock is set five seconds before the real next transition; when it
 * passes, the rail must say "Updating" until the refetched Clock (mocked here, slowed down so the
 * state is observable) arrives with the following transition.
 */
test.use({ video: process.env["KERB_E2E_VIDEO"] ? { mode: "on", size: { width: 1440, height: 900 } } : "off" });

test("the countdown never shows a dash across a transition", async ({ page, request }) => {
  const api = process.env["KERB_API_PUBLIC"] ?? "https://api.usekerb.xyz";
  const real = await (await request.get(`${api}/v1/clock/196/KOx`)).json();
  const nextAt = Date.parse(real.clock.nextTransition.at);
  const later = { ...real, clock: { ...real.clock, nextTransition: { ...real.clock.nextTransition, at: new Date(nextAt + 2 * 3600_000).toISOString(), atMs: nextAt + 2 * 3600_000 } } };

  // Until the page clock passes the transition the API answers as it does today (the header's
  // market clocks share this query); after it, with the following transition, slowly.
  let passed = false;
  let served = 0;
  await page.route("**/v1/clock/196/KOx**", async (route) => {
    if (!passed) return route.fulfill({ json: real });
    served++;
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({ json: later });
  });

  await page.clock.install({ time: nextAt - 5000 });
  await page.goto("/asset/KOx");
  await expect(page.locator(".rail-full .rail-next strong").first()).toBeVisible();
  await page.evaluate(() => document.querySelector(".rail-full")?.scrollIntoView({ block: "center" }));
  const count = page.locator(".rail-full .rail-next strong").first();
  await expect(count).toBeVisible();

  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.clock.runFor(1000);
    if (process.env["KERB_E2E_VIDEO"]) await page.waitForTimeout(600);
    if (i === 4) passed = true;
    const t = (await count.textContent())?.trim() ?? "";
    seen.push(t);
    expect(t, `tick ${i}`).not.toMatch(/—|^-|\s-\d/);
  }
  // Before the transition a real countdown, around it "Updating", then the next transition's countdown.
  expect(seen.some((t) => /^\d+s$/.test(t))).toBe(true);
  expect(seen).toContain("Updating");
  await page.clock.resume();
  await expect.poll(async () => (await count.textContent())?.trim(), { timeout: 15_000 }).toMatch(/^(1h 5\d|2h 00)m$/);
  expect(served).toBeGreaterThan(0);
});
