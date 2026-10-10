// Spec R1-3, criteria 6 to 8, 14, 47 and 53: the roster sorted, searched, filtered and totalled.
import { describe, expect, it } from "vitest";
import type { Batch } from "./batches";
import {
  activeStudents,
  archivedStudents,
  batchCounts,
  batchSummary,
  filterByBatch,
  monthlyTotal,
  searchStudents,
  sortBatches,
  sortStudents,
} from "./student-list";
import type { Student } from "./students";

let n = 0;
const make = (name: string, over: Partial<Student> = {}): Student => ({
  id: `id-${String(++n).padStart(3, "0")}`,
  batchId: null,
  name,
  parentName: null,
  parentPhone: null,
  parentLanguage: "en",
  monthlyFee: 100000,
  openingBalance: 0,
  dueDay: 1,
  active: true,
  ...over,
});

const batches: Batch[] = [
  { id: "b1", name: "Class 10 Maths", timings: null },
  { id: "b2", name: "Class 8 Science", timings: "Mon 5 pm" },
];

describe("sortStudents (6)", () => {
  it("orders by name, ignoring letter case, by character code", () => {
    const list = [make("ravi"), make("Zoya"), make("Asha"), make("Bina"), make("anil")];
    expect(sortStudents(list).map((s) => s.name)).toEqual(["anil", "Asha", "Bina", "ravi", "Zoya"]);
  });

  it("puts names in other scripts after Latin ones, by code, and does not change the list it was given", () => {
    const list = [make("ಕಿರಣ್"), make("Zed"), make("अनन्या")];
    const before = list.map((s) => s.name);
    expect(sortStudents(list).map((s) => s.name)).toEqual(["Zed", "अनन्या", "ಕಿರಣ್"]);
    expect(list.map((s) => s.name)).toEqual(before);
  });

  it("keeps equal names in a steady order, by id", () => {
    const a = make("Ravi");
    const b = make("ravi");
    expect(sortStudents([b, a]).map((s) => s.id)).toEqual([a.id, b.id]);
  });

  it("orders batches the same way", () => {
    expect(sortBatches(batches.slice().reverse()).map((b) => b.name)).toEqual(["Class 10 Maths", "Class 8 Science"]);
  });

  it("splits active from archived", () => {
    const list = [make("A"), make("B", { active: false })];
    expect(activeStudents(list).map((s) => s.name)).toEqual(["A"]);
    expect(archivedStudents(list).map((s) => s.name)).toEqual(["B"]);
  });
});

describe("searchStudents (7)", () => {
  const ravi = make("Ravi Kumar", { parentName: "Suresh Kumar", parentPhone: "+919886044321" });
  const asha = make("Asha Rao", { parentName: "Lata", parentPhone: "+919845012345" });
  const hindi = make("अनन्या शेट्टी", { parentName: "सुरेश" });
  const kannada = make("ಕಿರಣ್ ಪಾಟೀಲ್");
  const list = [ravi, asha, hindi, kannada];

  const names = (text: string) => searchStudents(list, text).map((s) => s.name);

  it("finds by any part of a name, in any letter case", () => {
    expect(names("rav")).toEqual(["Ravi Kumar"]);
    expect(names("KUM")).toEqual(["Ravi Kumar"]);
    expect(names("a r")).toEqual(["Asha Rao"]);
  });

  it("finds by the parent's name", () => {
    expect(names("suresh")).toEqual(["Ravi Kumar"]);
    expect(names("lata")).toEqual(["Asha Rao"]);
  });

  it("finds in Hindi and Kannada by substring", () => {
    expect(names("शेट्टी")).toEqual(["अनन्या शेट्टी"]);
    expect(names("सुरेश")).toEqual(["अनन्या शेट्टी"]);
    expect(names("ಪಾಟೀಲ್")).toEqual(["ಕಿರಣ್ ಪಾಟೀಲ್"]);
  });

  it("finds by the digits of the phone: 98860 finds +91 98860 44321", () => {
    expect(names("98860")).toEqual(["Ravi Kumar"]);
    expect(names("44321")).toEqual(["Ravi Kumar"]);
    expect(names("98860 44321")).toEqual(["Ravi Kumar"]);
    expect(names("+91 98860")).toEqual(["Ravi Kumar"]);
    expect(names("९८८६०")).toEqual(["Ravi Kumar"]);
  });

  it("does not match every number on the country code", () => {
    expect(names("91")).toEqual([]);
    expect(names("+91")).toEqual([]);
  });

  it("does not look at phones when the text has letters", () => {
    expect(names("ravi 98860")).toEqual([]);
  });

  it("means no filter for empty or white space only", () => {
    expect(names("")).toHaveLength(4);
    expect(names("   \t ")).toHaveLength(4);
  });

  it("finds nothing for a text that matches no one", () => {
    expect(names("zzz")).toEqual([]);
  });

  it("collapses the spaces typed, as names are saved", () => {
    expect(names("  ravi   kumar ")).toEqual(["Ravi Kumar"]);
  });
});

describe("filterByBatch and batchCounts (8)", () => {
  const list = [
    make("A", { batchId: "b1" }),
    make("B", { batchId: "b1" }),
    make("C", { batchId: "b2" }),
    make("D"),
    make("E", { batchId: "gone" }),
  ];

  it("filters by all, none or one batch", () => {
    expect(filterByBatch(list, "all")).toHaveLength(5);
    expect(filterByBatch(list, "none").map((s) => s.name)).toEqual(["D"]);
    expect(filterByBatch(list, "b1").map((s) => s.name)).toEqual(["A", "B"]);
    expect(filterByBatch(list, "nothing")).toEqual([]);
  });

  it("counts each batch, with the students of an unknown batch as having none", () => {
    expect(batchCounts(list, batches)).toEqual({ all: 5, none: 2, byBatch: { b1: 2, b2: 1 } });
    expect(batchCounts([], batches)).toEqual({ all: 0, none: 0, byBatch: { b1: 0, b2: 0 } });
  });

  it("combines with a search", () => {
    const found = filterByBatch(searchStudents(list, "a"), "b1");
    expect(found.map((s) => s.name)).toEqual(["A"]);
  });
});

describe("monthlyTotal and batchSummary (14, 47, 53)", () => {
  it("adds paise as integers", () => {
    const list = [make("A", { monthlyFee: 120000 }), make("B", { monthlyFee: 150000 }), make("C", { monthlyFee: 100 })];
    expect(monthlyTotal(list)).toBe(270100);
    expect(monthlyTotal([])).toBe(0);
  });

  it("stays exact with 300 students at the top fee", () => {
    const list = Array.from({ length: 300 }, (_, i) => make(`S${i}`, { monthlyFee: 100000000 }));
    expect(monthlyTotal(list)).toBe(30_000_000_000);
    expect(Number.isSafeInteger(monthlyTotal(list))).toBe(true);
  });

  it("counts a batch's active students only, and still holds the archived ones in it", () => {
    const list = [
      make("A", { batchId: "b1", monthlyFee: 120000 }),
      make("B", { batchId: "b1", monthlyFee: 150000, active: false }),
      make("C", { batchId: "b1", monthlyFee: 100000 }),
      make("D", { batchId: "b2", monthlyFee: 999 }),
    ];
    expect(batchSummary(list, "b1")).toEqual({ count: 2, total: 220000 });
    expect(batchSummary(list, "b2")).toEqual({ count: 1, total: 999 });
    expect(batchSummary(list, "none")).toEqual({ count: 0, total: 0 });
    expect(filterByBatch(list, "b1")).toHaveLength(3);
  });
});
