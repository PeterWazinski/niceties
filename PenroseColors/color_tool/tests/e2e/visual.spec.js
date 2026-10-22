import { test, expect } from "@playwright/test";
import { openTool } from "./helpers.js";

// Screenshot baselines of the board for three colourings, one per device project.
const CASES = {
  "plane-wheel": "?depth=3",
  "radial-half": "?seed=half&depth=4&map=radial&h0=30&h1=330&ds=30&dl=-20",
  "angular-fan": "?seed=fan&depth=4&map=angular&rot=40&s=75&l=55"
};

for (const [name, query] of Object.entries(CASES)) {
  test("visual: " + name, async ({ page }, info) => {
    await openTool(page, query);
    await page.mouse.move(0, 0);
    await expect(page.locator("#board")).toHaveScreenshot(`${info.project.name}-${name}.png`, { maxDiffPixelRatio: 0.02, animations: "disabled" });
  });
}
