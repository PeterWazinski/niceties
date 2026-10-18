import { test, expect } from "@playwright/test";
import { openGame, cell, values } from "./helpers.js";

// Screenshot baselines of the Black & White layout, one per device project.
test("visual: B/W layout with a selection", async ({ page }, info) => {
  await openGame(page);
  const v = await values(page);
  await cell(page, v.findIndex((x) => x !== "")).click();
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(info.project.name + "-bw.png", { maxDiffPixelRatio: 0.02, animations: "disabled" });
});
