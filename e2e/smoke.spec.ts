import { expect, test } from "@playwright/test";
import { brand } from "../src/config/brand";

test("home page loads and shows the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(brand.name);
  await expect(page).toHaveTitle(brand.name);
});

test("nothing scrolls sideways at 360px", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
