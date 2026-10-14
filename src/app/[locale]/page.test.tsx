// The landing page as a whole (spec R0-1, criteria 1, 10, 14, 16, 17, 33), rendered with the real English messages.
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { loadMessages } from "@/i18n/messages";

vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getMessages: async () => loadMessages("en"),
  getTranslations: async (namespace: string) => {
    const messages = (await loadMessages("en")) as unknown as Record<string, unknown>;
    return (key: string, values?: { brand?: string }) => {
      let node: unknown = messages;
      for (const part of `${namespace}.${key}`.split(".")) node = (node as Record<string, unknown>)[part];
      return (node as string).replaceAll("{brand}", values?.brand ?? "");
    };
  },
}));

const { default: LocaleHome } = await import("./page");

afterEach(cleanup);

async function renderPage() {
  const page = await LocaleHome();
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {page}
    </NextIntlClientProvider>,
  );
}

describe("the landing page", () => {
  it("has one banner, one main, one contentinfo, one h1 and four h2 in order", async () => {
    await renderPage();
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    expect(screen.getByRole("main").querySelector("header, footer")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Asking for money is awkward. So don't ask. Tap.",
      "Two free tools.",
      "Four promises, in writing.",
      "Put your name in the book.",
    ]);
  });

  it("has the waitlist section the buttons point at", async () => {
    const { container } = await renderPage();
    expect(container.querySelector("main section#waitlist")).not.toBeNull();
    expect(container.querySelector("#tools")).not.toBeNull();
  });

  it("links only to #waitlist, a language's landing page, the reminder writer (twice: hero and card 2) or sign-in (header and footer)", async () => {
    const { container } = await renderPage();
    const hrefs = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toMatch(/^(#waitlist|\/(en|hi|kn|te)\/|\/en\/tools\/fee-reminder\/|\/en\/sign-in\/)$/);
    expect(hrefs.filter((href) => href === "/en/tools/fee-reminder/")).toHaveLength(2);
    expect(hrefs.filter((href) => href === "/en/sign-in/")).toHaveLength(2);
    expect(hrefs.some((href) => href?.includes("receipt"))).toBe(false);
  });

  it("has the waitlist form and no other form, no price, no Pro plan and no support link (R0-4)", async () => {
    const { container } = await renderPage();
    expect(container.querySelectorAll("form")).toHaveLength(1);
    expect(container.querySelector("section#waitlist form")).not.toBeNull();
    expect(container.textContent).not.toMatch(/₹149|₹999|\bPro\b|whatsapp\.com|wa\.me|privacy/i);
  });
});
