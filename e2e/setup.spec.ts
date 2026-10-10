// Spec R1-1, setup steps 1 and 2 (criteria 21 to 31). Runs against a build made with the CI's made-up
// Supabase address; Playwright answers every request to it and keeps the tutor's row in a small object
// (see auth-helpers.ts), so a save is proved by what the browser sent and what the next screen shows.
import { expect, test, type Page } from "@playwright/test";
import { brand } from "../src/config/brand";
import { USER_ID, completeTutor, newTutor, seedSession, stubSupabase, type Stub } from "./auth-helpers";
import { box, css, messageText } from "./helpers";

const ORIGIN = "http://localhost:4173";
const alertText = (page: Page) => page.locator('[role="alert"][data-kind="error"]');
const nameBox = (page: Page) => page.getByRole("textbox", { name: /Your name/ });
const upiBox = (page: Page) => page.getByRole("textbox", { name: /Your UPI ID/ });
const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const next = (page: Page) => page.getByRole("button", { name: "Next: your UPI ID" });
const patchesOf = (stub: Stub) => stub.where((r) => r.method === "PATCH" && r.path === "/rest/v1/tutors");

async function signedInNewTutor(page: Page, path = "/en/setup/profile/") {
  const stub = await stubSupabase(page, { tutor: newTutor() });
  await seedSession(page);
  await page.goto(path);
  await expect(page.locator("h1")).toBeVisible();
  return stub;
}

test.describe("21: step 1 shows", () => {
  test("the step, the title, the body, an empty name field, seven chips, + Other and the black Next button; no photo", async ({ page }) => {
    await signedInNewTutor(page);
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("What should parents call you?");
    await expect(page.getByText("This name goes on every reminder, pay page and receipt.")).toBeVisible();
    await expect(nameBox(page)).toHaveValue("");
    for (const subject of ["Maths", "Science", "English", "Hindi", "Physics", "Chemistry", "Accounts"]) {
      await expect(chip(page, subject)).toHaveAttribute("aria-pressed", "false");
      expect((await box(chip(page, subject))).height).toBeGreaterThanOrEqual(44);
    }
    await expect(chip(page, "+ Other")).toBeVisible();
    expect((await css(next(page), ["background-color"]))["background-color"]).toBe("rgb(26, 20, 16)");
    await expect(page.getByText(/photo/i)).toHaveCount(0);
  });

  test("the name starts empty even though the Google account has a name", async ({ page }) => {
    await signedInNewTutor(page);
    await expect(nameBox(page)).toHaveValue("");
    await expect(page.getByText("meena@example.com")).toHaveCount(0);
  });
});

test.describe("22, 23: what is wrong is said in words", () => {
  test("Next with nothing typed says Missing, what to type, and to pick a subject; nothing is sent", async ({ page }) => {
    const stub = await signedInNewTutor(page);
    await next(page).click();
    await expect(page.getByText("Type your name.")).toBeVisible();
    await expect(page.getByText("Missing", { exact: true })).toBeVisible();
    await expect(page.getByText("Pick at least one subject.")).toBeVisible();
    expect(patchesOf(stub)).toHaveLength(0);
    expect(page.url()).toBe(`${ORIGIN}/en/setup/profile/`);
  });

  test("81 characters say Too long and how many to use", async ({ page }) => {
    await signedInNewTutor(page);
    await chip(page, "Maths").click();
    await nameBox(page).fill("a".repeat(81));
    await next(page).click();
    await expect(page.getByText("Use 80 characters or fewer.")).toBeVisible();
    await expect(page.getByText("Too long", { exact: true })).toBeVisible();
  });

  test("a chip is a toggle with aria-pressed and a tick", async ({ page }) => {
    await signedInNewTutor(page);
    await chip(page, "Maths").click();
    await expect(chip(page, "Maths")).toHaveAttribute("aria-pressed", "true");
    expect(await chip(page, "Maths").locator("svg").count()).toBe(1);
    expect(await chip(page, "Science").locator("svg").count()).toBe(0);
    await chip(page, "Maths").click();
    await expect(chip(page, "Maths")).toHaveAttribute("aria-pressed", "false");
  });

  test("+ Other opens a one-line field; Add makes the subject a chip; the field closes", async ({ page }) => {
    await signedInNewTutor(page);
    await chip(page, "+ Other").click();
    const other = page.getByRole("textbox", { name: /Another subject/ });
    await expect(other).toBeFocused();
    await other.fill("Sanskrit");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(chip(page, "Sanskrit")).toHaveAttribute("aria-pressed", "true");
    await expect(other).toHaveCount(0);
  });

  test("a ninth subject says what to do", async ({ page }) => {
    await signedInNewTutor(page);
    for (const subject of ["Maths", "Science", "English", "Hindi", "Physics", "Chemistry", "Accounts"]) await chip(page, subject).click();
    for (const extra of ["Sanskrit", "Drawing"]) {
      await chip(page, "+ Other").click();
      await page.getByRole("textbox", { name: /Another subject/ }).fill(extra);
      await page.getByRole("button", { name: "Add", exact: true }).click();
    }
    await expect(page.getByText("Use up to 8 subjects, each short. Remove one or shorten a name.")).toBeVisible();
  });
});

test.describe("25: Next saves and goes to step 2", () => {
  test("sends only the granted columns, with the tutor's token, then shows step 2", async ({ page }) => {
    const stub = await signedInNewTutor(page);
    await nameBox(page).fill("  Meena    Iyer ");
    await chip(page, "Maths").click();
    await chip(page, "Science").click();
    await chip(page, "+ Other").click();
    await page.getByRole("textbox", { name: /Another subject/ }).fill("Sanskrit");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await next(page).click();
    await expect(page).toHaveURL(/\/en\/setup\/upi\/$/);
    const patches = patchesOf(stub);
    expect(patches).toHaveLength(1);
    expect(JSON.parse(patches[0].body ?? "{}")).toEqual({ name: "Meena Iyer", subjects: ["maths", "science", "Sanskrit"], language: "en" });
    // The request is the tutor's own: their row, their token, the public key.
    expect(patches[0].query).toContain(`id=eq.${USER_ID}`);
    expect(patches[0].headers["authorization"]).toMatch(/^Bearer \S+/);
    expect(patches[0].headers["apikey"]).toBe("ci-anon-key");
    expect(stub.tutor?.name).toBe("Meena Iyer");
  });

  test("a Hindi page saves hi as the language, and goes on in Hindi", async ({ page }) => {
    const stub = await signedInNewTutor(page, "/hi/setup/profile/");
    await nameBox(page).fill("Meena");
    await page.getByRole("button", { pressed: false }).first().click();
    await page.getByRole("button", { name: messageText("hi", "setup.profile.next") }).click();
    await expect(page).toHaveURL(/\/hi\/setup\/upi\/$/);
    expect(JSON.parse(patchesOf(stub)[0].body ?? "{}").language).toBe("hi");
  });

  test("a failed save keeps what was typed, says so, does not move on, and the second try works", async ({ page }) => {
    const stub = await signedInNewTutor(page);
    stub.refuseWrites = true;
    await nameBox(page).fill("Meena Iyer");
    await chip(page, "Maths").click();
    await next(page).click();
    await expect(alertText(page)).toHaveText("Couldn't save just now. Your changes were not saved. Check your connection and tap Next again.");
    expect(page.url()).toBe(`${ORIGIN}/en/setup/profile/`);
    await expect(nameBox(page)).toHaveValue("Meena Iyer");
    await expect(chip(page, "Maths")).toHaveAttribute("aria-pressed", "true");
    stub.refuseWrites = false;
    await next(page).click();
    await expect(page).toHaveURL(/\/en\/setup\/upi\/$/);
  });

  test("26: a row that is missing says to sign out and in again, and does not loop", async ({ page }) => {
    const stub = await signedInNewTutor(page);
    await nameBox(page).fill("Meena");
    await chip(page, "Maths").click();
    stub.tutor = null;
    await next(page).click();
    await expect(alertText(page)).toContainText("We could not find your profile. Sign out, then sign in again.");
    expect(page.url()).toBe(`${ORIGIN}/en/setup/profile/`);
    expect(patchesOf(stub)).toHaveLength(1);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
  });
});

test.describe("27 to 30: step 2", () => {
  async function onStep2(page: Page, tutor = newTutor({ name: "Meena Iyer", subjects: ["maths"] })) {
    const stub = await stubSupabase(page, { tutor });
    await seedSession(page);
    await page.goto("/en/setup/upi/");
    await expect(page.locator("h1")).toBeVisible();
    return stub;
  }

  test("shows the step, the title, the body with the product name, the field and the black button", async ({ page }) => {
    await onStep2(page);
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Where should the fees land?");
    await expect(page.getByText(`Your UPI ID. Parents pay you directly. ${brand.name} never touches the money.`)).toBeVisible();
    await expect(upiBox(page)).toHaveValue("");
    await expect(upiBox(page)).toHaveAttribute("placeholder", "name@bank");
    expect((await css(upiBox(page), ["font-family"]))["font-family"].split(",")[0].replace(/["']/g, "")).not.toMatch(/Anek/);
    const save = page.getByRole("button", { name: "Save and finish" });
    expect((await css(save, ["background-color"]))["background-color"]).toBe("rgb(26, 20, 16)");
  });

  test("abc says what is missing; a real ID shows the words and the tick", async ({ page }) => {
    await onStep2(page);
    await upiBox(page).fill("abc");
    await upiBox(page).blur();
    await expect(page.getByText("This is missing the part after @. A UPI ID looks like name@bank")).toBeVisible();
    await expect(page.getByText("Needs fixing")).toBeVisible();
    await upiBox(page).fill("meena.tuitions@okhdfc");
    await expect(page.getByText("That looks like a valid UPI ID.")).toBeVisible();
    await expect(page.locator('[data-state="correct"] svg')).toHaveCount(1);
  });

  test("Save with a bad ID sends nothing", async ({ page }) => {
    const stub = await onStep2(page);
    await upiBox(page).fill("name@");
    await page.getByRole("button", { name: "Save and finish" }).click();
    await expect(page.getByText(/A UPI ID has letters, digits, dots and dashes/)).toBeVisible();
    expect(patchesOf(stub)).toHaveLength(0);
  });

  test("Save and finish sends only upi_id, then shows the empty home", async ({ page }) => {
    const stub = await onStep2(page);
    await upiBox(page).fill(" meena.tuitions@okhdfc ");
    await page.getByRole("button", { name: "Save and finish" }).click();
    await expect(page).toHaveURL(/\/en\/home\/$/);
    expect(JSON.parse(patchesOf(stub)[0].body ?? "{}")).toEqual({ upi_id: "meena.tuitions@okhdfc" });
    await expect(page.locator("h1")).toHaveText("Your book is empty.");
    await expect(page.getByText("Hello, Meena", { exact: true })).toBeVisible();
  });

  test("a failed save keeps the ID, says so, and does not go home", async ({ page }) => {
    const stub = await onStep2(page);
    stub.refuseWrites = true;
    await upiBox(page).fill("meena.tuitions@okhdfc");
    await page.getByRole("button", { name: "Save and finish" }).click();
    await expect(alertText(page)).toHaveText("Couldn't save just now. Your changes were not saved. Check your connection and tap Save and finish again.");
    await expect(upiBox(page)).toHaveValue("meena.tuitions@okhdfc");
    expect(page.url()).toBe(`${ORIGIN}/en/setup/upi/`);
  });
});

test.describe("21 to 31: the whole way, and back to edit", () => {
  test("a new tutor goes from the first screen to the empty home", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: newTutor() });
    await seedSession(page);
    await page.goto("/en/home/");
    await expect(page).toHaveURL(/\/en\/setup\/profile\/$/);
    await nameBox(page).fill("Meena Iyer");
    await chip(page, "Maths").click();
    await next(page).click();
    await expect(page).toHaveURL(/\/en\/setup\/upi\/$/);
    await upiBox(page).fill("meena.tuitions@okhdfc");
    await page.getByRole("button", { name: "Save and finish" }).click();
    await expect(page).toHaveURL(/\/en\/home\/$/);
    await expect(page.locator("h1")).toHaveText("Your book is empty.");
    expect(stub.tutor).toMatchObject({ name: "Meena Iyer", subjects: ["maths"], upi_id: "meena.tuitions@okhdfc" });
    // Setup is done: opening it again does not send the tutor back.
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Your book is empty.");
  });

  test("31: Back on step 2 goes to step 1, which still holds what was typed", async ({ page }) => {
    await stubSupabase(page, { tutor: newTutor() });
    await seedSession(page);
    await page.goto("/en/setup/profile/");
    await nameBox(page).fill("Meena Iyer");
    await chip(page, "Maths").click();
    await next(page).click();
    await expect(page).toHaveURL(/\/en\/setup\/upi\/$/);
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/en\/setup\/profile\/$/);
    await expect(nameBox(page)).toHaveValue("Meena Iyer");
    await expect(chip(page, "Maths")).toHaveAttribute("aria-pressed", "true");
  });

  test("31: a tutor with a finished profile sees the same two screens with their saved values, and finishes at home", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor({ subjects: ["maths", "Sanskrit"] }) });
    await seedSession(page);
    await page.goto("/en/setup/profile/");
    await expect(nameBox(page)).toHaveValue("Meena Iyer");
    await expect(chip(page, "Maths")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Sanskrit")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Science")).toHaveAttribute("aria-pressed", "false");
    await nameBox(page).fill("Meena Rao");
    await next(page).click();
    await expect(page).toHaveURL(/\/en\/setup\/upi\/$/);
    await expect(upiBox(page)).toHaveValue("meena.tuitions@okhdfc");
    await page.getByRole("button", { name: "Save and finish" }).click();
    await expect(page).toHaveURL(/\/en\/home\/$/);
    await expect(page.getByText("Hello, Meena", { exact: true })).toBeVisible();
    expect(stub.tutor?.name).toBe("Meena Rao");
  });
});
