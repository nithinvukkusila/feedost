// UX-review-fixes-2, accessibility A.1 to A.4, on the screens PR2 and PR3 touch: Home, Students, Add and Edit student,
// Batches, Batch, Move students, Mark paid, Receipt, More and Language. At 360px against the fake host; the clock is
// the board fixture's (12 Oct 2026).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { MATHS, S, signedIn } from "./board-fixture";
import { localeNames } from "../src/config/locales";
import { stubPayments } from "./pay-helpers";

type Screen = { name: string; open: (page: Page) => Promise<Locator> };

const main = (page: Page) => page.locator("body");

async function board(page: Page) {
  const { dues } = await signedIn(page);
  await stubPayments(page, dues);
}

const SCREENS: Screen[] = [
  {
    name: "Home",
    open: async (page) => {
      await board(page);
      await page.goto("/en/home/");
      await expect(page.locator("h1")).toBeVisible();
      return main(page);
    },
  },
  {
    name: "Students",
    open: async (page) => {
      await board(page);
      await page.goto("/en/students/");
      await expect(page.getByRole("searchbox").or(page.getByLabel(/Search/)).first()).toBeVisible();
      return main(page);
    },
  },
  {
    name: "Add student",
    open: async (page) => {
      await board(page);
      await page.goto("/en/students/new/");
      await expect(page.getByLabel("Student's name")).toBeVisible();
      return main(page);
    },
  },
  {
    name: "Edit student",
    open: async (page) => {
      await board(page);
      await page.goto(`/en/students/edit/?id=${S.ravi}`);
      await expect(page.getByLabel("Student's name")).toHaveValue("Ravi Kumar");
      return main(page);
    },
  },
  {
    name: "Batches",
    open: async (page) => {
      await board(page);
      await page.goto("/en/batches/");
      await expect(page.locator("h1")).toBeVisible();
      return main(page);
    },
  },
  {
    name: "Batch",
    open: async (page) => {
      await board(page);
      await page.goto(`/en/batches/edit/?id=${MATHS}`);
      await expect(page.getByRole("button", { name: "Move students" })).toBeVisible();
      return main(page);
    },
  },
  {
    name: "Move students",
    open: async (page) => {
      await board(page);
      await page.goto(`/en/batches/edit/?id=${MATHS}`);
      await page.getByRole("button", { name: "Move students" }).click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      return sheet;
    },
  },
  {
    name: "Mark paid",
    open: async (page) => {
      await board(page);
      await page.goto("/en/home/");
      await page.getByRole("button", { name: "Mark paid, Ravi Kumar" }).first().click();
      const sheet = page.getByRole("dialog", { name: "Mark paid" });
      await expect(sheet).toBeVisible();
      return sheet;
    },
  },
  {
    name: "Receipt",
    open: async (page) => {
      await board(page);
      await page.goto("/en/home/");
      await page.getByRole("button", { name: "Mark paid, Ravi Kumar" }).first().click();
      await page.getByRole("dialog", { name: "Mark paid" }).getByRole("button", { name: "Mark as paid" }).click();
      await page.locator("[data-kind='undo']").getByRole("link", { name: "View receipt" }).click();
      await expect(page.locator("h1")).toHaveText("Receipt");
      return main(page);
    },
  },
  {
    name: "More",
    open: async (page) => {
      await board(page);
      await page.goto("/en/more/");
      await expect(page.locator("h1")).toHaveText("More");
      return main(page);
    },
  },
  {
    name: "Language",
    open: async (page) => {
      await board(page);
      await page.goto("/en/language/");
      await expect(page.getByRole("link", { name: new RegExp(localeNames.hi) })).toBeVisible();
      return main(page);
    },
  },
];

/** Every form control in the scope whose name does not come from a <label> or aria-labelledby with words in it. */
function unlabelled(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) => {
    const text = (el: Element | null) => (el?.textContent ?? "").trim();
    const bad: string[] = [];
    for (const el of root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
      if (el instanceof HTMLInputElement && el.type === "hidden") continue;
      const byLabel = Array.from(el.labels ?? []).some((label) => text(label) !== "");
      const ids = (el.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean);
      const byLabelledBy = ids.some((id) => text(document.getElementById(id)) !== "");
      if (!byLabel && !byLabelledBy) bad.push(el.outerHTML.slice(0, 120));
    }
    return bad;
  });
}

/** Every visible control (or, for a tick or radio, the label that is its target) under 44 by 44px. */
function smallControls(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) => {
    const small: string[] = [];
    const seen = new Set<Element>();
    for (const el of root.querySelectorAll<HTMLElement>("button, a[href], select, textarea, input:not([type=hidden])")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const tickLike = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio");
      const target = tickLike ? (el.closest("label") ?? el.labels?.[0] ?? el) : el;
      if (seen.has(target)) continue;
      seen.add(target);
      const r = target.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < 43.5 || r.height < 43.5) small.push(`${Math.round(r.width)}x${Math.round(r.height)} ${target.outerHTML.slice(0, 120)}`);
    }
    return small;
  });
}

/**
 * Tabs through the scope and returns every focused control that shows no ring: no outline of at least 2px on it or on
 * the box around it (a tick's label, a select's line), and, for a text field, no line grown to 4px.
 */
async function ringless(page: Page, scope: Locator): Promise<string[]> {
  const missing: string[] = [];
  const visited = new Set<string>();
  // Start from the scope's first focusable control, by keyboard, so :focus-visible applies.
  await scope.evaluate((root) => {
    const first = root.querySelector<HTMLElement>("button, a[href], select, textarea, input:not([type=hidden])");
    first?.focus();
  });
  await page.keyboard.press("Shift+Tab");
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const found = await scope.evaluate((root) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || !root.contains(el)) return null;
      const key = el.outerHTML.slice(0, 160);
      const ringed = (node: Element | null) => {
        if (!node) return false;
        const s = getComputedStyle(node);
        return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2;
      };
      let node: Element | null = el;
      for (let up = 0; up < 3 && node; up++, node = node.parentElement) if (ringed(node)) return { key, ok: true };
      // A text field's focus mark is its line grown to 4px (docs/DESIGN.md, Field).
      const line = el.parentElement ? getComputedStyle(el.parentElement) : null;
      if ((el.tagName === "TEXTAREA" || el.tagName === "INPUT") && line && parseFloat(line.borderBottomWidth) >= 4) return { key, ok: true };
      return { key, ok: false };
    });
    if (found === null) continue;
    if (visited.has(found.key)) break;
    visited.add(found.key);
    if (!found.ok) missing.push(found.key);
  }
  expect(visited.size, "the keyboard reached no control").toBeGreaterThan(0);
  return missing;
}

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    test(`A.1: every input, select and textarea is named by a <label> or aria-labelledby`, async ({ page }) => {
      const scope = await screen.open(page);
      expect(await unlabelled(scope)).toEqual([]);
      for (const control of await scope.locator("input:not([type=hidden]), select, textarea").all()) {
        await expect(control).toHaveAccessibleName(/\S/);
      }
    });

    test(`A.4: every control is at least 44 by 44px and shows a focus ring by keyboard`, async ({ page }) => {
      const scope = await screen.open(page);
      expect(await smallControls(scope)).toEqual([]);
      expect(await ringless(page, scope)).toEqual([]);
    });
  });
}

test.describe("A.2: the Send messages in radios", () => {
  test("each is read with its own name and its name in the page's language; the extra name is screen-reader only", async ({ page }) => {
    await board(page);
    await page.goto("/en/students/new/");
    await expect(page.getByRole("radio", { name: "ಕನ್ನಡ, Kannada" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "हिन्दी, Hindi" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "తెలుగు, Telugu" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "English", exact: true })).toBeVisible();
    const extra = page.locator("form .sr-only").filter({ hasText: "ಕನ್ನಡ, Kannada" });
    await expect(extra).toHaveCount(1);
    expect(await extra.evaluate((el) => (el.getBoundingClientRect().width <= 1 ? "hidden" : "shown"))).toBe("hidden");
  });
});

test.describe("A.3: toasts and notices are live", () => {
  test("Saved, the Undo banner and the write notices sit in a live region that is always there", async ({ page }) => {
    await board(page);
    await page.goto("/en/students/new/");
    // Present before anything is said, so the words are announced when they arrive.
    await expect(page.locator("[data-saved-toast][aria-live='polite']")).toHaveCount(1);
    await expect(page.locator("form [aria-live='polite']")).toHaveCount(1);
    await page.getByLabel("Student's name").fill("Ravi");
    await page.getByLabel("Monthly fee ₹").fill("1000");
    await page.getByRole("button", { name: "Save and add another" }).click();
    await expect(page.locator("[data-saved-toast]").getByRole("status")).toContainText("Saved Ravi.");

    await page.goto("/en/home/");
    await page.getByRole("button", { name: "Mark paid, Ravi Kumar" }).first().click();
    await page.getByRole("dialog", { name: "Mark paid" }).getByRole("button", { name: "Mark as paid" }).click();
    const undo = page.locator("[data-kind='undo']");
    await expect(undo).toHaveAttribute("role", "status");
    await expect(undo.locator("xpath=..")).toHaveAttribute("aria-live", "polite");
  });
});
