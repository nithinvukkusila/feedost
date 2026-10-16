// The parent's pay page as a whole (spec R1-9 Part B, criteria 17, 20, 21, 29, 32) with both functions stubbed.
import { cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";
import kn from "../../../messages/kn.json";
import te from "../../../messages/te.json";
import { stripTodo } from "@/i18n/messages";
import { feeBody, noticeBody, TOKEN } from "@/lib/pay-page.test-util";
import { pageWords } from "@/lib/pay-page-words";
import { payPageWords } from "@/lib/unlocked-languages";
import { signedFixture } from "../../../scripts/language-unlock.mjs";
import { PublicPayPage } from "./public-pay-page";

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20_000 });

const words = pageWords(
  // As the server page hands them over: a value still marked TODO-translate is already its English text.
  { en: stripTodo(en.payPage), hi: stripTodo(hi.payPage), kn: stripTodo(kn.payPage), te: stripTodo(te.payPage) },
  { en: stripTodo(en.receipt), hi: stripTodo(hi.receipt), kn: stripTodo(kn.receipt), te: stripTodo(te.receipt) },
);
let calls: { url: string; body: Record<string, unknown> }[];
type Reply = { status: number; body: unknown };
let replies: { pay: (n: number) => Reply; consent: (n: number) => Reply };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => {
  window.history.pushState({}, "", `/p/${TOKEN}/`);
  calls = [];
  replies = { pay: () => ({ status: 404, body: { code: "not_found" } }), consent: () => ({ status: 200, body: { code: "ok" } }) };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      const consent = url.endsWith("/record-consent");
      const n = calls.filter((c) => c.url.endsWith("/record-consent") === consent).length;
      const reply = (consent ? replies.consent : replies.pay)(n);
      return new Response(JSON.stringify(reply.body), { status: reply.status });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.lang = "en";
});

const pay = (page: unknown): Reply => ({ status: 200, body: { code: "ok", page } });
const main = () => document.querySelector("main")!;

describe("the parent's pay page", () => {
  it("says it is opening the fee request, with no tutor data, until the answer comes", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<PublicPayPage words={words} />);
    expect(screen.getByText("Opening your fee request…")).toBeTruthy();
    expect(main().getAttribute("data-state")).toBe("loading");
    expect(main().textContent).not.toContain("Meena");
  });

  it("asks nothing for an address with no token", async () => {
    window.history.pushState({}, "", "/p/");
    render(<PublicPayPage words={words} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("not_found"));
    expect(calls).toHaveLength(0);
  });

  it("sends one pay-page request with exactly the token, and shows the fee in the student's language", async () => {
    replies.pay = () => pay({ ...feeBody, language: "hi" });
    render(<PublicPayPage words={words} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("fee"));
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ token: TOKEN });
    expect(main().getAttribute("lang")).toBe("hi");
    expect(document.documentElement.lang).toBe("hi");
    expect(main().textContent).toContain(hi.payPage.total);
  });

  it("agreeing sends one record-consent with the version it was given, ignores a second tap, then shows the fee", async () => {
    replies.pay = (n) => (n === 1 ? pay(noticeBody) : pay(feeBody));
    render(<PublicPayPage words={words} />);
    const agree = await screen.findByRole("button", { name: "I agree, show the fee" });
    expect(main().textContent).not.toContain("₹");
    // Two clicks in the same instant, before React has drawn the first one's "Saving…".
    fireEvent.click(agree);
    fireEvent.click(agree);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("fee"));
    const consents = calls.filter((c) => c.url.endsWith("/record-consent"));
    expect(consents).toHaveLength(1);
    expect(consents[0].body).toEqual({ token: TOKEN, notice_version: "v1" });
    expect(calls.filter((c) => c.url.endsWith("/pay-page"))).toHaveLength(2);
  });

  it("keeps the consent screen when saving fails, and Try again saves", async () => {
    replies.pay = (n) => (n === 1 ? pay(noticeBody) : pay(feeBody));
    replies.consent = (n) => (n === 1 ? { status: 500, body: { code: "error" } } : { status: 200, body: { code: "ok" } });
    render(<PublicPayPage words={words} />);
    await userEvent.click(await screen.findByRole("button", { name: "I agree, show the fee" }));
    await screen.findByText("Couldn't save. Check your connection and try again.");
    expect(main().getAttribute("data-state")).toBe("consent");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("fee"));
  });

  it("on a changed notice (409) reads again and sends the new version next time", async () => {
    replies.pay = (n) => (n === 1 ? pay(noticeBody) : n === 2 ? pay({ ...noticeBody, notice_version: "v2" }) : pay(feeBody));
    replies.consent = (n) => (n === 1 ? { status: 409, body: { code: "stale_notice", notice_version: "v2" } } : { status: 200, body: { code: "ok" } });
    render(<PublicPayPage words={words} />);
    await userEvent.click(await screen.findByRole("button", { name: "I agree, show the fee" }));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/pay-page"))).toHaveLength(2));
    await userEvent.click(await screen.findByRole("button", { name: "I agree, show the fee" }));
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("fee"));
    expect(calls.filter((c) => c.url.endsWith("/record-consent")).map((c) => c.body.notice_version)).toEqual(["v1", "v2"]);
  });

  it("changes language with no new request, and the privacy notice link opens the read-only notice and Close returns", async () => {
    replies.pay = () => pay(feeBody);
    render(<PublicPayPage words={words} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("fee"));
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    await userEvent.click(screen.getByRole("button", { name: "हिन्दी", hidden: true }));
    expect(main().getAttribute("lang")).toBe("hi");
    expect(calls).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: en.payPage.consent.notice }));
    expect(main().getAttribute("data-state")).toBe("notice");
    expect(screen.queryByRole("button", { name: en.payPage.consent.agree })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: en.payPage.consent.close }));
    expect(main().getAttribute("data-state")).toBe("fee");
    expect(calls).toHaveLength(1);
  });

  it.each([
    [404, "not_found", "This link doesn't work. Ask your tutor to send it again."],
    [429, "rate_limited", "Too many tries. Please try again in a while."],
    [500, "failed", "Couldn't open this page."],
  ])("answers %i with its own state and no tutor or child data", async (status, state, message) => {
    replies.pay = () => ({ status, body: { code: "x" } });
    render(<PublicPayPage words={words} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe(state));
    expect(main().textContent).toContain(message);
    expect(main().textContent).not.toContain("Meena");
    expect(main().textContent).not.toContain("Ravi");
  });
});

// Spec parent-pages-english, criteria 1 and 3: the page shows only the languages it was given, and English otherwise.
describe("the parent's pay page with only some languages unlocked", () => {
  // The raw files with their markers taken out, so a fixture can sign hi (its pay page words still carry markers).
  const plain = { en: stripTodo(en), hi: stripTodo(hi), kn: stripTodo(kn), te: stripTodo(te) };
  const hindiOnly = () => payPageWords({ records: signedFixture("payPage", ["hi"], { messages: plain }), messages: plain });
  const englishOnly = pageWords({ en: stripTodo(en.payPage) }, { en: stripTodo(en.receipt) });

  it("opens a Hindi student's page in Hindi and a Kannada student's in English, and the menu lists English and हिन्दी", async () => {
    const two = await hindiOnly();
    expect(Object.keys(two)).toEqual(["en", "hi"]);
    replies.pay = () => pay({ ...feeBody, language: "hi" });
    render(<PublicPayPage words={two} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("fee"));
    expect(main().getAttribute("lang")).toBe("hi");
    expect(main().textContent).toContain(hi.payPage.total);
    await userEvent.click(screen.getByRole("button", { name: "हिन्दी" }));
    const listed = document.querySelectorAll("dialog li");
    expect([...listed].map((li) => li.textContent)).toEqual(["English", "हिन्दी"]);
    cleanup();

    replies.pay = () => pay({ ...feeBody, language: "kn" });
    render(<PublicPayPage words={two} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("fee"));
    expect(main().getAttribute("lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(main().textContent).toContain(en.payPage.total);
  });

  it("keeps the consent lines English inside a Hindi page while the consent wording is a draft", async () => {
    const two = await hindiOnly();
    expect(two.hi?.pay.consent).toEqual(two.en.pay.consent);
    expect(two.hi?.pay.total).toBe(hi.payPage.total);
    replies.pay = () => pay({ ...noticeBody, language: "hi" });
    expect(two.hi?.consentLang).toBe("en");
    render(<PublicPayPage words={two} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("consent"));
    expect(main().getAttribute("lang")).toBe("hi");
    // The English consent lines say they are English (criterion 4): no Hindi face, line height or voice for them.
    const section = main().querySelector("section[aria-labelledby=consent-title]")!;
    expect(section.getAttribute("lang")).toBe("en");
    expect(section.contains(screen.getByRole("button", { name: en.payPage.consent.agree }))).toBe(true);
    cleanup();

    // The fee page: its words are Hindi, and the privacy notice link (a consent word) is English with lang="en".
    replies.pay = () => pay({ ...feeBody, language: "hi" });
    render(<PublicPayPage words={two} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("fee"));
    expect(screen.getByRole("button", { name: en.payPage.consent.notice }).getAttribute("lang")).toBe("en");
    await userEvent.click(screen.getByRole("button", { name: en.payPage.consent.notice }));
    expect(main().getAttribute("data-state")).toBe("notice");
    expect(main().querySelector("section[aria-labelledby=consent-title]")?.getAttribute("lang")).toBe("en");
  });

  it.each(["hi", "kn", "te"] as const)("with English alone, a %s student sees English and no language button", async (language) => {
    replies.pay = (n) => (n === 1 ? pay({ ...noticeBody, language }) : pay({ ...feeBody, language }));
    render(<PublicPayPage words={englishOnly} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("consent"));
    expect(main().getAttribute("lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(screen.queryByRole("button", { name: /English|हिन्दी|ಕನ್ನಡ|తెలుగు/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: en.payPage.consent.agree }));
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("fee"));
    expect(main().getAttribute("lang")).toBe("en");
    expect(main().textContent).toContain(en.payPage.total);
    expect(screen.queryByRole("button", { name: /English|हिन्दी|ಕನ್ನಡ|తెలుగు/ })).toBeNull();
  });

  it("with English alone, a Hindi browser's not-found state is English", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["hi-IN", "kn-IN"]);
    render(<PublicPayPage words={englishOnly} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("not_found"));
    expect(main().textContent).toContain(en.payPage.state.notFound);
    expect(main().getAttribute("lang")).toBe("en");
    vi.restoreAllMocks();
  });

  it("with Hindi unlocked, a Hindi browser's not-found state is Hindi, with lang hi", async () => {
    const two = await hindiOnly();
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["hi-IN", "en-IN"]);
    render(<PublicPayPage words={two} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("not_found"));
    expect(main().textContent).toContain(hi.payPage.state.notFound);
    expect(main().getAttribute("lang")).toBe("hi");
    expect(document.documentElement.lang).toBe("hi");
    vi.restoreAllMocks();
  });

  it("with Hindi unlocked, a browser that prefers Kannada first is English: a locked first choice does not move on to Hindi", async () => {
    const two = await hindiOnly();
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["kn-IN", "hi-IN"]);
    render(<PublicPayPage words={two} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("not_found"));
    expect(main().textContent).toContain(en.payPage.state.notFound);
    expect(main().textContent).not.toContain(hi.payPage.state.notFound);
    expect(main().getAttribute("lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    vi.restoreAllMocks();
  });

  it("reads the token from ?t= only when told to (the /dev fixture page)", async () => {
    window.history.pushState({}, "", `/dev/unlocked/p/?t=${TOKEN}`);
    replies.pay = () => pay(feeBody);
    render(<PublicPayPage words={englishOnly} tokenSource="query" />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("fee"));
    expect(calls[0].body).toEqual({ token: TOKEN });
    cleanup();
    calls = [];
    render(<PublicPayPage words={englishOnly} />);
    await waitFor(() => expect(main().getAttribute("data-state")).toBe("not_found"));
    expect(calls).toHaveLength(0);
  });
});
