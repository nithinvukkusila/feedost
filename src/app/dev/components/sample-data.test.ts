import { describe, expect, it } from "vitest";
import { figures, formatInputs } from "./sample-data";

describe("dev page figures come from the formatters and read as before (criterion 42)", () => {
  it("renders the same text F2's screenshots show", () => {
    expect(figures).toMatchObject({
      large: "₹1,23,456",
      largeRest: "₹78,900",
      sixWide: "₹9,87,650",
      sevenDigits: "₹99,99,999",
      row: "₹1,200",
      rowLarge: "₹1,23,456",
      allDigits: "₹0123456789",
      rupee: "₹",
      date: "08 Oct 2026",
      fee: "₹18,500",
    });
  });

  it("feeds the Formats section the inputs the spec names", () => {
    expect(formatInputs).toEqual({ paise: [0, 99, 100000, 12345600], date: "2026-10-08", phone: "+919876543210" });
  });
});
