import { expect, test } from "@playwright/test";
import { brand } from "../src/config/brand";
import { HOME, messageText } from "./helpers";

test("home page loads and shows its headline and title", async ({ page }) => {
  await page.goto(HOME);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(messageText("en", "landing.hero.title"));
  await expect(page).toHaveTitle(messageText("en", "landing.meta.title").replace("{brand}", brand.name));
});

test("nothing scrolls sideways at 360px", async ({ page }) => {
  await page.goto(HOME);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
