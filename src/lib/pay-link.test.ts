// Spec R1-9 Part C, criterion 45: the pay-page link for the reminder.
import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { payPageLink } from "./pay-link";

const TOKEN = "abcdefghijklmnopqrstuv";

describe("payPageLink", () => {
  it("is https, the one site host, /p/ and the token", () => {
    expect(payPageLink(TOKEN)).toBe(`https://${brand.domain}/p/${TOKEN}`);
    expect(payPageLink(TOKEN)).toBe("https://feedost.vercel.app/p/abcdefghijklmnopqrstuv");
    expect(payPageLink("A-_" + "x".repeat(125))).not.toBeNull();
  });
  it("refuses a short, long or odd token, and a non-string", () => {
    for (const bad of ["", "short", "x".repeat(21), "x".repeat(129), `${TOKEN}/`, `${TOKEN}?a=1`, `${TOKEN}#x`, `${TOKEN} x`, `${TOKEN}\n`, null, undefined, 42, {}]) {
      expect(payPageLink(bad), String(bad)).toBeNull();
    }
  });
});
