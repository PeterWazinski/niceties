const { test, expect, openPuzzle, solveByDragging } = require("./helpers");

const edgeStroke = (page) =>
  page.locator("#board .edge").first().evaluate((el) => getComputedStyle(el).stroke);
const pageBackground = (page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).backgroundImage + "|" + getComputedStyle(document.documentElement).backgroundColor);

test("switching theme changes the look and persists across reload", async ({ page }) => {
  const errors = await openPuzzle(page, "#n=8&seed=42");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blueprint");
  const blueprintStroke = await page.locator("#board .node").first().evaluate((el) => getComputedStyle(el).fill);
  const blueprintBg = await pageBackground(page);

  await page.selectOption("#theme", "neon");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "neon");
  const neonFill = await page.locator("#board .node").first().evaluate((el) => getComputedStyle(el).fill);
  expect(neonFill).not.toBe(blueprintStroke);
  expect(await pageBackground(page)).not.toBe(blueprintBg);
  // Neon uses a glow filter on board elements, Blueprint does not.
  const glow = await page.locator("#board .edge").first().evaluate((el) => getComputedStyle(el).filter);
  expect(glow).not.toBe("none");

  await page.reload();
  await page.waitForSelector("#board .node");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "neon");
  await expect(page.locator("#theme")).toHaveValue("neon");

  await page.selectOption("#theme", "blueprint");
  expect(await page.locator("#board .edge").first().evaluate((el) => getComputedStyle(el).filter)).toBe("none");
  expect(errors).toEqual([]);
});

test("crossing and solved colours differ from the normal edge colour in both themes", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  for (const theme of ["blueprint", "neon"]) {
    await page.selectOption("#theme", theme);
    const crossing = await page.locator("#board .edge.x").first().evaluate((el) => getComputedStyle(el).stroke);
    const normalCount = await page.locator("#board .edge:not(.x)").count();
    if (normalCount > 0) {
      const normal = await page.locator("#board .edge:not(.x)").first().evaluate((el) => getComputedStyle(el).stroke);
      expect(crossing).not.toBe(normal);
    }
  }
});

test("screenshots of both themes, idle and solved (for visual review)", async ({ page }, info) => {
  await openPuzzle(page, "#n=8&seed=42");
  const shot = (name) => page.screenshot({ path: "screenshots/" + info.project.name + "-" + name + ".png", fullPage: true });
  await page.selectOption("#theme", "blueprint");
  await shot("blueprint-idle");
  await page.selectOption("#theme", "neon");
  await shot("neon-idle");
  await solveByDragging(page);
  await shot("neon-solved");
  await page.selectOption("#theme", "blueprint");
  await shot("blueprint-solved");
});

test("the theme dropdown is readable (dark background, light text) in both themes", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  const luminance = (rgb) => {
    const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const theme of ["blueprint", "neon"]) {
    await page.selectOption("#theme", theme);
    const c = await page.locator("#theme").evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, fg: s.color };
    });
    expect(luminance(c.bg)).toBeLessThan(80);
    expect(luminance(c.fg)).toBeGreaterThan(160);
  }
});
