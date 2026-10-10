// The fee reminder page as a whole (spec R0-2, criteria 6, 7, 55, 56, 57), rendered with the real messages.
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { brand } from "@/config/brand";
import type { Locale } from "@/config/locales";
import { loadMessages } from "@/i18n/messages";

const state: { locale: Locale } = { locale: "en" };

vi.mock("next-intl/server", () => ({
  getLocale: async () => state.locale,
  getMessages: async () => loadMessages(state.locale),
  getTranslations: async (namespace: string) => {
    const messages = (await loadMessages(state.locale)) as unknown as Record<string, unknown>;
    return (key: string, values?: { brand?: string }) => {
      let node: unknown = messages;
      for (const part of `${namespace}.${key}`.split(".")) node = (node as Record<string, unknown>)[part];
      return (node as string).replaceAll("{brand}", values?.brand ?? "");
    };
  },
}));

const { default: FeeReminderPage } = await import("./page");

afterEach(cleanup);

async function renderPage(locale: Locale = "en") {
  state.locale = locale;
  const page = await FeeReminderPage();
  return render(
    <NextIntlClientProvider locale={locale} messages={await loadMessages(locale)}>
      {page}
    </NextIntlClientProvider>,
  );
}

describe("the fee reminder page", () => {
  it("has one banner, one main, one contentinfo and exactly one h1 (criterion 6)", async () => {
    await renderPage();
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    expect(screen.getByRole("main").querySelector("header, footer")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Write the fee reminder you keep putting off."]);
  });

  it("shows the kicker from the canvas (criterion 55)", async () => {
    await renderPage();
    expect(screen.getByText("Free tool · no sign-up")).toBeTruthy();
  });

  it("header: the brand name is the only link, to the landing in the same language, 44px high (criterion 6)", async () => {
    await renderPage("kn");
    const links = within(screen.getByRole("banner")).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe(brand.name);
    expect(links[0].getAttribute("href")).toBe("/kn/");
    expect(links[0].className).toContain("min-h-tap");
    expect(links[0].className).toContain("min-w-tap");
    expect(links[0].className).toContain("ring:ground-ring");
  });

  it("footer: the other three languages link to the tool page in that language; the current one is not a link (criterion 7)", async () => {
    await renderPage("hi");
    const nav = within(screen.getByRole("contentinfo")).getByRole("navigation");
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/en/tools/fee-reminder/", "/kn/tools/fee-reminder/", "/te/tools/fee-reminder/"]);
    expect(links.map((a) => a.getAttribute("lang"))).toEqual(["en", "kn", "te"]);
    const current = nav.querySelector("[aria-current=page]")!;
    expect(current.tagName).toBe("SPAN");
    expect(current.textContent).toBe("हिन्दी");
  });

  it("the yellow block says the app is coming, names the brand from the config, and links to the waitlist with no form (criterion 56)", async () => {
    await renderPage("te");
    const block = screen.getByTestId("reminder-promo");
    expect(block.tagName).toBe("SECTION");
    expect(block.className).toContain("bg-highlight");
    expect(within(block).getByRole("heading", { level: 2 })).toBeTruthy();
    expect(block.textContent).toContain(brand.name);
    expect(block.textContent).not.toContain("{brand}");
    const link = within(block).getByRole("link");
    expect(link.getAttribute("href")).toBe("/te/#waitlist");
    expect(link.className).toContain("bg-ink");
    expect(link.className).toContain("min-h-14");
    expect(block.querySelectorAll("form, input, select, textarea")).toHaveLength(0);
  });

  it("the English yellow block reads as the spec says", async () => {
    await renderPage();
    const block = screen.getByTestId("reminder-promo");
    expect(within(block).getByRole("heading", { level: 2 }).textContent).toBe("Doing this for 20 parents every month?");
    expect(block.textContent).toContain(`The ${brand.name} app is coming soon. It will remember every student and remind them all in a minute.`);
    expect(within(block).getByRole("link", { name: "Join the waitlist" })).toBeTruthy();
  });

  it("has no form element, and nothing red that can be pressed", async () => {
    const { container } = await renderPage();
    expect(container.querySelectorAll("form")).toHaveLength(0);
    for (const control of container.querySelectorAll("a, button")) {
      if (control.closest("header")) continue;
      expect(control.className).not.toMatch(/bg-cloth/);
    }
  });

  it("promises nothing the tool does not do (criterion 57)", async () => {
    const { container } = await renderPage();
    expect(container.textContent).not.toMatch(/₹149|₹999|\bPro\b|automatic|receipt|tracked|one tap|verified/i);
  });
});
