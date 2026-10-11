// Render tests for the landing sections (spec R0-1, criteria 3, 4, 5, 9, 11, 12, 13, 15, 23, 25, 32, 33).
import { cleanup, screen, within } from "@testing-library/react";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { Hero } from "./hero";
import { LandingFooter } from "./landing-footer";
import { LandingHeader } from "./landing-header";
import { LedgerCard } from "./ledger-card";
import { Promises } from "./promises";
import { renderLanding } from "./render-with-messages";
import { Ribbon } from "./ribbon";
import { Steps } from "./steps";
import { Tools } from "./tools";
import { WaitlistSlot } from "./waitlist-slot";

afterEach(cleanup);

describe("header and hero (criteria 11)", () => {
  it("header has the product name and a button-sized link to #waitlist", () => {
    renderLanding(<LandingHeader />);
    const link = screen.getByRole("link", { name: "Join waitlist" });
    expect(link.getAttribute("href")).toBe("#waitlist");
    expect(link.className).toContain("min-h-control");
    expect(screen.getByRole("banner")).toBeTruthy();
  });

  it("hero has one h1, a full-width large link to #waitlist and the ledger card", () => {
    renderLanding(<Hero />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const link = screen.getByRole("link", { name: "Join the waitlist" });
    expect(link.getAttribute("href")).toBe("#waitlist");
    expect(link.className).toEqual(expect.stringContaining("min-h-14"));
    expect(link.className).toContain("w-full");
    expect(screen.getByRole("group", { name: "Example" })).toBeTruthy();
  });

  it("has two links: the waitlist button and, under it, a text link to the reminder writer (R0-2, criterion 5)", () => {
    const { container } = renderLanding(<Hero />);
    expect([...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"))).toEqual(["#waitlist", "/en/tools/fee-reminder/"]);
    const link = screen.getByRole("link", { name: "or write a free reminder now" });
    expect(link.getAttribute("href")).toBe("/en/tools/fee-reminder/");
    expect(link.className).toContain("min-h-tap");
    expect(link.className).toContain("underline");
    expect(link.className).toContain("ring:ground-ring");
    // A text link, not a second button, and not blue or red.
    expect(link.className).not.toMatch(/bg-|shadow-/);
  });

  it("points the hero's tool link at the page's own language", () => {
    renderLanding(<Hero />, "hi");
    expect(screen.getByRole("link", { name: "या अभी मुफ़्त रिमाइंडर लिखें" }).getAttribute("href")).toBe("/hi/tools/fee-reminder/");
  });
});

describe("ledger card (criteria 5 and 25)", () => {
  it("shows the amounts from formatRupees, the Example label, and nothing rotated but the stamp words", () => {
    const { container } = renderLanding(<LedgerCard />);
    const card = screen.getByRole("group", { name: "Example" });
    expect(card.textContent).toContain("₹18,500");
    expect(card.textContent).toContain("₹1,200");
    expect(within(card).getAllByText("Example").length).toBeGreaterThan(0);
    expect(card.className).not.toMatch(/rotate/);
    const rotated = [...container.querySelectorAll("*")].filter((el) => /(^|\s)-?rotate-/.test(el.getAttribute("class") ?? ""));
    // Only the inner words of the small stamp tilt.
    expect(rotated).toHaveLength(1);
    expect(rotated[0].parentElement?.getAttribute("data-size")).toBe("sm");
  });

  it("writes no month and no date", () => {
    renderLanding(<LedgerCard />);
    const text = screen.getByRole("group", { name: "Example" }).textContent ?? "";
    expect(text).not.toMatch(/January|February|March|April|May|June|July|August|September|October|November|December|20\d\d/i);
  });

  it("writes the amounts with 0-9 digits in Hindi too", () => {
    renderLanding(<LedgerCard />, "hi");
    expect(screen.getByRole("group", { name: "उदाहरण" }).textContent).toContain("₹18,500");
  });
});

describe("ribbon (criterion 23)", () => {
  it("is hidden from screen readers, shows the seven words and has no animation", () => {
    const { container } = renderLanding(<Ribbon />);
    const ribbon = container.firstElementChild!;
    expect(ribbon.getAttribute("aria-hidden")).toBe("true");
    expect(ribbon.querySelectorAll("span")).toHaveLength(7);
    expect(ribbon.outerHTML).not.toMatch(/animate|marquee|motion/);
    expect([...ribbon.querySelectorAll("span")].map((s) => s.textContent)).toEqual(["Fees", "फ़ीस", "ಶುಲ್ಕ", "ఫీజు", "Remind", "Pay", "Paid"]);
    // No lang: a foreign-script word must not make the page fetch that script's web font.
    expect(ribbon.querySelectorAll("[lang]")).toHaveLength(0);
  });
});

describe("steps (criterion 3)", () => {
  it("has an h2, steps numbered 1 and 2 in the headline face, and a stamp as the third", () => {
    const { container } = renderLanding(<Steps />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toMatch(/^1/);
    expect(items[1].textContent).toMatch(/^2/);
    const digit = container.querySelector("li span[translate=no]")!;
    expect(digit.className).toContain("type-amount");
    expect(digit.className).not.toMatch(/anek/i);
    const stamp = within(items[2]).getByRole("img", { name: "Paid" });
    expect(stamp.getAttribute("data-size")).toBe("sm");
  });
});

describe("tools (R0-1 criterion 15; R0-2 criteria 3 and 4)", () => {
  it("has two cards, each with one link: the receipt maker and the reminder writer (R0-3, criterion 15)", () => {
    const { container } = renderLanding(<Tools />);
    const cards = container.querySelectorAll("article");
    expect(cards).toHaveLength(2);
    expect(screen.queryByText("Coming soon")).toBeNull();
    const receiptLink = within(cards[0] as HTMLElement).getByRole("link", { name: "Make a receipt" });
    expect(receiptLink.getAttribute("href")).toBe("/en/tools/fee-receipt/");
    expect(receiptLink.className).toContain("min-h-control");
    expect(receiptLink.className).toContain("bg-slip");
    expect(receiptLink.className).not.toMatch(/bg-blue|bg-cloth/);
    expect(cards[0].querySelectorAll("a, button")).toHaveLength(1);
    expect(screen.getByText("Tool no. 01")).toBeTruthy();
    expect(screen.getByText("Tool no. 02")).toBeTruthy();

    expect(container.querySelectorAll("a, button")).toHaveLength(2);
    const link = within(cards[1] as HTMLElement).getByRole("link", { name: "Write a reminder" });
    expect(link.getAttribute("href")).toBe("/en/tools/fee-reminder/");
    expect(link.className).toContain("min-h-control");
    expect(link.className).toContain("w-full");
    // Outline: opening a page neither sends nor pays, so it is not blue.
    expect(link.className).toContain("bg-slip");
    expect(link.className).not.toMatch(/bg-blue|bg-cloth/);

    expect(container.querySelector("section")?.id).toBe("tools");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Two free tools.");
  });

  it("links each card to its tool in the page's own language", () => {
    const { container } = renderLanding(<Tools />, "hi");
    const hrefs = [...container.querySelectorAll("article a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/hi/tools/fee-receipt/", "/hi/tools/fee-reminder/"]);
  });
});

describe("promises (criterion 4)", () => {
  it("has four items numbered 01 to 04, each with a title and a body", () => {
    renderLanding(<Promises />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    items.forEach((item, index) => {
      expect(item.textContent).toContain(`0${index + 1}`);
      expect(within(item).getByRole("heading", { level: 3 }).textContent?.length).toBeGreaterThan(0);
      expect(item.querySelector("p")?.textContent?.length).toBeGreaterThan(0);
    });
  });
});

describe("waitlist slot (criteria 12, 13, 14)", () => {
  it("is the unavailable button with its reason, and no form control", () => {
    const { container } = renderLanding(<WaitlistSlot />);
    const button = screen.getByRole("button", { name: "Join the waitlist" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.className).toContain("border-dashed");
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Opens soon")).toBeTruthy();
    expect(container.querySelectorAll("form, input, select, textarea")).toHaveLength(0);
  });

  it("says in its first lines that it is the one file R0-4 replaces", () => {
    const source = readFileSync(join(process.cwd(), "src/components/landing/waitlist-slot.tsx"), "utf8");
    expect(source.split("\n").slice(0, 3).join("\n")).toMatch(/R0-4 replaces the body of this one file/);
  });
});

describe("footer (criteria 32 and 33)", () => {
  it("marks the current language and links the other three to their landing pages", () => {
    renderLanding(<LandingFooter />, "hi");
    const nav = screen.getByRole("navigation", { name: "भाषाएँ" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/en/", "/kn/", "/te/"]);
    expect(links.map((a) => a.textContent)).toEqual(["English", "ಕನ್ನಡ", "తెలుగు"]);
    const current = nav.querySelector("[aria-current=page]")!;
    expect(current.textContent).toBe("हिन्दी");
    expect(current.tagName).toBe("SPAN");
  });

  it("has no Privacy and no WhatsApp help link, and hides the big name", () => {
    const { container } = renderLanding(<LandingFooter />);
    expect(container.textContent).not.toMatch(/privacy|help on whatsapp/i);
    expect(container.querySelector("[aria-hidden=true]")?.textContent).toBe(brand.name);
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });
});

describe("no image (criterion 9)", () => {
  const dir = join(process.cwd(), "src", "components", "landing");
  it("uses no <img> or next/image in the landing files", () => {
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".tsx") && !n.endsWith(".test.tsx"))) {
      const source = readFileSync(join(dir, name), "utf8");
      expect(source, name).not.toMatch(/<img\b|next\/image/);
    }
    expect(readFileSync(join(process.cwd(), "src/app/[locale]/page.tsx"), "utf8")).not.toMatch(/<img\b|next\/image/);
  });

  it("adds no picture to public/", () => {
    const publicDir = join(process.cwd(), "public");
    const files = existsSync(publicDir) ? readdirSync(publicDir) : [];
    expect(files.filter((f) => /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(f))).toEqual([]);
  });
});
