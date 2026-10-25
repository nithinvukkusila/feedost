// Spec R1-3, criteria 18 to 24, 28 and 33: the whole form checked at once, the same-number note, and the edit patch.
import { describe, expect, it } from "vitest";
import { changedFields, checkStudent, firstError, permissionWarning, samePhone, type StudentDraft } from "./student-form";
import type { Student } from "./students";

const draft = (over: Partial<StudentDraft> = {}): StudentDraft => ({
  name: "Ravi Kumar",
  parentName: "Suresh Kumar",
  phone: "98450 12345",
  parentLanguage: "kn",
  batchId: "",
  dueDay: 5,
  fee: "1200",
  owes: "",
  permission: true,
  ...over,
});

const errorsOf = (over: Partial<StudentDraft>, context = {}) => {
  const check = checkStudent(draft(over), context);
  if (check.ok) throw new Error("expected errors");
  return check.errors;
};

const student = (over: Partial<Student> = {}): Student => ({
  id: "s1",
  batchId: null,
  name: "Ravi Kumar",
  parentName: "Suresh Kumar",
  parentPhone: "+919845012345",
  parentLanguage: "kn",
  monthlyFee: 120000,
  openingBalance: 0,
  dueDay: 5,
  active: true,
  ...over,
});

describe("checkStudent: the clean result", () => {
  it("gives the fields as they are saved: paise, +91, null for empty", () => {
    expect(checkStudent(draft())).toEqual({
      ok: true,
      fields: {
        batchId: null,
        name: "Ravi Kumar",
        parentName: "Suresh Kumar",
        parentPhone: "+919845012345",
        parentLanguage: "kn",
        monthlyFee: 120000,
        openingBalance: 0,
        dueDay: 5,
      },
    });
  });

  it("sends empty parent name and phone as null, never as empty text", () => {
    const check = checkStudent(draft({ parentName: "   ", phone: "", permission: false }));
    expect(check.ok && check.fields.parentName).toBeNull();
    expect(check.ok && check.fields.parentPhone).toBeNull();
  });

  it("tidies the names: trimmed, runs of spaces made one", () => {
    const check = checkStudent(draft({ name: "  Ravi \t  Kumar ", parentName: " Suresh   Kumar" }));
    expect(check.ok && check.fields.name).toBe("Ravi Kumar");
    expect(check.ok && check.fields.parentName).toBe("Suresh Kumar");
  });

  it("keeps a batch id, and reads the opening balance in paise", () => {
    const check = checkStudent(draft({ batchId: "b1", owes: "₹2,500" }));
    expect(check.ok && check.fields.batchId).toBe("b1");
    expect(check.ok && check.fields.openingBalance).toBe(250000);
  });

  it("takes a fee of ₹10,00,000 and an opening balance of 0", () => {
    const check = checkStudent(draft({ fee: "10,00,000", owes: "0" }));
    expect(check.ok && check.fields.monthlyFee).toBe(100000000);
  });
});

describe("checkStudent: the name (18) and the parent's name (19)", () => {
  it("is required", () => {
    expect(errorsOf({ name: "   " }).name).toEqual({ tag: "missing", message: "nameMissing" });
  });

  it("counts characters: 80 pass, 81 do not", () => {
    expect(checkStudent(draft({ name: "a".repeat(80) })).ok).toBe(true);
    expect(errorsOf({ name: "a".repeat(81) }).name).toEqual({ tag: "tooLong", message: "nameLong" });
  });

  it("counts an emoji and a combined letter by characters, not by UTF-16 units", () => {
    // 80 emoji are 160 UTF-16 units but 80 characters.
    expect(checkStudent(draft({ name: "😀".repeat(80) })).ok).toBe(true);
    expect(errorsOf({ name: "😀".repeat(81) }).name?.tag).toBe("tooLong");
    expect(checkStudent(draft({ name: "ಕ".repeat(80) })).ok).toBe(true);
  });

  it("allows a parent's name to be empty, and holds it to 80", () => {
    expect(checkStudent(draft({ parentName: "" })).ok).toBe(true);
    expect(checkStudent(draft({ parentName: "b".repeat(80) })).ok).toBe(true);
    expect(errorsOf({ parentName: "b".repeat(81) }).parentName).toEqual({ tag: "tooLong", message: "parentLong" });
  });
});

describe("checkStudent: the phone (20, 21)", () => {
  it("is optional", () => {
    expect(checkStudent(draft({ phone: "", permission: false })).ok).toBe(true);
  });

  it.each([
    ["98860", { tag: "tooShort", message: "phoneShort", count: 5 }],
    ["98860443210", { tag: "tooLong", message: "phoneLong", count: 11 }],
    ["1886044321", { tag: "checkNumber", message: "phoneStart", count: 10 }],
    ["98860abc", { tag: "checkNumber", message: "phoneChars", count: 0 }],
  ])("refuses %j", (phone, expected) => {
    expect(errorsOf({ phone }).phone).toEqual(expected);
  });
});

describe("checkStudent: the fee and the opening balance (23)", () => {
  it.each([
    ["", { tag: "missing", message: "feeMissing" }],
    ["0", { tag: "checkAmount", message: "feeZero" }],
    ["12.50", { tag: "wholeRupees", message: "feeDecimal" }],
    ["10,00,001", { tag: "tooBig", message: "feeBig" }],
    ["abc", { tag: "checkAmount", message: "feeChars" }],
  ])("fee %j", (fee, expected) => {
    expect(errorsOf({ fee }).fee).toEqual(expected);
  });

  it.each([
    ["12.50", { tag: "wholeRupees", message: "owesDecimal" }],
    ["10,00,001", { tag: "tooBig", message: "owesBig" }],
    ["abc", { tag: "checkAmount", message: "owesChars" }],
  ])("opening balance %j", (owes, expected) => {
    expect(errorsOf({ owes }).owes).toEqual(expected);
  });

  it("treats a blank opening balance as 0 and not as an error", () => {
    expect(errorsOf({ fee: "" }).owes).toBeUndefined();
    const check = checkStudent(draft({ owes: "  " }));
    expect(check.ok && check.fields.openingBalance).toBe(0);
  });
});

describe("permissionWarning (UX-review-fixes-2, 7.3)", () => {
  const saved = "+919845012345";
  it("warns only when the field still holds the saved number and the tick is off", () => {
    expect(permissionWarning({ phone: "98450 12345", permission: false }, saved)).toBe(true);
    expect(permissionWarning({ phone: "+91 9845012345", permission: false }, saved)).toBe(true);
    expect(permissionWarning({ phone: "98450 12345", permission: true }, saved)).toBe(false);
  });

  it("does not warn for a changed, an empty or an unfinished number, or when nothing was saved", () => {
    expect(permissionWarning({ phone: "98860 44321", permission: false }, saved)).toBe(false);
    expect(permissionWarning({ phone: "", permission: false }, saved)).toBe(false);
    expect(permissionWarning({ phone: "98450", permission: false }, saved)).toBe(false);
    expect(permissionWarning({ phone: "98450 12345", permission: false }, null)).toBe(false);
  });
});

describe("checkStudent: the permission tick (24)", () => {
  it("is required when a phone is typed", () => {
    expect(errorsOf({ permission: false }).permission).toEqual({ tag: "missing", message: "permissionNeeded" });
  });

  it("is not required without a phone", () => {
    expect(checkStudent(draft({ phone: "", permission: false })).ok).toBe(true);
  });

  it("is not asked again for the number a student already has, but is for a changed or a new one", () => {
    expect(checkStudent(draft({ permission: false }), { savedPhone: "+919845012345" }).ok).toBe(true);
    expect(errorsOf({ permission: false, phone: "98860 44321" }, { savedPhone: "+919845012345" }).permission).toBeDefined();
    expect(errorsOf({ permission: false }, { savedPhone: null }).permission).toBeDefined();
  });

  it("UX-review-fixes-2 7.3: the saved number with the tick off is not an error; it is saved as no number", () => {
    const check = checkStudent(draft({ permission: false }), { savedPhone: "+919845012345" });
    expect(check.ok && check.fields.parentPhone).toBeNull();
    // Re-ticked, the number is kept.
    const kept = checkStudent(draft({ permission: true }), { savedPhone: "+919845012345" });
    expect(kept.ok && kept.fields.parentPhone).toBe("+919845012345");
  });

  it("UX-review-fixes-2 7.4: the only change sent is the number set to empty, the same patch as clearing the field", () => {
    const saved = student();
    const unticked = checkStudent(draft({ permission: false }), { savedPhone: saved.parentPhone });
    const cleared = checkStudent(draft({ phone: "", permission: false }), { savedPhone: saved.parentPhone });
    if (!unticked.ok || !cleared.ok) throw new Error("expected ok");
    expect(changedFields(saved, unticked.fields)).toEqual({ parentPhone: null });
    expect(changedFields(saved, unticked.fields)).toEqual(changedFields(saved, cleared.fields));
  });

  it("UX-review-fixes-2 7.2: a changed number without the tick is still an error, not a removal", () => {
    expect(errorsOf({ permission: false, phone: "98860 44321" }, { savedPhone: "+919845012345" }).permission).toEqual({
      tag: "missing",
      message: "permissionNeeded",
    });
  });

  it("add mode is unchanged: a typed number without the tick is an error", () => {
    expect(errorsOf({ permission: false }).permission).toBeDefined();
    const check = checkStudent(draft({ permission: true }));
    expect(check.ok && check.fields.parentPhone).toBe("+919845012345");
  });

  it("is not asked about a number that cannot be saved anyway: the number's own error comes first", () => {
    const errors = errorsOf({ phone: "98860", permission: false });
    expect(errors.phone).toBeDefined();
    expect(errors.permission).toBeUndefined();
  });
});

describe("checkStudent: all errors at once, first one focused (25)", () => {
  it("reports every wrong field together", () => {
    const errors = errorsOf({ name: "", phone: "1", fee: "", owes: "x", permission: false });
    expect(Object.keys(errors).sort()).toEqual(["fee", "name", "owes", "phone"]);
  });

  it("names the first one in screen order", () => {
    expect(firstError(errorsOf({ fee: "", name: "" }))).toBe("name");
    expect(firstError(errorsOf({ fee: "", phone: "1" }))).toBe("phone");
    expect(firstError(errorsOf({ permission: false }))).toBe("permission");
    expect(firstError(errorsOf({ fee: "", permission: false }))).toBe("permission");
    expect(firstError(errorsOf({ owes: "x", fee: "" }))).toBe("fee");
    expect(firstError({})).toBeNull();
  });
});

describe("samePhone (22)", () => {
  const list = [
    student({ id: "a", name: "Zoya", parentPhone: "+919845012345" }),
    student({ id: "b", name: "Asha", parentPhone: "+919845012345", active: false }),
    student({ id: "c", name: "Meena", parentPhone: "+919886044321" }),
  ];

  it("finds another student with the number, archived ones too, the first by name", () => {
    expect(samePhone(list, "+919845012345")?.id).toBe("b");
  });

  it("ignores the student being edited", () => {
    expect(samePhone(list, "+919845012345", "b")?.id).toBe("a");
    expect(samePhone(list, "+919886044321", "c")).toBeUndefined();
  });

  it("finds nothing for no number or a new one", () => {
    expect(samePhone(list, null)).toBeUndefined();
    expect(samePhone(list, "+919000000000")).toBeUndefined();
  });
});

describe("changedFields (33, 34)", () => {
  const saved = student();
  const same = {
    batchId: null,
    name: "Ravi Kumar",
    parentName: "Suresh Kumar",
    parentPhone: "+919845012345",
    parentLanguage: "kn" as const,
    monthlyFee: 120000,
    openingBalance: 0,
    dueDay: 5,
  };

  it("is empty when nothing changed", () => {
    expect(changedFields(saved, same)).toEqual({});
  });

  it("holds only what changed", () => {
    expect(changedFields(saved, { ...same, monthlyFee: 150000, dueDay: 10 })).toEqual({ monthlyFee: 150000, dueDay: 10 });
    expect(changedFields(saved, { ...same, batchId: "b1" })).toEqual({ batchId: "b1" });
    expect(changedFields(saved, { ...same, parentPhone: null, parentName: null })).toEqual({ parentPhone: null, parentName: null });
    expect(changedFields(saved, { ...same, name: "Ravi K", parentLanguage: "hi", openingBalance: 100 })).toEqual({
      name: "Ravi K",
      parentLanguage: "hi",
      openingBalance: 100,
    });
  });
});

describe("opening balance with nothing to count (review)", () => {
  it.each(["₹", ",", "₹ ,", " , "])("%j means 0 and does not block Save", (owes) => {
    const check = checkStudent(draft({ fee: "1200", owes }));
    expect(check.ok && check.fields.openingBalance).toBe(0);
  });
});
