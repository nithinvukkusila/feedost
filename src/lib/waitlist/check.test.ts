import { describe, expect, it } from "vitest";
import { checkForm } from "./check";

const good = { name: "Asha Rao", phone: "98765 43210", city: "Mysuru", students: "30" };

describe("checkForm", () => {
  it("passes good values and returns them cleaned, ready to send", () => {
    const result = checkForm({ ...good, name: "  Asha   Rao " });
    expect(result).toEqual({
      name: null,
      phone: null,
      city: null,
      students: null,
      row: { name: "Asha Rao", phone: "+919876543210", city: "Mysuru", students_count: 30 },
    });
  });

  it("says missing for nothing, or only spaces, and check for what the rules refuse", () => {
    const r = checkForm({ name: "   ", phone: "", city: "<x>", students: "" });
    expect([r.name, r.phone, r.city, r.students, r.row]).toEqual(["missing", "missing", "check", "missing", null]);
  });

  it.each(["12345", "5876543210", "98765 4321a", "+1 9876543210", "98765432101"])("refuses the number %s", (phone) => {
    expect(checkForm({ ...good, phone }).phone).toBe("check");
  });

  it("accepts digits of the three scripts and a number WhatsApp pasted with hidden marks", () => {
    expect(checkForm({ ...good, phone: "९८७६५४३२१०" }).row?.phone).toBe("+919876543210");
    expect(checkForm({ ...good, phone: "‎+91 98765 43210" }).row?.phone).toBe("+919876543210");
  });

  it("refuses a name over 60 characters and a city over 40", () => {
    expect(checkForm({ ...good, name: "a".repeat(61) }).name).toBe("check");
    expect(checkForm({ ...good, name: "a".repeat(60) }).name).toBeNull();
    expect(checkForm({ ...good, city: "a".repeat(41) }).city).toBe("check");
  });

  it("accepts only the four bands", () => {
    for (const students of ["0", "10", "30", "60"]) expect(checkForm({ ...good, students }).students).toBeNull();
    for (const students of ["", "5", "abc"]) expect(checkForm({ ...good, students }).students).toBe("missing");
  });
});
