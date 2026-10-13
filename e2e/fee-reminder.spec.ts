// Spec R0-2, the fee reminder writer. Against the static export in out/ at the 360px phone project.
//
// What a parent receives is the product here, so the first block proves the message and both links
// character by character. The expected text is typed out below from the spec (criteria 22, 23, 25,
// 33, 35), not read from the app's own templates: a wrong template or a wrong link fails here.
//
// Send is a real link. No test opens WhatsApp: `https://wa.me/` is answered by a stub.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { brand } from "../src/config/brand";
import { localeNames } from "../src/config/locales";
import { css, familyOf, firstFamily, fontsSettled, langs, rgb, sidewaysScroll, slow4G, textProblems, type Lang } from "./helpers";
import { builtFileFor, headTags, htmlLang, largestText, OUT, pageWords, shown, smallTargets, smallText, titles } from "./landing-helpers";

type Tone = "polite" | "firm";
const tones = ["polite", "firm"] as const;
const tool = (lang: Lang) => `/${lang}/tools/fee-reminder/`;
const part = (page: Page, name: string) => page.getByTestId(`reminder-${name}`);
const word = (lang: Lang, key: string) => shown(lang, `reminderForm.${key}`);
const ogLocales: Record<Lang, string> = { en: "en_IN", hi: "hi_IN", kn: "kn_IN", te: "te_IN" };

// Criterion 25, typed out.
const MONTHS: Record<Lang, readonly string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  hi: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
  kn: ["ಜನವರಿ", "ಫೆಬ್ರವರಿ", "ಮಾರ್ಚ್", "ಏಪ್ರಿಲ್", "ಮೇ", "ಜೂನ್", "ಜುಲೈ", "ಆಗಸ್ಟ್", "ಸೆಪ್ಟೆಂಬರ್", "ಅಕ್ಟೋಬರ್", "ನವೆಂಬರ್", "ಡಿಸೆಂಬರ್"],
  te: ["జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్", "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్"],
};

// Criteria 22 and 23, typed out.
const TEMPLATES: Record<Lang, Record<Tone, string>> = {
  en: {
    polite:
      "Hello {parent} ji, a gentle reminder that the tuition fee of {amount} for {month} is due. You can pay by UPI with this link:\n{link}\nOr pay to UPI ID: {upiId}\nThank you!",
    firm: "Hello {parent} ji, the tuition fee of {amount} for {month} is still pending. Please pay it today by UPI with this link:\n{link}\nOr pay to UPI ID: {upiId}\nThank you.",
  },
  hi: {
    polite:
      "नमस्ते {parent} जी, यह याद दिलाना था कि {month} की ट्यूशन फ़ीस {amount} बाकी है। आप इस लिंक से UPI द्वारा भुगतान कर सकते हैं:\n{link}\nया इस UPI ID पर भेजें: {upiId}\nधन्यवाद!",
    firm: "नमस्ते {parent} जी, {month} की ट्यूशन फ़ीस {amount} अभी तक बाकी है। कृपया आज ही इस लिंक से UPI द्वारा भुगतान कर दें:\n{link}\nया इस UPI ID पर भेजें: {upiId}\nधन्यवाद।",
  },
  kn: {
    polite:
      "ನಮಸ್ಕಾರ {parent} ಅವರೇ, {month} ತಿಂಗಳ ಟ್ಯೂಷನ್ ಶುಲ್ಕ {amount} ಬಾಕಿ ಇದೆ ಎಂದು ನೆನಪಿಸುತ್ತಿದ್ದೇನೆ. ಈ ಲಿಂಕ್ ಮೂಲಕ UPI ನಲ್ಲಿ ಪಾವತಿಸಬಹುದು:\n{link}\nಅಥವಾ ಈ UPI ID ಗೆ ಕಳುಹಿಸಿ: {upiId}\nಧನ್ಯವಾದಗಳು!",
    firm: "ನಮಸ್ಕಾರ {parent} ಅವರೇ, {month} ತಿಂಗಳ ಟ್ಯೂಷನ್ ಶುಲ್ಕ {amount} ಇನ್ನೂ ಬಾಕಿ ಇದೆ. ದಯವಿಟ್ಟು ಇಂದೇ ಈ ಲಿಂಕ್ ಮೂಲಕ UPI ನಲ್ಲಿ ಪಾವತಿಸಿ:\n{link}\nಅಥವಾ ಈ UPI ID ಗೆ ಕಳುಹಿಸಿ: {upiId}\nಧನ್ಯವಾದಗಳು.",
  },
  te: {
    polite:
      "నమస్కారం {parent} గారు, {month} నెల ట్యూషన్ ఫీజు {amount} చెల్లించాల్సి ఉందని గుర్తు చేస్తున్నాను. ఈ లింక్ ద్వారా UPI లో చెల్లించవచ్చు:\n{link}\nలేదా ఈ UPI ID కి పంపండి: {upiId}\nధన్యవాదాలు!",
    firm: "నమస్కారం {parent} గారు, {month} నెల ట్యూషన్ ఫీజు {amount} ఇంకా బాకీ ఉంది. దయచేసి ఈ రోజే ఈ లింక్ ద్వారా UPI లో చెల్లించండి:\n{link}\nలేదా ఈ UPI ID కి పంపండి: {upiId}\nధన్యవాదాలు.",
  },
};

type Values = { parent: string; amount: string; upi: string; payee: string; month: number };
/** The canvas example. */
const canvas: Values = { parent: "Suresh", amount: "1200", upi: "meena.tuitions@okhdfc", payee: "Meena Rao", month: 9 };
const CANVAS_UPI = "upi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee";
const CANVAS_POLITE = `Hello Suresh ji, a gentle reminder that the tuition fee of ₹1,200 for October is due. You can pay by UPI with this link:\n${CANVAS_UPI}\nOr pay to UPI ID: meena.tuitions@okhdfc\nThank you!`;
const CANVAS_FIRM = `Hello Suresh ji, the tuition fee of ₹1,200 for October is still pending. Please pay it today by UPI with this link:\n${CANVAS_UPI}\nOr pay to UPI ID: meena.tuitions@okhdfc\nThank you.`;
// The whole address Send must open for the canvas example (plan section 6), typed out.
const CANVAS_WA =
  "https://wa.me/?text=Hello%20Suresh%20ji%2C%20a%20gentle%20reminder%20that%20the%20tuition%20fee%20of%20%E2%82%B91%2C200%20for%20October%20is%20due.%20You%20can%20pay%20by%20UPI%20with%20this%20link%3A%0Aupi%3A%2F%2Fpay%3Fpa%3Dmeena.tuitions%40okhdfc%26pn%3DMeena%2520Rao%26am%3D1200.00%26cu%3DINR%26tn%3DOctober%2520fee%0AOr%20pay%20to%20UPI%20ID%3A%20meena.tuitions%40okhdfc%0AThank%20you!";

/** A name as the spec says it is used: any white space is one space, ends trimmed. */
const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

/** ₹ with Indian grouping, written without the app's formatter. */
function inr(rupees: number): string {
  const digits = String(rupees);
  if (digits.length <= 3) return `₹${digits}`;
  return `₹${digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${digits.slice(-3)}`;
}

const rupeesOf = (v: Values) => Number(v.amount.replace(/[^0-9]/g, ""));

function upiLinkFor(v: Values): string {
  return `upi://pay?pa=${v.upi.trim()}&pn=${encodeURIComponent(tidy(v.payee))}&am=${rupeesOf(v)}.00&cu=INR&tn=${MONTHS.en[v.month]}%20fee`;
}

function messageFor(lang: Lang, tone: Tone, v: Values): string {
  const values: Record<string, string> = {
    parent: tidy(v.parent),
    amount: inr(rupeesOf(v)),
    month: MONTHS[lang][v.month],
    link: upiLinkFor(v),
    upiId: v.upi.trim(),
  };
  // One pass with a function: a typed `{link}` or `$&` is never read as a placeholder.
  return TEMPLATES[lang][tone].replace(/\{(parent|amount|month|link|upiId)\}/g, (_, key: string) => values[key]);
}

/** Opens the tool and waits until the form has woken up and the fonts have arrived. */
async function openTool(page: Page, lang: Lang): Promise<void> {
  await page.goto(tool(lang));
  await expect(part(page, "parent")).toBeEnabled();
  await fontsSettled(page);
}

async function fillForm(page: Page, v: Values): Promise<void> {
  await part(page, "parent").fill(v.parent);
  await part(page, "month").selectOption(String(v.month));
  await part(page, "amount").fill(v.amount);
  await part(page, "upi").fill(v.upi);
  await part(page, "payee").fill(v.payee);
}

const previewText = (page: Page) => part(page, "preview").evaluate((el) => el.textContent ?? "");

/** Answers `https://wa.me/` with a blank page and returns every address asked of it. */
async function stubWhatsApp(context: BrowserContext): Promise<string[]> {
  const asked: string[] = [];
  await context.route(/^https:\/\/wa\.me\//, (route) => {
    asked.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>stub</title>" });
  });
  return asked;
}

/** Taps Send and returns the address of the tab it opened. */
async function tapSend(page: Page): Promise<string> {
  const [opened] = await Promise.all([page.context().waitForEvent("page"), part(page, "send").click()]);
  await opened.waitForLoadState();
  const url = opened.url();
  await opened.close();
  await page.bringToFront();
  return url;
}

/**
 * The preview, the payment link in it and the Send link, all against text built in this file.
 * `pn`, when given, is the payee name exactly as it must appear in the payment link.
 */
async function expectMessage(page: Page, lang: Lang, tone: Tone, v: Values, pn?: string): Promise<string> {
  const want = messageFor(lang, tone, v);
  const preview = part(page, "preview");
  await expect(preview).toHaveAttribute("lang", lang);
  // A slow, busy machine can take more than the default 5 s to draw the preview after a radio is checked; the content is still exact.
  await expect.poll(() => previewText(page), { timeout: 20_000 }).toBe(want);
  await expect(preview.locator("[data-blank]")).toHaveCount(0);
  await expect(part(page, "incomplete")).toHaveCount(0);

  // The payment link as drawn, read the way a UPI app reads it.
  const link = (await preview.locator('[data-slot="link"]').textContent()) ?? "";
  expect(link).toBe(upiLinkFor(v));
  expect(link.startsWith("upi://pay?")).toBe(true);
  const pairs = link
    .slice("upi://pay?".length)
    .split("&")
    .map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)]);
  expect(pairs.map(([name]) => name)).toEqual(["pa", "pn", "am", "cu", "tn"]);
  const [pa, name, am, cu, tn] = pairs.map(([, value]) => value);
  expect(pa).toBe(v.upi.trim());
  expect(decodeURIComponent(name)).toBe(tidy(v.payee));
  if (pn !== undefined) expect(name).toBe(pn);
  expect(am).toBe(`${rupeesOf(v)}.00`);
  expect(cu).toBe("INR");
  expect(tn).toBe(`${MONTHS.en[v.month]}%20fee`);
  expect(link).not.toMatch(/[\s+#]|mc=|tr=|mode=|sign=/);
  expect(await preview.locator('[data-slot="upiId"]').textContent()).toBe(v.upi.trim());

  // Send: exactly wa.me, no number, the whole message encoded once (so the link inside is encoded twice).
  const send = part(page, "send");
  const href = (await send.getAttribute("href")) ?? "";
  expect(href).toBe(`https://wa.me/?text=${encodeURIComponent(want)}`);
  expect(href).toMatch(/^https:\/\/wa\.me\/\?text=[^\s+&#]+$/);
  expect(decodeURIComponent(href.slice("https://wa.me/?text=".length))).toBe(await previewText(page));
  // Read the way a server reads a query, where `+` would mean a space.
  const parsed = new URL(href);
  expect([parsed.protocol, parsed.host, parsed.pathname, parsed.hash]).toEqual(["https:", "wa.me", "/", ""]);
  expect([...parsed.searchParams.keys()]).toEqual(["text"]);
  expect(parsed.searchParams.get("text")).toBe(want);
  expect(parsed.searchParams.get("text")!.split("\n")[1]).toBe(link);
  expect(href.match(/%0A/g)).toHaveLength(3);
  expect(href).toContain(`%26pn%3D${encodeURIComponent(name)}%26am%3D${rupeesOf(v)}.00%26cu%3DINR%26tn%3D${MONTHS.en[v.month]}%2520fee%0A`);
  await expect(send).not.toHaveAttribute("aria-disabled", "true");
  await expect(part(page, "copy")).toBeEnabled();
  await expect(part(page, "reason")).toHaveCount(0);
  return href;
}

/** Send and Copy in their unavailable form, with the one shared reason. */
async function expectUnavailable(page: Page, lang: Lang): Promise<void> {
  const send = part(page, "send");
  await expect(send).toHaveAttribute("aria-disabled", "true");
  expect(await send.getAttribute("href")).toBeNull();
  await expect(part(page, "copy")).toBeDisabled();
  const reason = part(page, "reason");
  await expect(reason).toHaveText(word(lang, "fillFirst"));
  const reasonId = await reason.getAttribute("id");
  expect(await send.getAttribute("aria-describedby")).toBe(reasonId);
  expect(await part(page, "copy").getAttribute("aria-describedby")).toBe(reasonId);
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
}

const fieldOf = (control: Locator) => control.locator("xpath=ancestor::div[@data-state][1]");

// ---------------------------------------------------------------------------------------------
// 1. The message and the two links, end to end
// ---------------------------------------------------------------------------------------------

test.describe("the message, the payment link and the WhatsApp link", () => {
  test("criteria 22, 24, 32, 33, 35, 36, 37: the canvas example gives exactly the spec's message, payment link and wa.me address, and Send opens that address in a new tab", async ({ page, context }) => {
    const asked = await stubWhatsApp(context);
    await openTool(page, "en");
    await fillForm(page, canvas);

    expect(await previewText(page)).toBe(CANVAS_POLITE);
    expect(await part(page, "preview").locator('[data-slot="link"]').textContent()).toBe(CANVAS_UPI);
    const send = part(page, "send");
    await expect(send).toHaveAttribute("href", CANVAS_WA);
    await expect(send).toHaveAttribute("target", "_blank");
    await expect(send).toHaveAttribute("rel", "noopener noreferrer");
    expect(CANVAS_WA.length).toBeLessThan(2000);
    expect(await expectMessage(page, "en", "polite", canvas, "Meena%20Rao")).toBe(CANVAS_WA);

    expect(await tapSend(page)).toBe(CANVAS_WA);
    expect(asked).toEqual([CANVAS_WA]);
    expect(decodeURIComponent(asked[0].slice("https://wa.me/?text=".length))).toBe(CANVAS_POLITE);

    // Criterion 45: the form is still filled behind the new tab, and the page does not claim "sent".
    await expect(page).toHaveURL(tool("en"));
    await expect(part(page, "parent")).toHaveValue("Suresh");
    await expect(part(page, "amount")).toHaveValue("1,200");
    await expect(part(page, "upi")).toHaveValue("meena.tuitions@okhdfc");
    await expect(part(page, "payee")).toHaveValue("Meena Rao");
    // The privacy line rightly says nothing "is sent to us"; the claim to rule out is a status saying the message was sent.
    await expect(part(page, "status")).not.toHaveText(/\bsent\b/i);

    // Firm: the same link, the firm words.
    await part(page, "tone-firm").check();
    expect(await previewText(page)).toBe(CANVAS_FIRM);
    const firm = await expectMessage(page, "en", "firm", canvas, "Meena%20Rao");
    expect(firm).toContain("is%20still%20pending.%20Please%20pay%20it%20today");
    expect(await tapSend(page)).toBe(firm);
    expect(asked).toEqual([CANVAS_WA, firm]);
  });

  for (const lang of langs) {
    test(`criteria 9, 21 to 26, 35, 36, 39 [${lang}]: every message language and tone gives its exact message and link; the page's own words and address do not change`, async ({ page, context }) => {
      const asked = await stubWhatsApp(context);
      await openTool(page, lang);
      const h1 = await page.locator("h1").innerText();
      // The message language starts as the page's language, polite.
      await expect(part(page, `language-${lang}`)).toBeChecked();
      await expect(part(page, "tone-polite")).toBeChecked();
      await fillForm(page, canvas);
      await expectMessage(page, lang, "polite", canvas, "Meena%20Rao");

      const seen = new Set<string>();
      let last = "";
      for (const message of langs) {
        await part(page, `language-${message}`).check();
        for (const tone of tones) {
          await part(page, `tone-${tone}`).check();
          last = await expectMessage(page, message, tone, canvas, "Meena%20Rao");
          expect(last.length).toBeLessThan(2000);
          // The payment link is the same in every language: its note is always English.
          expect(await part(page, "preview").locator('[data-slot="link"]').textContent()).toBe(CANVAS_UPI);
          seen.add(await previewText(page));
        }
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.locator("h1")).toHaveText(h1);
        await expect(page).toHaveURL(tool(lang));
        // The month list stays in the page's language whatever the message language.
        await expect(part(page, "month").locator("option")).toHaveText([...MONTHS[lang]]);
      }
      expect(seen.size).toBe(8);
      await expect(part(page, "preview")).toHaveAttribute("translate", "no");
      expect(await tapSend(page)).toBe(last);
      expect(asked).toEqual([last]);
    });
  }

  // Names that could break a link if one character were left raw. `pn` is typed out for each.
  const hostile: { what: string; name: string; pn: string; upi: string }[] = [
    { what: "& # % +", name: "R&D Classes #1 100% A+B", pn: "R%26D%20Classes%20%231%20100%25%20A%2BB", upi: "meena.tuitions@okhdfc" },
    { what: "/ ? =", name: "A/B? C=D", pn: "A%2FB%3F%20C%3DD", upi: "ravi_kumar.99-a@okaxis" },
    { what: "a second payee smuggled in", name: "x&am=1&pa=thief@okaxis", pn: "x%26am%3D1%26pa%3Dthief%40okaxis", upi: "a_b_c@okaxis" },
    { what: "a line break", name: "Asha\nRavi", pn: "Asha%20Ravi", upi: "9876543210@ybl" },
    { what: "an emoji", name: "Meena 🙂", pn: "Meena%20%F0%9F%99%82", upi: "Meena.Rao@OkHDFC" },
    { what: "a Devanagari name", name: "मीना राव", pn: "%E0%A4%AE%E0%A5%80%E0%A4%A8%E0%A4%BE%20%E0%A4%B0%E0%A4%BE%E0%A4%B5", upi: "meena-rao_1.tuitions@ybl" },
    { what: "placeholders and $&", name: "{link} $& $1 {amount}", pn: "%7Blink%7D%20%24%26%20%241%20%7Bamount%7D", upi: "me@ok" },
    { what: "a 40-character name", name: "Wm".repeat(20), pn: "Wm".repeat(20), upi: "meena.tuitions@okhdfc" },
    { what: "outer and doubled spaces", name: "  Meena    Rao  ", pn: "Meena%20Rao", upi: "  meena.tuitions@okhdfc  " },
  ];

  test("criteria 12, 26, 31, 32, 33, 35: hostile names and odd UPI IDs still give a link with exactly five parameters, the typed pa and the typed amount", async ({ page, context }) => {
    test.setTimeout(90_000);
    const asked = await stubWhatsApp(context);
    await openTool(page, "en");
    for (const [index, bad] of hostile.entries()) {
      const v: Values = { parent: bad.name, payee: bad.name, upi: bad.upi, amount: String(1200 + index), month: index };
      await fillForm(page, v);
      const tone = tones[index % 2];
      const message = langs[index % 4];
      await part(page, `language-${message}`).check();
      await part(page, `tone-${tone}`).check();
      const href = await expectMessage(page, message, tone, v, bad.pn);
      expect(href, bad.what).toContain(`%26pn%3D${encodeURIComponent(bad.pn)}%26am%3D${1200 + index}.00%26`);
      expect(href.length, bad.what).toBeLessThan(6000);
      // The name reaches the greeting as typed (cleaned), and the link carries one payee only.
      expect((await previewText(page)).split("\n")[0], bad.what).toContain(tidy(bad.name));
      const linkLine = (await previewText(page)).split("\n").find((line) => line.startsWith("upi://")) ?? "";
      expect(linkLine.match(/[?&]pa=/g), bad.what).toHaveLength(1);
      expect(linkLine.match(/[?&](pn|am|cu|tn)=/g), bad.what).toHaveLength(4);
    }
    // The last one really leaves the page as built. A browser may write ' as %27, so compare the decoded text.
    const opened = await tapSend(page);
    expect(new URL(opened).searchParams.get("text")).toBe(await previewText(page));
    expect(asked).toHaveLength(1);
  });

  test("criteria 14, 15, 24, 33: amounts: 1,200, ₹ 1,200, Indian-script digits, ₹1 and ₹1,00,000 give exact rupees on screen and in the link", async ({ page }) => {
    await openTool(page, "en");
    await fillForm(page, canvas);
    const amount = part(page, "amount");
    const cases: [typed: string, rupees: number, text: string, field: string][] = [
      ["1,200", 1200, "₹1,200", "1,200"],
      ["₹ 1,200", 1200, "₹1,200", "1,200"],
      ["१२००", 1200, "₹1,200", "1,200"],
      ["೧೨೦೦", 1200, "₹1,200", "1,200"],
      ["౧౨౦౦", 1200, "₹1,200", "1,200"],
      ["1", 1, "₹1", "1"],
      ["5000", 5000, "₹5,000", "5,000"],
      ["100000", 100000, "₹1,00,000", "1,00,000"],
      ["1,00,000", 100000, "₹1,00,000", "1,00,000"],
      ["123456", 0, "", ""],
    ];
    for (const [typed, rupees, text, field] of cases) {
      await amount.fill(typed);
      // Not regrouped while typing (criterion 15).
      await expect(amount).toHaveValue(typed);
      if (rupees === 0) {
        // Over the limit: no link, and the field is left as typed.
        await amount.blur();
        await expect(amount).toHaveValue(typed);
        await expect(part(page, "preview").locator('[data-slot="link"]')).toHaveCount(0);
        await expectUnavailable(page, "en");
        continue;
      }
      const first = (await previewText(page)).split("\n")[0];
      expect(first, typed).toContain(`the tuition fee of ${text} for October`);
      expect(await part(page, "preview").locator('[data-slot="link"]').textContent(), typed).toBe(
        `upi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=${rupees}.00&cu=INR&tn=October%20fee`,
      );
      await amount.blur();
      await expect(amount).toHaveValue(field);
      await expect(fieldOf(amount)).toHaveAttribute("data-state", "idle");
      await expectMessage(page, "en", "polite", { ...canvas, amount: String(rupees) });
    }
  });

  test("criterion 13: with the phone's clock on 15 March the month starts on March, named in the page's language in the list and in the message's language in the message, with no year", async ({ page }) => {
    for (const lang of langs) {
      await page.clock.setFixedTime(new Date(2026, 2, 15, 10, 0, 0));
      await openTool(page, lang);
      const month = part(page, "month");
      await expect(month).toHaveValue("2");
      await expect(month.locator("option")).toHaveText([...MONTHS[lang]]);
      await expect(month.locator("xpath=preceding-sibling::span[@data-select-shown]")).toHaveText(MONTHS[lang][2]);
      await part(page, "parent").fill(canvas.parent);
      await part(page, "amount").fill(canvas.amount);
      await part(page, "upi").fill(canvas.upi);
      await part(page, "payee").fill(canvas.payee);
      for (const message of langs) {
        await part(page, `language-${message}`).check();
        await expectMessage(page, message, "polite", { ...canvas, month: 2 });
        expect(await previewText(page)).toContain(MONTHS[message][2]);
        expect(await previewText(page)).toContain("tn=March%20fee");
      }
      expect(await page.locator("body").innerText(), lang).not.toMatch(/\b20\d\d\b/);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// 2. Validation
// ---------------------------------------------------------------------------------------------

const fortyOne = "a".repeat(41);
// [field, typed, error key, the state word and the sentence in English exactly as the spec writes them]
const mistakes: [field: "parent" | "amount" | "upi" | "payee", typed: string, error: string, wordEn: string, fixEn: string][] = [
  ["parent", "", "missing", "Missing", "Type the parent's name."],
  ["parent", "   ", "missing", "Missing", "Type the parent's name."],
  ["parent", fortyOne, "tooLong", "Too long", "Use 40 characters or fewer."],
  ["amount", "", "missing", "Missing", "Type the fee in rupees."],
  ["amount", "1200.50", "paise", "Check this", "Whole rupees only. Leave out the paise."],
  ["amount", "Rs 1200", "notDigits", "Check this", "Use digits only, for example 1200."],
  ["amount", "0", "tooLow", "Too low", "The amount must be at least ₹1."],
  ["amount", "100001", "tooHigh", "Too high", "This tool allows up to ₹1,00,000."],
  ["upi", "", "missing", "Missing", "Type your UPI ID, for example name@bank."],
  ["upi", "meena tuitions@okhdfc", "space", "Check this", "Remove the spaces."],
  ["upi", "meena.tuitions", "noAt", "Check this", "A UPI ID has an @ in it, for example name@bank."],
  ["upi", "meena@ok1", "format", "Check this", "This does not look like a UPI ID. Copy it from your UPI app."],
  ["upi", "meena+fees@okhdfc", "format", "Check this", "This does not look like a UPI ID. Copy it from your UPI app."],
  ["upi", "meena&pa=thief@okaxis", "format", "Check this", "This does not look like a UPI ID. Copy it from your UPI app."],
  ["payee", "", "missing", "Missing", "Type your name."],
  ["payee", fortyOne, "tooLong", "Too long", "Use 40 characters or fewer."],
];

test.describe("validation", () => {
  for (const lang of langs) {
    test(`criteria 12, 14, 16, 18, 19, 42, 64 [${lang}]: each mistake shows its word, its mark and its sentence after the field is left; Send and Copy are unavailable with the reason; a bad value never makes a link`, async ({ page }) => {
      test.setTimeout(90_000);
      await openTool(page, lang);
      // Nothing has been touched: no error anywhere, and both buttons unavailable.
      await expect(page.locator('[data-state="error"]')).toHaveCount(0);
      await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
      await expectUnavailable(page, lang);
      // Typed but never left: no error yet (criterion 19).
      await part(page, "amount").fill("0");
      await expect(fieldOf(part(page, "amount")), "amount before it is left").not.toHaveAttribute("data-state", "error");
      await fillForm(page, canvas);
      await expectMessage(page, lang, "polite", canvas);
      await expect(page.locator('[data-state="error"]')).toHaveCount(0);

      // fillForm moved through every field, so each one has been left.
      const left = new Set<string>(["parent", "amount", "upi", "payee"]);
      for (const [name, typed, error, wordEn, fixEn] of mistakes) {
        const control = part(page, name);
        const field = fieldOf(control);
        await control.fill(typed);
        // Typed but not yet left: a field that was never left shows no error (criterion 19).
        if (!left.has(name)) await expect(field, `${name} before it is left`).not.toHaveAttribute("data-state", "error");
        await control.blur();
        left.add(name);

        const label = `${name} "${typed}"`;
        await expect(field, label).toHaveAttribute("data-state", "error");
        const stateWord = word(lang, `${name}.${error}.word`);
        const fix = word(lang, `${name}.${error}.fix`);
        if (lang === "en") expect([stateWord, fix], label).toEqual([wordEn, fixEn]);
        // The word beside the label, the drawn mark, and the sentence that says how to fix it.
        await expect(field.locator("label > span").last(), label).toHaveText(stateWord);
        await expect(field.locator("label"), label).toContainText(word(lang, `${name}.label`));
        await expect(field.locator("svg"), label).toHaveCount(1);
        await expect(field.locator("svg"), label).toBeVisible();
        const note = field.locator("p");
        await expect(note, label).toHaveText(fix);
        await expect(control, label).toHaveAttribute("aria-invalid", "true");
        expect(await control.getAttribute("aria-describedby"), label).toBe(await note.getAttribute("id"));
        await expect(page.locator('[data-state="error"]'), label).toHaveCount(1);

        // No message, no Send address, and for anything that feeds the payment link, no link at all.
        await expectUnavailable(page, lang);
        await expect(part(page, "incomplete"), label).toHaveText(word(lang, "preview.incomplete"));
        const preview = part(page, "preview");
        if (name === "parent") {
          await expect(preview.locator('[data-blank="parent"]'), label).toHaveCount(1);
        } else {
          await expect(preview.locator('[data-slot="link"]'), label).toHaveCount(0);
          await expect(preview.locator('[data-blank="link"]'), label).toHaveCount(1);
          expect(await page.locator("body").innerText(), label).not.toContain("upi://");
        }
        if (name === "upi") {
          await expect(preview.locator('[data-blank="upiId"]'), label).toHaveCount(1);
          expect(await previewText(page), label).not.toContain("@");
        }

        // Put right, without leaving the field: the error goes at once (criterion 19).
        await control.fill(canvas[name]);
        await expect(field, label).not.toHaveAttribute("data-state", "error");
        await expect(control, label).not.toHaveAttribute("aria-invalid", "true");
        await expectMessage(page, lang, "polite", canvas);
      }
    });

    test(`criteria 17, 40, 42, 64 [${lang}]: the empty tool draws blanks, says what is missing, and a well-formed UPI ID is called right in format, never verified`, async ({ page }) => {
      await openTool(page, lang);
      const preview = part(page, "preview");
      // Empty: every typed value is a drawn blank with a spoken name; the month is already there.
      const blanks = preview.locator("[data-blank]");
      expect(await blanks.evaluateAll((els) => els.map((el) => el.getAttribute("data-blank")))).toEqual(["parent", "amount", "link", "upiId"]);
      for (const blank of await blanks.all()) {
        await expect(blank).toHaveAttribute("role", "img");
        await expect(blank).toHaveAttribute("aria-label", word(lang, "preview.blank"));
        const drawn = await css(blank, ["border-bottom-style", "border-bottom-width", "width"]);
        expect(drawn["border-bottom-style"]).toBe("dashed");
        expect(parseFloat(drawn["border-bottom-width"])).toBeGreaterThanOrEqual(2);
        expect(parseFloat(drawn.width)).toBeGreaterThan(20);
      }
      await expect(part(page, "incomplete")).toHaveText(word(lang, "preview.incomplete"));
      await expectUnavailable(page, lang);
      for (const name of ["send", "copy"]) {
        const look = await css(part(page, name), ["border-top-style", "box-shadow", "background-color"]);
        expect(look["border-top-style"], name).toBe("dashed");
        expect(look["box-shadow"], name).toMatch(/^none$|^(rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(, )?)+$/);
        expect(look["background-color"], name).toBe("rgba(0, 0, 0, 0)");
      }

      // The UPI ID alone, well formed: tick, the words, and the warning that nobody checked it.
      const upi = part(page, "upi");
      await upi.fill("ravi_kumar.99-a@okaxis");
      const field = fieldOf(upi);
      await expect(field).toHaveAttribute("data-state", "correct");
      await expect(field.locator("svg")).toBeVisible();
      await expect(field.locator("p")).toHaveText(word(lang, "upi.ok.note"));
      await expect(field.locator("label .sr-only")).toHaveText(word(lang, "upi.ok.word"));
      await expect(preview.locator('[data-slot="upiId"]')).toHaveText("ravi_kumar.99-a@okaxis");
      // Still no link: it needs the name and the amount too.
      await expect(preview.locator('[data-slot="link"]')).toHaveCount(0);
      await expectUnavailable(page, lang);
      if (lang === "en") {
        expect(word("en", "upi.ok.note")).toBe("Format looks right. We cannot check this with your bank. Read it once more: the money goes to this ID.");
        expect(word("en", "fillFirst")).toBe("Fill in the fields above first.");
        expect(word("en", "preview.incomplete")).toBe("Fill in the fields above to finish the message.");
      }
      expect(await pageWords(page)).not.toMatch(/verified|verify/i);
    });
  }
});

// ---------------------------------------------------------------------------------------------
// 3. No network, ever
// ---------------------------------------------------------------------------------------------

// Words that appear nowhere on the page itself, so finding one in a request means typed text left the phone.
const typed: Values = { parent: "Zubeida Qwxparent", amount: "4321", upi: "qwxtutor.fees@okzzbank", payee: "Qwxpayee Tutorname", month: 5 };
const typedMarks = ["zubeida", "qwx", "4321", "okzzbank", "tutorname"];

/** Everything a tutor can do on the page short of Send. Returns how many different messages were drawn. */
async function useEverything(page: Page, lang: Lang): Promise<number> {
  const drawn = new Set<string>();
  await fillForm(page, typed);
  for (const message of langs) {
    await part(page, `language-${message}`).check();
    for (const tone of tones) {
      await part(page, `tone-${tone}`).check();
      await expectMessage(page, message, tone, typed);
      drawn.add(await previewText(page));
    }
  }
  for (const month of [0, 8, 11]) {
    await part(page, "month").selectOption(String(month));
    await expectMessage(page, "te", "firm", { ...typed, month });
    drawn.add(await previewText(page));
  }
  await part(page, "remember").click();
  await expect(part(page, "remember")).toHaveAttribute("aria-checked", "true");
  await part(page, "remember").click();
  await expect(part(page, "remember")).toHaveAttribute("aria-checked", "false");
  // Leave every field once, with a mistake in one of them, then put it right.
  await part(page, "amount").fill("12.5");
  await part(page, "amount").blur();
  await expect(fieldOf(part(page, "amount"))).toHaveAttribute("data-state", "error");
  await part(page, "amount").fill(typed.amount);
  for (const name of ["parent", "amount", "upi", "payee"]) {
    await part(page, name).focus();
    await part(page, name).blur();
  }
  await part(page, `language-${lang}`).check();
  await part(page, "copy").click();
  await expect(part(page, "status")).toHaveAttribute("data-result", "copied");
  return drawn.size;
}

test.describe("privacy: the page asks the network for nothing", () => {
  for (const lang of langs) {
    test(`criteria 27, 47, 48, 49, 63 [${lang}]: from load through typing, every language, tone and month, the switch and Copy there is no request at all; Send makes exactly one, to wa.me`, async ({ page, context, baseURL }) => {
      test.setTimeout(90_000);
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      const asked = await stubWhatsApp(context);
      const requests: string[] = [];
      context.on("request", (request) => requests.push(request.url()));

      await openTool(page, lang);
      await page.waitForLoadState("networkidle");
      await fontsSettled(page);
      const origin = new URL(baseURL!).origin;
      // The load itself: the page and its own static files, all from this origin.
      expect(requests.length).toBeGreaterThan(3);
      for (const url of requests) {
        expect(url.startsWith(`${origin}/`), url).toBe(true);
        const path = new URL(url).pathname;
        expect(path === tool(lang) || path.startsWith("/_next/static/") || path === "/favicon.ico", url).toBe(true);
        expect(new URL(url).search, url).toBe("");
      }
      // No script from anywhere else, no analytics, no error reporter (criterion 49).
      const scripts = await page.locator("script[src]").evaluateAll((els) => els.map((el) => (el as HTMLScriptElement).src));
      expect(scripts.length).toBeGreaterThan(0);
      for (const src of scripts) expect(src.startsWith(`${origin}/_next/static/`), src).toBe(true);
      expect(await page.content()).not.toMatch(/posthog|sentry\.io|googletagmanager|google-analytics|gtag\(|fbq\(|clarity/i);
      await expect(page.locator("form, iframe, img, link[rel='preconnect'], link[rel='dns-prefetch']")).toHaveCount(0);

      const atLoad = requests.length;
      const before = await page.evaluate(() => ({ href: location.href, history: history.length, title: document.title, cookie: document.cookie }));

      expect(await useEverything(page, lang)).toBe(11);
      // Enter in each field submits nothing and goes nowhere (criterion 48).
      for (const name of ["parent", "amount", "upi", "payee"]) {
        await part(page, name).press("Enter");
      }
      await expectMessage(page, lang, "firm", { ...typed, month: 11 });

      // Not one request: no font for another script (criterion 63), no beacon, nothing.
      expect(requests.slice(atLoad)).toEqual([]);
      expect(await page.evaluate(() => ({ href: location.href, history: history.length, title: document.title, cookie: document.cookie }))).toEqual(before);
      expect(await context.cookies()).toEqual([]);
      // The switch is off again: nothing typed is kept anywhere in the browser.
      expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []]);
      expect(await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).length : 0))).toBe(0);
      expect(await page.evaluate(() => performance.getEntriesByType("resource").length)).toBeLessThanOrEqual(atLoad);

      // Send: the one request that carries typed text, and it goes to WhatsApp, not to us.
      const href = (await part(page, "send").getAttribute("href"))!;
      const opened = await tapSend(page);
      expect(new URL(opened).searchParams.get("text")).toBe(await previewText(page));
      expect(requests.slice(atLoad)).toEqual(asked);
      expect(asked).toEqual([href]);
      for (const url of requests.filter((u) => u.startsWith(origin))) {
        for (const mark of typedMarks) expect(decodeURIComponent(url).toLowerCase(), url).not.toContain(mark);
      }
      // Still filled, still on the same address.
      await expect(part(page, "parent")).toHaveValue(typed.parent);
      await expect(page).toHaveURL(tool(lang));
    });

    test(`criterion 27 [${lang}]: with the network off after load the message still follows the form in all four languages, and Copy works`, async ({ page, context }) => {
      test.setTimeout(90_000);
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      const requests: string[] = [];
      await openTool(page, lang);
      await page.waitForLoadState("networkidle");
      context.on("request", (request) => requests.push(request.url()));
      await context.setOffline(true);

      expect(await useEverything(page, lang)).toBe(11);
      const message = messageFor(lang, "firm", { ...typed, month: 11 });
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(message);
      await expect(part(page, "send")).toHaveAttribute("href", `https://wa.me/?text=${encodeURIComponent(message)}`);
      expect(requests).toEqual([]);
      await context.setOffline(false);
      // Back online: nothing was queued to go out.
      await page.waitForLoadState("networkidle");
      expect(requests).toEqual([]);
      expect(await previewText(page)).toBe(message);
    });
  }

  test("criteria 49, 50: the privacy line is always on the page in the page's language, and typed text is marked as not to be captured", async ({ page }) => {
    for (const lang of langs) {
      await openTool(page, lang);
      await expect(part(page, "privacy")).toBeVisible();
      await expect(part(page, "privacy")).toHaveText(word(lang, "privacy"));
      expect(await part(page, "privacy").evaluate((el) => el.closest("details, a, [hidden], dialog"))).toBeNull();
      for (const name of ["tool", "parent", "amount", "upi", "payee", "month", "preview"]) {
        await expect(part(page, name), `${lang} ${name}`).toHaveAttribute("data-ph-no-capture", "");
        await expect(part(page, name), `${lang} ${name}`).toHaveAttribute("data-sentry-mask", "");
      }
    }
    expect(word("en", "privacy")).toBe("Nothing you type is sent to us or saved on our servers. The message goes to WhatsApp only when you tap Send.");
  });
});

// ---------------------------------------------------------------------------------------------
// 4. The two groups keep their height after the page wakes up
// ---------------------------------------------------------------------------------------------

test.describe("the language and tone groups", () => {
  for (const lang of langs) {
    test(`criteria 9, 10, 61 [${lang}]: after hydration, once the remember row has arrived, both groups are at least 48px tall and every segment at least 44px`, async ({ page }) => {
      await openTool(page, lang);
      await expect(part(page, "remember-row")).toBeVisible();
      // The row arrives after the page wakes up; the height bug showed only once layout had settled.
      await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
      await page.waitForTimeout(400);

      const groups = part(page, "fields").locator("> fieldset");
      await expect(groups).toHaveCount(2);
      const expected = [
        { legend: word(lang, "language"), segments: 4, rows: 2 },
        { legend: word(lang, "tone"), segments: 2, rows: 1 },
      ];
      for (const [index, want] of expected.entries()) {
        const group = groups.nth(index);
        await expect(group.locator("legend")).toHaveText(want.legend);
        const frame = group.locator("> div");
        const frameBox = (await frame.boundingBox())!;
        expect(frameBox.height, `${want.legend} group`).toBeGreaterThanOrEqual(48 * want.rows);
        expect((await group.boundingBox())!.height, `${want.legend} fieldset`).toBeGreaterThan(frameBox.height);
        const segments = group.locator("label[data-segment]");
        await expect(segments).toHaveCount(want.segments);
        for (const segment of await segments.all()) {
          const box = (await segment.boundingBox())!;
          expect(box.height, await segment.innerText()).toBeGreaterThanOrEqual(44);
          expect(box.width, await segment.innerText()).toBeGreaterThanOrEqual(44);
          await expect(segment).toBeVisible();
          // The radio is the target and fills its segment.
          const radio = (await segment.locator("input").boundingBox())!;
          expect(radio.height).toBeGreaterThanOrEqual(44);
        }
      }
      // Four endonyms, two by two, each with its own lang (criterion 9); two tones (criterion 10).
      const tops = new Set<number>();
      for (const code of langs) {
        const radio = part(page, `language-${code}`);
        const label = radio.locator("xpath=parent::label");
        await expect(label.locator(`span[lang="${code}"]`)).toHaveText(localeNames[code]);
        tops.add(Math.round((await label.boundingBox())!.y));
      }
      expect(tops.size).toBe(2);
      await expect(part(page, "tone-polite").locator("xpath=parent::label")).toHaveText(word(lang, "polite"));
      await expect(part(page, "tone-firm").locator("xpath=parent::label")).toHaveText(word(lang, "firm"));
    });
  }
});

// ---------------------------------------------------------------------------------------------
// 5. Remember on this phone
// ---------------------------------------------------------------------------------------------

const KEY = "reminder-payee";
const stored = (page: Page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])));

test.describe("remember my UPI ID and name on this phone", () => {
  test("criteria 51, 52, 53: off at the start with nothing stored; on keeps only the UPI ID and the name under one key; every language page fills them in; off forgets at once and keeps the fields", async ({ page, browser }) => {
    test.setTimeout(90_000);
    await openTool(page, "en");
    const toggle = part(page, "remember");
    await expect(toggle).toHaveAttribute("role", "switch");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(part(page, "remember-row").locator("label")).toHaveText("Remember my UPI ID and name on this phone");
    await expect(part(page, "remember-row").locator("p")).toHaveText("Turn this off to forget them.");
    expect(await toggle.getAttribute("aria-labelledby")).toBe(await part(page, "remember-row").locator("label").getAttribute("id"));
    expect(await stored(page)).toEqual({});

    // Off: typing a whole valid form stores nothing.
    await fillForm(page, canvas);
    await part(page, "payee").blur();
    expect(await stored(page)).toEqual({});

    // On: one key, holding the two cleaned values and nothing else.
    await part(page, "payee").fill("  Meena    Rao ");
    await part(page, "upi").fill(" meena.tuitions@okhdfc ");
    await part(page, "tone-firm").check();
    await part(page, "language-te").check();
    await part(page, "remember-row").locator("label").click(); // tapping the words works too
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    const exact = '{"v":1,"upiId":"meena.tuitions@okhdfc","name":"Meena Rao"}';
    await expect.poll(() => stored(page)).toEqual({ [KEY]: exact });
    expect(KEY.toLowerCase()).not.toContain(brand.name.toLowerCase());
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
    expect(await page.context().cookies()).toEqual([]);
    for (const leak of ["Suresh", "1200", "1,200", "October", "firm", "te"]) expect(exact).not.toContain(leak);

    // While on, a value that is not valid is not written: the last good pair stays.
    await part(page, "upi").fill("meena tuitions");
    await part(page, "upi").blur();
    expect(await stored(page)).toEqual({ [KEY]: exact });
    await part(page, "upi").fill("ravi_kumar.99-a@okaxis");
    const next = '{"v":1,"upiId":"ravi_kumar.99-a@okaxis","name":"Meena Rao"}';
    await expect.poll(() => stored(page)).toEqual({ [KEY]: next });

    // The next visit, in each language: the two values are back, the switch is on, nothing else came along.
    for (const lang of langs) {
      await openTool(page, lang);
      await expect(part(page, "upi"), lang).toHaveValue("ravi_kumar.99-a@okaxis");
      await expect(part(page, "payee"), lang).toHaveValue("Meena Rao");
      await expect(part(page, "remember"), lang).toHaveAttribute("aria-checked", "true");
      await expect(part(page, "parent"), lang).toHaveValue("");
      await expect(part(page, "amount"), lang).toHaveValue("");
      await expect(part(page, "tone-polite"), lang).toBeChecked();
      await expect(part(page, `language-${lang}`), lang).toBeChecked();
      await expect(fieldOf(part(page, "upi")), lang).toHaveAttribute("data-state", "correct");
      await expect(page.locator('[data-state="error"]'), lang).toHaveCount(0);
      expect(await stored(page), lang).toEqual({ [KEY]: next });
      // The remembered pair goes straight into a message.
      await part(page, "parent").fill("Suresh");
      await part(page, "amount").fill("1200");
      await part(page, "month").selectOption("9");
      await expectMessage(page, lang, "polite", { ...canvas, upi: "ravi_kumar.99-a@okaxis" });
    }

    // Another tutor, on another phone, sees none of it.
    const other = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
    const theirs = await other.newPage();
    await openTool(theirs, "hi");
    await expect(part(theirs, "upi")).toHaveValue("");
    await expect(part(theirs, "payee")).toHaveValue("");
    await expect(part(theirs, "remember")).toHaveAttribute("aria-checked", "false");
    expect(await stored(theirs)).toEqual({});
    await other.close();

    // Off: gone in the same tap, and the fields keep what they show (criterion 53).
    await openTool(page, "hi");
    await page.evaluate(() => {
      const gone: (string | null)[] = [];
      (window as unknown as { gone: (string | null)[] }).gone = gone;
      document.querySelector('[data-testid="reminder-remember"]')!.addEventListener("click", () => setTimeout(() => gone.push(localStorage.getItem("reminder-payee")), 0));
    });
    await part(page, "remember").click();
    await expect(part(page, "remember")).toHaveAttribute("aria-checked", "false");
    await expect.poll(() => page.evaluate(() => (window as unknown as { gone: unknown[] }).gone)).toEqual([null]);
    expect(await stored(page)).toEqual({});
    await expect(part(page, "upi")).toHaveValue("ravi_kumar.99-a@okaxis");
    await expect(part(page, "payee")).toHaveValue("Meena Rao");
    // Typing on with the switch off stores nothing again.
    await part(page, "payee").fill("Someone Else");
    await part(page, "payee").blur();
    expect(await stored(page)).toEqual({});
    await openTool(page, "kn");
    await expect(part(page, "upi")).toHaveValue("");
    await expect(part(page, "payee")).toHaveValue("");
    await expect(part(page, "remember")).toHaveAttribute("aria-checked", "false");
  });

  test("criterion 54: where the browser refuses to store, there is no switch, no error, and the tool still writes the message", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      };
    });
    for (const lang of langs) {
      await openTool(page, lang);
      await fillForm(page, canvas);
      await expectMessage(page, lang, "polite", canvas);
      await expect(part(page, "remember-row")).toHaveCount(0);
      await expect(part(page, "remember")).toHaveCount(0);
      await expect(page.locator('[role="switch"]')).toHaveCount(0);
      expect(await page.locator("main").innerText()).not.toContain(word(lang, "remember.label"));
      expect(await stored(page)).toEqual({});
    }
    expect(errors).toEqual([]);
  });

  test("criterion 54: a stored value that no longer passes its rule is ignored and removed", async ({ page }) => {
    const spoiled = [
      "not json",
      '{"v":1,"upiId":"meena tuitions","name":"Meena Rao"}',
      '{"v":1,"upiId":"meena.tuitions@okhdfc","name":"' + "a".repeat(41) + '"}',
      '{"v":2,"upiId":"meena.tuitions@okhdfc","name":"Meena Rao"}',
      '{"v":1,"upiId":"meena.tuitions@okhdfc"}',
    ];
    for (const value of spoiled) {
      await page.goto(tool("en"));
      await page.evaluate((v) => localStorage.setItem("reminder-payee", v), value);
      await openTool(page, "en");
      await expect(part(page, "upi"), value).toHaveValue("");
      await expect(part(page, "payee"), value).toHaveValue("");
      await expect(part(page, "remember"), value).toHaveAttribute("aria-checked", "false");
      await expect.poll(() => stored(page), value).toEqual({});
    }
  });
});

// ---------------------------------------------------------------------------------------------
// 6. Copy
// ---------------------------------------------------------------------------------------------

test.describe("copy message", () => {
  for (const lang of langs) {
    test(`criteria 36, 43, 45 [${lang}]: Copy puts exactly the previewed message on the clipboard, says so with a tick for about 3 seconds, and the confirmation goes when the message changes`, async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await openTool(page, lang);
      await fillForm(page, canvas);
      const want = messageFor(lang, "polite", canvas);
      const copy = part(page, "copy");
      const status = part(page, "status");
      // The polite region is on the page, empty, before anything is copied.
      await expect(status).toHaveAttribute("role", "status");
      await expect(status).toHaveText("");
      await expect(copy).toHaveText(word(lang, "copy"));

      await page.evaluate(() => {
        const button = document.querySelector('[data-testid="reminder-copy"]')!;
        const marks: number[] = [];
        (window as unknown as { marks: number[] }).marks = marks;
        new MutationObserver(() => marks.push(performance.now())).observe(button, { attributes: true, attributeFilter: ["data-copied"] });
      });
      await copy.click();
      await expect(copy).toHaveAttribute("data-copied", "true");
      await expect(copy).toHaveText(word(lang, "copied"));
      await expect(copy.locator("svg")).toBeVisible();
      await expect(status).toHaveAttribute("data-result", "copied");
      await expect(status.locator("span")).toHaveText(word(lang, "copiedStatus"));
      await expect(status.locator("svg")).toBeVisible();
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      expect(clip).toBe(want);
      expect(clip).toBe(await previewText(page));
      expect(clip).toBe(new URL((await part(page, "send").getAttribute("href"))!).searchParams.get("text"));

      // It returns by itself after about 3 seconds, measured inside the page.
      await expect(copy).not.toHaveAttribute("data-copied", "true", { timeout: 6000 });
      await expect(copy).toHaveText(word(lang, "copy"));
      await expect(status).toHaveText("");
      const marks = await page.evaluate(() => (window as unknown as { marks: number[] }).marks);
      expect(marks).toHaveLength(2);
      expect(marks[1] - marks[0]).toBeGreaterThan(2500);
      expect(marks[1] - marks[0]).toBeLessThan(4000);

      // Copy again, then change the message: the confirmation is about the old text and goes at once.
      await copy.click();
      await expect(copy).toHaveAttribute("data-copied", "true");
      await part(page, "parent").fill("Ramesh");
      await expect(copy).not.toHaveAttribute("data-copied", "true", { timeout: 1000 });
      await expect(copy).toHaveText(word(lang, "copy"));
      await expect(status).toHaveText("");
      // The fields are kept for the next parent (criterion 45), and the next copy is the new message.
      await expect(part(page, "upi")).toHaveValue(canvas.upi);
      await copy.click();
      await expect(copy).toHaveAttribute("data-copied", "true");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(messageFor(lang, "polite", { ...canvas, parent: "Ramesh" }));
      if (lang === "en") {
        expect([word("en", "copy"), word("en", "copied"), word("en", "copiedStatus")]).toEqual(["Copy message", "Copied", "Message copied."]);
      }
    });

    test(`criteria 44, 64 [${lang}]: with the clipboard blocked the failure line and its mark show, the button does not claim "Copied", and the rest still works`, async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new DOMException("blocked", "NotAllowedError")) } });
        document.execCommand = () => false;
      });
      await openTool(page, lang);
      await fillForm(page, canvas);
      const copy = part(page, "copy");
      const status = part(page, "status");
      await copy.click();
      await expect(status).toHaveAttribute("data-result", "failed");
      await expect(status).toHaveAttribute("role", "status");
      await expect(status.locator("span")).toHaveText(word(lang, "copyFailed"));
      await expect(status.locator("svg")).toBeVisible();
      await expect(copy).not.toHaveAttribute("data-copied", "true");
      await expect(copy).toHaveText(word(lang, "copy"));
      // Nothing else broke: the message and the Send link are whole, and the text can be selected by hand.
      await expectMessage(page, lang, "polite", canvas);
      expect((await css(part(page, "preview"), ["user-select"]))["user-select"]).toBe("text");
      // The failure is about this message; it goes when the message changes.
      await part(page, "tone-firm").check();
      await expect(status).not.toHaveAttribute("data-result", "failed");
      await expect(status).toHaveText("");
      if (lang === "en") expect(word("en", "copyFailed")).toBe("Could not copy. Press and hold the message to select it.");
    });
  }

  test("criterion 44: with no clipboard at all (an old in-app browser) Copy fails the same way and throws nothing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
      document.execCommand = () => {
        throw new Error("no execCommand");
      };
    });
    await openTool(page, "en");
    await fillForm(page, canvas);
    await part(page, "copy").click();
    await expect(part(page, "status")).toHaveAttribute("data-result", "failed");
    await expect(part(page, "status").locator("span")).toHaveText("Could not copy. Press and hold the message to select it.");
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// 7. Layout and type
// ---------------------------------------------------------------------------------------------

const longUpi = `${"a".repeat(256)}@${"b".repeat(64)}`;
const cut = (text: string) => Array.from(text.repeat(8)).slice(0, 40).join("");
const longName: Record<Lang, string> = {
  en: cut("Venkatasubrahmanyeshwara Lakshminarasimhan "),
  hi: cut("वेंकटसुब्रह्मण्येश्वर लक्ष्मीनरसिंहन "),
  kn: cut("ವೆಂಕಟಸುಬ್ರಹ್ಮಣ್ಯೇಶ್ವರ ಲಕ್ಷ್ಮೀನರಸಿಂಹನ್ "),
  te: cut("వెంకటసుబ్రహ్మణ్యేశ్వర లక్ష్మీనరసింహన్ "),
};
// The footer's wordmark is clipped on purpose (aria-hidden, in overflow-hidden), as on the landing.
const notWordmark = (p: { text: string; where: string }) => !(p.text === brand.name && p.where.includes("footer"));

/** Controls the landing helper does not look at: the select, the switch and the segments. */
function smallControls(page: Page): Promise<{ what: string; width: number; height: number }[]> {
  return page.evaluate(() => {
    const out: { what: string; width: number; height: number }[] = [];
    for (const el of document.querySelectorAll('select, [role="switch"], label[data-segment], input[type="radio"], textarea')) {
      const r = el.getBoundingClientRect();
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) out.push({ what: `${el.tagName.toLowerCase()} ${el.getAttribute("data-testid") ?? el.getAttribute("data-segment") ?? ""}`, width: r.width, height: r.height });
    }
    return out;
  });
}

async function expectSound(page: Page, label: string): Promise<void> {
  expect(await sidewaysScroll(page), `${label}: sideways scroll`).toBe(0);
  expect((await textProblems(page, "body")).filter(notWordmark), `${label}: text`).toEqual([]);
  expect(await smallTargets(page), `${label}: links and buttons`).toEqual([]);
  expect(await smallControls(page), `${label}: select, switch, segments, fields`).toEqual([]);
  expect(await smallText(page), `${label}: small text`).toEqual([]);
}

test.describe("layout at 360px and at the largest text size", () => {
  for (const lang of langs) {
    test(`criteria 59, 60, 61 [${lang}]: empty, with the longest values, and at 200% with values and with every error showing: no sideways scroll, nothing clipped, every control 44px or more, no text under 14px`, async ({ page }) => {
      test.setTimeout(120_000);
      await openTool(page, lang);
      await expect(part(page, "remember-row")).toBeVisible();
      await expectSound(page, "empty");

      const longest: Values = { parent: "W".repeat(40), amount: "100000", upi: longUpi, payee: longName[lang], month: 8 };
      await fillForm(page, longest);
      await part(page, "amount").blur();
      await expect(part(page, "amount")).toHaveValue("1,00,000");
      const other = langs[(langs.indexOf(lang) + 1) % 4];
      for (const message of [lang, other]) {
        await part(page, `language-${message}`).check();
        const href = await expectMessage(page, message, "firm" === "firm" && message === other ? "firm" : "polite", longest).catch(async () => {
          await part(page, "tone-polite").check();
          return expectMessage(page, message, "polite", longest);
        });
        expect(href.length).toBeLessThan(6000);
        await expectSound(page, `longest values, ${message} message`);
      }
      // The UPI ID wraps and its field grows; all 321 characters are on screen.
      const upiBox = (await part(page, "upi").boundingBox())!;
      expect(upiBox.height).toBeGreaterThan(48 * 3);
      expect(upiBox.x + upiBox.width).toBeLessThanOrEqual(360);
      expect(await part(page, "upi").evaluate((el) => (el as HTMLTextAreaElement).scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      const month = part(page, "month").locator("xpath=preceding-sibling::span[@data-select-shown]");
      await expect(month).toHaveText(MONTHS[lang][8]);
      const upiHeight = upiBox.height;
      const sendHeight = (await part(page, "send").boundingBox())!.height;
      const segmentHeight = (await part(page, "tone-polite").locator("xpath=parent::label").boundingBox())!.height;

      // The phone's largest text size.
      await largestText(page);
      await fontsSettled(page);
      await expectSound(page, "200%, longest values");
      // They grow in height rather than cut their words (criterion 60).
      expect((await part(page, "upi").boundingBox())!.height).toBeGreaterThan(upiHeight);
      expect((await part(page, "send").boundingBox())!.height).toBeGreaterThan(sendHeight);
      expect((await part(page, "tone-polite").locator("xpath=parent::label").boundingBox())!.height).toBeGreaterThan(segmentHeight);
      const shownMonth = (await month.boundingBox())!;
      const select = (await part(page, "month").boundingBox())!;
      expect(await month.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      expect(select.height).toBeGreaterThanOrEqual(shownMonth.height);
      expect(select.width).toBeGreaterThanOrEqual(shownMonth.width);

      // Every error at once, still at 200%.
      for (const name of ["parent", "amount", "upi", "payee"]) {
        await part(page, name).fill("");
        await part(page, name).blur();
      }
      await expect(page.locator('[data-state="error"]')).toHaveCount(4);
      await expectUnavailable(page, lang);
      await expectSound(page, "200%, four errors");
    });

    test(`criteria 34, 39, 41, 63 [${lang}]: the link is text in DM Mono, never something to tap; Send is blue and Copy is paper; nothing red can be pressed; another script's message is drawn with room and no new font file`, async ({ page }) => {
      const fonts: string[] = [];
      page.on("request", (request) => {
        if (/\.woff2?(\?|$)/.test(request.url())) fonts.push(request.url());
      });
      await openTool(page, lang);
      await fillForm(page, canvas);
      const atLoad = fonts.length;
      const preview = part(page, "preview");
      await expect(page.locator('a[href^="upi:"]')).toHaveCount(0);
      await expect(preview.locator("a")).toHaveCount(0);
      const mono = await familyOf(page, "--font-dm-mono");
      expect(mono).toMatch(/DM Mono/i);
      expect(await firstFamily(preview.locator('[data-slot="link"]'))).toBe(mono);
      expect(await firstFamily(preview.locator('[data-slot="upiId"]'))).toBe(mono);
      const look = await css(preview, ["user-select", "white-space", "background-color", "overflow-wrap"]);
      expect(look["user-select"]).toBe("text");
      expect(look["white-space"]).toBe("pre-wrap");
      expect(look["background-color"]).toBe(rgb("bubble"));
      expect(look["overflow-wrap"]).toBe("anywhere");
      await expect(page.getByRole("heading", { level: 2, name: word(lang, "preview.title") })).toBeVisible();

      // Send blue, large and full width with its icon; Copy paper; nothing but the header is red.
      const send = part(page, "send");
      expect((await css(send, ["background-color"]))["background-color"]).toBe(rgb("blue"));
      expect((await css(part(page, "copy"), ["background-color"]))["background-color"]).toBe(rgb("slip"));
      await expect(send).toHaveText(word(lang, "send"));
      await expect(send.locator("svg")).toBeVisible();
      const sendBox = (await send.boundingBox())!;
      const copyBox = (await part(page, "copy").boundingBox())!;
      expect(sendBox.height).toBeGreaterThanOrEqual(56);
      expect(sendBox.width).toBeGreaterThan(300);
      expect(copyBox.width).toBe(sendBox.width);
      const red = await page.evaluate((cloth) => {
        return [...document.querySelectorAll("a, button, input, select, textarea, [role='switch'], [role='button']")]
          .filter((el) => getComputedStyle(el).backgroundColor === cloth)
          .map((el) => el.outerHTML.slice(0, 80));
      }, rgb("cloth"));
      expect(red).toEqual([]);
      for (const control of await page.locator("a, button").all()) {
        expect(parseFloat((await css(control, ["border-top-left-radius"]))["border-top-left-radius"])).toBeLessThanOrEqual(4);
      }

      // Each message language in turn: line-height at least 1.6, and not one more font file (criterion 63).
      for (const message of langs) {
        await part(page, `language-${message}`).check();
        await expect(preview).toHaveAttribute("lang", message);
        await fontsSettled(page);
        const type = await css(preview, ["line-height", "font-size", "letter-spacing", "text-transform"]);
        expect(parseFloat(type["line-height"]) / parseFloat(type["font-size"]), message).toBeGreaterThanOrEqual(1.599);
        expect(parseFloat(type["font-size"]), message).toBeGreaterThanOrEqual(14);
        expect(["normal", "0px"], message).toContain(type["letter-spacing"]);
        expect(type["text-transform"], message).toBe("none");
        expect(await firstFamily(preview), message).not.toMatch(/Anek/);
      }
      expect(fonts.slice(atLoad)).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------------------------
// 8. The page around the tool
// ---------------------------------------------------------------------------------------------

test.describe("route, landmarks, links and copy", () => {
  test("criterion 1: four prerendered pages, each with its own html lang, its h1 and an inert form in the delivered HTML", async ({ request }) => {
    for (const lang of langs) {
      expect(builtFileFor(tool(lang)), lang).toBe(true);
      const response = await request.get(tool(lang));
      expect(response.status(), lang).toBe(200);
      expect(response.headers()["content-type"], lang).toContain("text/html");
      const raw = await response.text();
      expect(raw, lang).toBe(readFileSync(join(OUT, lang, "tools", "fee-reminder", "index.html"), "utf8"));
      expect(htmlLang(raw), lang).toBe(lang);
      expect(raw.match(/<h1\b/g), lang).toHaveLength(1);
      expect(raw, lang).toContain(shown(lang, "reminder.title"));
      expect(raw, lang).toMatch(/<fieldset[^>]*\bdisabled=""[^>]*data-testid="reminder-form"|<fieldset[^>]*data-testid="reminder-form"[^>]*\bdisabled=""/);
      expect(raw, lang).not.toContain("TODO-translate");
      expect(raw, lang).not.toContain("upi://");
    }
  });

  test("criterion 2: the unprefixed address is the 404 with its four language links", async ({ page, request }) => {
    for (const address of ["/tools/fee-reminder/", "/tools/fee-reminder"]) {
      expect((await request.get(address)).status(), address).toBe(404);
      const response = await page.goto(address);
      expect(response!.status(), address).toBe(404);
      await expect(page.locator("h1")).toHaveText(brand.name);
      await expect(page.locator("a[href]")).toHaveCount(4);
      expect(await page.locator("a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual(["/en/", "/hi/", "/kn/", "/te/"]);
      await expect(page.getByTestId("reminder-tool")).toHaveCount(0);
    }
    expect(builtFileFor("/tools/fee-reminder/")).toBe(false);
  });

  for (const lang of langs) {
    test(`criteria 6, 7, 8, 11, 20 [${lang}]: one header, main, footer and h1; the brand links home; footer languages point at the tool; every link resolves; fields start empty with labels`, async ({ page }) => {
      await openTool(page, lang);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      for (const landmark of ["header", "main", "footer", "h1"]) await expect(page.locator(landmark)).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(shown(lang, "reminder.title"));
      await expect(page.locator("main").getByText(shown(lang, "reminder.kicker"), { exact: true })).toBeVisible();
      await expect(page.locator("form")).toHaveCount(0);

      const home = page.locator("header a");
      await expect(home).toHaveCount(1);
      await expect(home).toHaveText(brand.name);
      await expect(home).toHaveAttribute("href", `/${lang}/`);
      await expect(page.locator('a[href*="receipt"]')).toHaveCount(0);

      // Footer: three links to the tool in the other languages; the current one is marked and not a link.
      const nav = page.locator("footer nav");
      const others = langs.filter((code) => code !== lang);
      expect(await nav.locator("a").evaluateAll((els) => els.map((el) => [el.getAttribute("href"), el.getAttribute("lang"), el.textContent]))).toEqual(
        others.map((code) => [tool(code), code, localeNames[code]]),
      );
      const current = nav.locator('[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(localeNames[lang]);
      expect(await current.evaluate((el) => el.tagName)).toBe("SPAN");

      // Every link is an anchor on this page or a built file; the unavailable Send has no address.
      const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
      expect(hrefs.sort()).toEqual([`/${lang}/`, `/${lang}/#waitlist`, ...others.map(tool)].sort());
      for (const href of hrefs) {
        expect(builtFileFor(href), href).toBe(true);
        const hash = href.split("#")[1];
        if (hash) expect(readFileSync(join(OUT, href.split("#")[0], "index.html"), "utf8"), href).toContain(`id="${hash}"`);
      }
      await expect(page.locator("a:not([href])")).toHaveCount(1);
      await expect(page.locator("a:not([href])")).toHaveAttribute("data-testid", "reminder-send");
      // Filled in, the one address outside the site is WhatsApp's.
      await fillForm(page, canvas);
      const outside = (await page.locator("a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""))).filter((href) => !href.startsWith("/"));
      expect(outside).toHaveLength(1);
      expect(outside[0].startsWith("https://wa.me/?text=")).toBe(true);
      await openTool(page, lang);

      // Fields: empty, example only as a placeholder, a visible label tied to each (criteria 11, 20).
      const placeholders = { parent: word(lang, "parent.placeholder"), amount: word(lang, "amount.placeholder"), upi: "name@bank", payee: word(lang, "payee.placeholder") };
      for (const [name, placeholder] of Object.entries(placeholders)) {
        const control = part(page, name);
        await expect(control, name).toHaveValue("");
        await expect(control, name).toHaveAttribute("placeholder", placeholder);
        await expect(control, name).toHaveAttribute("autocomplete", "off");
        expect(await control.getAttribute("name"), name).toBeNull();
        const label = page.locator(`label[for="${await control.getAttribute("id")}"]`);
        await expect(label, name).toBeVisible();
        await expect(label, name).toHaveText(word(lang, `${name}.label`));
      }
      await expect(page.locator(`label[for="${await part(page, "month").getAttribute("id")}"]`)).toHaveText(word(lang, "month.label"));
      const upi = part(page, "upi");
      await expect(upi).toHaveAttribute("autocapitalize", "none");
      await expect(upi).toHaveAttribute("autocorrect", "off");
      await expect(upi).toHaveAttribute("spellcheck", "false");
      await expect(part(page, "amount")).toHaveAttribute("inputmode", "numeric");
      await expect(fieldOf(part(page, "payee")).locator("p")).toHaveText(word(lang, "payee.helper"));
      // The order of the form (the canvas order, "Your name" last, then the switch).
      const order = await part(page, "form").evaluate((el) => [...el.querySelectorAll("[data-testid]")].map((node) => node.getAttribute("data-testid")));
      expect(order).toEqual([
        "reminder-fields",
        ...langs.map((code) => `reminder-language-${code}`),
        "reminder-tone-polite",
        "reminder-tone-firm",
        "reminder-parent",
        "reminder-month",
        "reminder-amount",
        "reminder-upi",
        "reminder-payee",
        "reminder-remember-row",
        "reminder-remember",
      ]);
    });

    test(`criterion 7 [${lang}]: following a footer language link is a plain move to the tool in that language and saves no language choice`, async ({ page }) => {
      await openTool(page, lang);
      const other = langs.find((code) => code !== lang)!;
      await page.locator("footer nav").getByRole("link", { name: localeNames[other] }).click();
      await expect(page).toHaveURL(tool(other));
      await expect(page.locator("html")).toHaveAttribute("lang", other);
      await expect(page.locator("h1")).toHaveText(shown(other, "reminder.title"));
      await expect(part(page, `language-${other}`)).toBeChecked();
      expect(await stored(page)).toEqual({});
      expect(await page.evaluate(() => localStorage.getItem("ui-language"))).toBeNull();
    });

    test(`criteria 55, 56, 57 [${lang}]: the kicker, the headline and the yellow block say what the spec says and promise nothing more`, async ({ page }) => {
      await openTool(page, lang);
      const promo = part(page, "promo");
      await expect(promo.locator("h2")).toHaveText(shown(lang, "reminder.promo.title"));
      await expect(promo.locator("p")).toHaveText(shown(lang, "reminder.promo.body"));
      await expect(promo.locator("p")).toContainText(brand.name);
      const join = promo.locator("a");
      await expect(join).toHaveCount(1);
      await expect(join).toHaveText(shown(lang, "reminder.promo.join"));
      await expect(join).toHaveAttribute("href", `/${lang}/#waitlist`);
      await expect(promo.locator("form, input, select, textarea, button")).toHaveCount(0);
      expect((await css(promo, ["background-color"]))["background-color"]).toBe(rgb("highlight"));
      const words = await pageWords(page);
      expect(words).not.toMatch(/₹\s?149|₹\s?999|\bPro\b|automatic|receipt|tracked|one tap/i);
      expect(words).not.toContain("TODO-translate");
      expect(words).not.toContain("{brand}");
      if (lang === "en") {
        await expect(page.locator("main > p").first()).toHaveText("Free tool · no sign-up");
        await expect(page.locator("h1")).toHaveText("Write the fee reminder you keep putting off.");
        await expect(promo.locator("h2")).toHaveText("Doing this for 20 parents every month?");
        await expect(promo.locator("p")).toHaveText(`The ${brand.name} app is coming soon. It will remember every student and remind them all in a minute.`);
        await expect(join).toHaveText("Join the waitlist");
        await expect(part(page, "fields").locator("legend").first()).toHaveText("Message language");
      }
      // Following it lands on the landing's waitlist block.
      await join.click();
      await expect(page).toHaveURL(`/${lang}/#waitlist`);
      await expect(page.locator("section#waitlist")).toBeInViewport();
    });

    test(`criteria 3, 5 [${lang}]: the landing's hero link and tool card 2 both open the reminder writer in the same language`, async ({ page }) => {
      for (const link of ["hero", "card"] as const) {
        await page.goto(`/${lang}/`);
        const target = link === "hero" ? page.locator("main section").first().locator("a").nth(1) : page.locator("section#tools article").nth(1).locator("a");
        await expect(target).toHaveText(shown(lang, link === "hero" ? "landing.hero.tool" : "landing.tools.t2.open"));
        await target.click();
        await expect(page).toHaveURL(tool(lang));
        await expect(page.locator("h1")).toHaveText(shown(lang, "reminder.title"));
        await expect(part(page, "parent")).toBeEnabled();
        // And back: the brand name in the tool's header is the way home.
        await page.locator("header a").click();
        await expect(page).toHaveURL(`/${lang}/`);
      }
    });
  }

  test("criteria 65, 66: each page's raw HTML has its own title and description, a canonical, the same five hreflang entries and Open Graph with its locale and no image", async ({ request }) => {
    const base = `https://${brand.domain}`;
    const alternates = [...langs.map((code) => `${base}${tool(code)}`), `${base}${tool("en")}`];
    const seenTitles = new Set<string>();
    const seenDescriptions = new Set<string>();
    for (const lang of langs) {
      const raw = await (await request.get(tool(lang))).text();
      const title = titles(raw);
      expect(title, lang).toEqual([shown(lang, "reminder.meta.title")]);
      const tags = headTags(raw);
      const descriptions = tags.filter((tag) => tag.attrs.name === "description").map((tag) => tag.attrs.content);
      expect(descriptions, lang).toEqual([shown(lang, "reminder.meta.description")]);
      seenTitles.add(title[0]);
      seenDescriptions.add(descriptions[0]);
      const canonical = tags.filter((tag) => tag.name === "link" && tag.attrs.rel === "canonical").map((tag) => tag.attrs.href);
      expect(canonical, lang).toEqual([`${base}${tool(lang)}`]);
      const alt = tags.filter((tag) => tag.name === "link" && tag.attrs.rel === "alternate" && tag.attrs.hreflang);
      expect(alt.map((tag) => tag.attrs.hreflang), lang).toEqual(["en", "hi", "kn", "te", "x-default"]);
      expect(alt.map((tag) => tag.attrs.href), lang).toEqual(alternates);
      const og = (property: string) => tags.filter((tag) => tag.attrs.property === property).map((tag) => tag.attrs.content);
      expect(og("og:title"), lang).toEqual(title);
      expect(og("og:description"), lang).toEqual(descriptions);
      expect(og("og:url"), lang).toEqual([`${base}${tool(lang)}`]);
      expect(og("og:locale"), lang).toEqual([ogLocales[lang]]);
      expect(tags.filter((tag) => /image/.test(tag.attrs.name ?? "") || /image/.test(tag.attrs.property ?? "")), lang).toEqual([]);
      expect(tags.filter((tag) => tag.attrs.name === "robots"), lang).toEqual([]);
      // The landing's own tags are not the tool's.
      const landing = headTags(await (await request.get(`/${lang}/`)).text());
      expect(landing.filter((tag) => tag.attrs.rel === "canonical").map((tag) => tag.attrs.href), lang).toEqual([`${base}/${lang}/`]);
    }
    expect(seenTitles.size).toBe(4);
    expect(seenDescriptions.size).toBe(4);
    expect(shown("en", "reminder.meta.title")).toBe("Fee reminder writer for tutors: WhatsApp message + UPI link");
    expect(shown("en", "reminder.meta.title").length).toBeLessThanOrEqual(60);
    expect(shown("en", "reminder.meta.description")).toBe(
      "Write a polite or firm tuition fee reminder in English, Hindi, Kannada or Telugu, with your UPI payment link. Free, no sign-up, nothing saved.",
    );
    expect(shown("en", "reminder.meta.description").length).toBeLessThanOrEqual(155);
  });
});

// ---------------------------------------------------------------------------------------------
// 9. Slow network, JavaScript off, keyboard
// ---------------------------------------------------------------------------------------------

test.describe("the key flow on slow 4G, one run per language", () => {
  for (const lang of langs) {
    test(`criteria 1, 13, 35 [${lang}]: on slow 4G the form is inert until the page wakes up, nothing typed after that is lost, and the message and Send link are exact`, async ({ page, context }) => {
      test.setTimeout(120_000);
      const asked = await stubWhatsApp(context);
      await slow4G(page);
      // Hold the scripts back so the page is on screen, drawn, before it can wake up.
      let release = () => {};
      const held = new Promise<void>((done) => (release = done));
      await page.route("**/_next/static/**/*.js", async (route) => {
        await held;
        await route.continue();
      });
      await page.goto(tool(lang), { waitUntil: "commit" });
      await expect(page.locator("h1")).toHaveText(shown(lang, "reminder.title"));
      // Readable but inert: a tutor cannot type into a field that would throw the text away.
      await expect(part(page, "form")).toHaveAttribute("disabled", "");
      for (const name of ["parent", "amount", "upi", "payee", "month", "language-en", "tone-firm", "copy"]) {
        await expect(part(page, name), name).toBeDisabled();
      }
      await expect(part(page, "send")).toHaveAttribute("aria-disabled", "true");
      await expect(part(page, "remember")).toHaveCount(0);
      expect(await part(page, "parent").evaluate((el) => (el as HTMLTextAreaElement).value)).toBe("");
      release();

      // The moment it wakes up (a disabled field cannot take focus, so a person cannot type before that),
      // type like a person, and keep typing while the rest still arrives.
      await expect(part(page, "parent")).toBeEnabled();
      await part(page, "parent").pressSequentially(canvas.parent);
      await part(page, "month").selectOption("9");
      await part(page, "amount").pressSequentially(canvas.amount);
      await part(page, "upi").pressSequentially(canvas.upi);
      await part(page, "payee").pressSequentially(canvas.payee);
      await page.waitForLoadState("load");
      await fontsSettled(page);
      await expect(part(page, "parent")).toHaveValue(canvas.parent);
      await expect(part(page, "amount")).toHaveValue("1,200");
      await expect(part(page, "upi")).toHaveValue(canvas.upi);
      await expect(part(page, "payee")).toHaveValue(canvas.payee);
      const href = await expectMessage(page, lang, "polite", canvas, "Meena%20Rao");
      if (lang === "en") expect(href).toBe(CANVAS_WA);
      expect(await tapSend(page)).toBe(href);
      expect(asked).toEqual([href]);
      expect(await sidewaysScroll(page)).toBe(0);
    });
  }
});

test.describe("JavaScript off (criterion 46)", () => {
  test.use({ javaScriptEnabled: false });

  for (const lang of langs) {
    test(`criterion 46 [${lang}]: the heading, the form and its words are there in the page's language, with the line that says JavaScript is needed, and every control is inert`, async ({ page }) => {
      await page.goto(tool(lang));
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("h1")).toHaveText(shown(lang, "reminder.title"));
      const line = part(page, "noscript");
      await expect(line).toBeVisible();
      await expect(line).toHaveText(shown(lang, "reminder.noscript"));
      if (lang === "en") await expect(line).toHaveText("This tool needs JavaScript turned on.");
      // A mark as well as the words: a dashed box.
      expect((await css(line, ["border-top-style"]))["border-top-style"]).toBe("dashed");
      for (const key of ["language", "tone", "parent.label", "month.label", "amount.label", "upi.label", "payee.label", "preview.title", "send", "copy", "privacy", "fillFirst"]) {
        await expect(page.locator("main").getByText(word(lang, key), { exact: true }).first(), key).toBeVisible();
      }
      for (const name of ["parent", "amount", "upi", "payee", "month", "copy", ...langs.map((code) => `language-${code}`), "tone-polite", "tone-firm"]) {
        await expect(part(page, name), name).toBeDisabled();
      }
      await expect(part(page, "send")).toHaveAttribute("aria-disabled", "true");
      expect(await part(page, "send").getAttribute("href")).toBeNull();
      await expect(part(page, "remember")).toHaveCount(0);
      expect(await sidewaysScroll(page)).toBe(0);
      // The plain links still work.
      await page.locator("header a").click();
      await expect(page).toHaveURL(`/${lang}/`);
    });
  }
});

test.describe("keyboard only", () => {
  test("criteria 20, 37, 43, 61: the whole flow with Tab, arrows, Space and Enter, with a visible focus mark at every stop", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const asked = await stubWhatsApp(context);
    await page.clock.setFixedTime(new Date(2026, 9, 10, 10, 0, 0));
    await openTool(page, "en");

    const focused = () => page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? "");
    /** The focus mark: a 3px ring on the control, or the thick blue line under a field. */
    const focusMark = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const own = getComputedStyle(el);
        const ring = own.outlineStyle !== "none" && parseFloat(own.outlineWidth) >= 3 && own.outlineColor !== "rgba(0, 0, 0, 0)";
        const line = el.parentElement ? parseFloat(getComputedStyle(el.parentElement).borderBottomWidth) >= 4 : false;
        return { visible: el.matches(":focus-visible"), ring, line };
      });
    const stop = async (testId: string) => {
      await page.keyboard.press("Tab");
      expect(await focused()).toBe(testId);
      const mark = await focusMark();
      expect(mark.visible, testId).toBe(true);
      expect(mark.ring || mark.line, `${testId} shows no focus mark`).toBe(true);
    };

    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("header") !== null && document.activeElement?.tagName === "A")).toBe(true);
    expect((await focusMark()).ring).toBe(true);

    // Message language: one stop; arrows move the choice.
    await stop("reminder-language-en");
    await page.keyboard.press("ArrowRight");
    expect(await focused()).toBe("reminder-language-hi");
    await expect(part(page, "preview")).toHaveAttribute("lang", "hi");
    expect((await focusMark()).ring).toBe(true);
    await page.keyboard.press("ArrowLeft");
    await expect(part(page, "language-en")).toBeChecked();

    await stop("reminder-tone-polite");
    await page.keyboard.press("ArrowRight");
    await expect(part(page, "tone-firm")).toBeChecked();

    await stop("reminder-parent");
    await page.keyboard.type("Suresh");
    await stop("reminder-month");
    await expect(part(page, "month")).toHaveValue("9");
    await page.keyboard.type("Nov");
    await expect(part(page, "month")).toHaveValue("10");
    await stop("reminder-amount");
    await page.keyboard.type("1200");
    await page.keyboard.press("Enter"); // goes nowhere: there is no form to submit
    await stop("reminder-upi");
    await expect(part(page, "amount")).toHaveValue("1,200");
    await page.keyboard.type("meena.tuitions@okhdfc");
    await stop("reminder-payee");
    await page.keyboard.type("Meena Rao");
    await stop("reminder-remember");
    await page.keyboard.press("Space");
    await expect(part(page, "remember")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Enter");
    await expect(part(page, "remember")).toHaveAttribute("aria-checked", "false");

    const v: Values = { ...canvas, month: 10 };
    const href = await expectMessage(page, "en", "firm", v, "Meena%20Rao");
    await stop("reminder-send");
    const [opened] = await Promise.all([context.waitForEvent("page"), page.keyboard.press("Enter")]);
    await opened.waitForLoadState();
    expect(opened.url()).toBe(href);
    await opened.close();
    await page.bringToFront();
    expect(asked).toEqual([href]);

    await stop("reminder-copy");
    await page.keyboard.press("Enter");
    await expect(part(page, "status")).toHaveAttribute("data-result", "copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(messageFor("en", "firm", v));
    await expect(page).toHaveURL(tool("en"));
  });

  test("criterion 42: with the form empty, Tab passes over Send and Copy, which cannot be used", async ({ page }) => {
    await openTool(page, "en");
    await part(page, "remember").focus();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest('[data-testid="reminder-promo"]') !== null)).toBe(true);
    // Enter or a tap on the unavailable Send opens nothing.
    let opened = 0;
    page.context().on("page", () => opened++);
    await part(page, "send").click({ force: true });
    await part(page, "copy").click({ force: true });
    await expect(part(page, "status")).toHaveText("");
    await expect(page).toHaveURL(tool("en"));
    expect(opened).toBe(0);
  });
});
