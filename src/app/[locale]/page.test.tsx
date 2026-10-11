// The landing page as a whole (spec R0-1, criteria 1, 10, 14, 16, 17, 33), rendered with the real English messages.
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import LocaleHome from "./page";

afterEach(cleanup);

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LocaleHome />
    </NextIntlClientProvider>,
  );
}

describe("the landing page", () => {
  it("has one banner, one main, one contentinfo, one h1 and four h2 in order", () => {
    renderPage();
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

  it("has the waitlist section the buttons point at", () => {
    const { container } = renderPage();
    expect(container.querySelector("main section#waitlist")).not.toBeNull();
    expect(container.querySelector("#tools")).not.toBeNull();
  });

  it("links only to #waitlist, a language's landing page, the receipt maker (card 1) or the reminder writer (twice: hero and card 2)", () => {
    const { container } = renderPage();
    const hrefs = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toMatch(/^(#waitlist|\/(en|hi|kn|te)\/|\/en\/tools\/fee-receipt\/|\/en\/tools\/fee-reminder\/)$/);
    expect(hrefs.filter((href) => href === "/en/tools/fee-reminder/")).toHaveLength(2);
    expect(hrefs.filter((href) => href === "/en/tools/fee-receipt/")).toHaveLength(1);
  });

  it("has no form control, no price, no Pro plan and no support link", () => {
    const { container } = renderPage();
    expect(container.querySelectorAll("form, input, select, textarea")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/₹149|₹999|\bPro\b|whatsapp\.com|wa\.me|privacy/i);
  });
});
