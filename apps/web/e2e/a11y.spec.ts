import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/board", "/asset/BRK.Bx", "/credit", "/research", "/research/1", "/methodology", "/proof", "/developers", "/no-such-page"];

for (const theme of ["night", "day"]) {
  for (const route of ROUTES) {
    test(`axe: ${route} in ${theme} has no serious or critical violation`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("kerb-theme", t), theme);
      await page.goto(route, { waitUntil: "networkidle" });
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      expect(bad).toEqual([]);
    });
  }
}
