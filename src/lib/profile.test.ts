// @vitest-environment node
// Spec R1-1, criteria 17, 22, 23 and 24: the route decision as a table, and the name and subject rules.
import { describe, expect, it } from "vitest";
import type { Place } from "@/config/routes";
import {
  isPresetKey,
  isProfileComplete,
  nextRoute,
  normalizeName,
  normalizeSubjects,
  openStep,
  presetKeys,
  storedSubject,
  subjectLabel,
  type Decision,
  type ProfileFields,
  type RouteInput,
  type SubjectNames,
} from "./profile";

const english: SubjectNames = {
  maths: "Maths",
  science: "Science",
  english: "English",
  hindi: "Hindi",
  physics: "Physics",
  chemistry: "Chemistry",
  accounts: "Accounts",
};
const hindi: SubjectNames = { ...english, maths: "गणित", science: "विज्ञान" };

const complete: ProfileFields = { name: "Meena Iyer", subjects: ["maths"], upiId: "meena@okhdfc" };
const noName: ProfileFields = { name: null, subjects: ["maths"], upiId: "meena@okhdfc" };
const blankName: ProfileFields = { name: "   ", subjects: ["maths"], upiId: "meena@okhdfc" };
const noSubjects: ProfileFields = { name: "Meena", subjects: [], upiId: "meena@okhdfc" };
const noUpi: ProfileFields = { name: "Meena", subjects: ["maths"], upiId: null };
const empty: ProfileFields = { name: null, subjects: [], upiId: null };

const go = (to: Place): Decision => ({ action: "go", to });
const stay: Decision = { action: "stay" };
const wait: Decision = { action: "wait" };

const studentPlaces: Place[] = ["students", "student-new", "student-edit", "batches", "batch-edit", "attendance"];
const places: Place[] = ["sign-in", "callback", "home", "more", ...studentPlaces, "setup-profile", "setup-upi"];
const appPlaces: Place[] = ["home", "more", ...studentPlaces, "setup-profile", "setup-upi"];

describe("nextRoute: the table (criterion 17)", () => {
  const cases: [string, RouteInput["session"], ProfileFields | undefined, Place, Decision][] = [
    // Not known yet: wait, wherever the tutor is.
    ...places.map((p): [string, RouteInput["session"], ProfileFields | undefined, Place, Decision] => ["loading session", "loading", undefined, p, wait]),
    ...places.map((p): [string, RouteInput["session"], ProfileFields | undefined, Place, Decision] => ["network error on the session", "error", undefined, p, wait]),
    // Signed out: app screens go to sign-in, the two sign-in screens stay.
    ...appPlaces.map((p): [string, RouteInput["session"], ProfileFields | undefined, Place, Decision] => ["signed out", "signed-out", undefined, p, go("sign-in")]),
    ["signed out", "signed-out", undefined, "sign-in", stay],
    ["signed out", "signed-out", undefined, "callback", stay],
    // Signed in, tutor not fetched yet.
    ...places.map((p): [string, RouteInput["session"], ProfileFields | undefined, Place, Decision] => ["signed in, tutor unknown", "signed-in", undefined, p, wait]),
    // Name missing, blank, or no subjects: step 1 is open.
    ...[noName, blankName, noSubjects, empty].flatMap((profile) => [
      ["step 1 open", "signed-in", profile, "sign-in", go("setup-profile")],
      ["step 1 open", "signed-in", profile, "callback", go("setup-profile")],
      ["step 1 open", "signed-in", profile, "home", go("setup-profile")],
      ["step 1 open", "signed-in", profile, "more", go("setup-profile")],
      ...studentPlaces.map((p) => ["step 1 open", "signed-in", profile, p, go("setup-profile")] as [string, RouteInput["session"], ProfileFields | undefined, Place, Decision]),
      ["step 1 open", "signed-in", profile, "setup-profile", stay],
      ["step 1 open", "signed-in", profile, "setup-upi", go("setup-profile")],
    ] as [string, RouteInput["session"], ProfileFields | undefined, Place, Decision][]),
    // Only the UPI ID missing: step 2 is open, and step 1 stays reachable (that is how Edit works).
    ["step 2 open", "signed-in", noUpi, "sign-in", go("setup-upi")],
    ["step 2 open", "signed-in", noUpi, "callback", go("setup-upi")],
    ["step 2 open", "signed-in", noUpi, "home", go("setup-upi")],
    ["step 2 open", "signed-in", noUpi, "more", go("setup-upi")],
    ...studentPlaces.map((p): [string, RouteInput["session"], ProfileFields | undefined, Place, Decision] => ["step 2 open", "signed-in", noUpi, p, go("setup-upi")]),
    ["step 2 open", "signed-in", noUpi, "setup-profile", stay],
    ["step 2 open", "signed-in", noUpi, "setup-upi", stay],
    // Complete: sign-in and callback go home; everything else stays.
    ["complete", "signed-in", complete, "sign-in", go("home")],
    ["complete", "signed-in", complete, "callback", go("home")],
    ["complete", "signed-in", complete, "home", stay],
    ["complete", "signed-in", complete, "more", stay],
    ...studentPlaces.map((p): [string, RouteInput["session"], ProfileFields | undefined, Place, Decision] => ["complete", "signed-in", complete, p, stay]),
    ["complete", "signed-in", complete, "setup-profile", stay],
    ["complete", "signed-in", complete, "setup-upi", stay],
  ];

  it.each(cases)("%s, tutor %#, on %s", (_label, session, profile, place, expected) => {
    expect(nextRoute({ session, profile, place })).toEqual(expected);
  });

  it("covers every session, every place and every profile shape at least once", () => {
    expect(cases.length).toBeGreaterThanOrEqual(60);
    for (const session of ["loading", "error", "signed-out", "signed-in"] as const) {
      expect(cases.some((c) => c[1] === session)).toBe(true);
    }
    for (const place of places) expect(cases.some((c) => c[3] === place)).toBe(true);
  });

  it("never sends a tutor to the screen they are on", () => {
    for (const [, session, profile, place] of cases) {
      const decision = nextRoute({ session, profile, place });
      if (decision.action === "go") expect(decision.to).not.toBe(place);
    }
  });
});

describe("openStep and isProfileComplete", () => {
  it("names the first open step", () => {
    expect(openStep(empty)).toBe("profile");
    expect(openStep(noName)).toBe("profile");
    expect(openStep(blankName)).toBe("profile");
    expect(openStep(noSubjects)).toBe("profile");
    expect(openStep(noUpi)).toBe("upi");
    expect(openStep({ ...noUpi, upiId: "  " })).toBe("upi");
    expect(openStep(complete)).toBeNull();
  });

  it("is complete only with name, a subject and a UPI ID", () => {
    expect(isProfileComplete(complete)).toBe(true);
    for (const p of [empty, noName, noSubjects, noUpi]) expect(isProfileComplete(p)).toBe(false);
  });
});

describe("normalizeName (criterion 22)", () => {
  it("trims and collapses runs of spaces", () => {
    expect(normalizeName("  Meena    Iyer ")).toEqual({ ok: true, value: "Meena Iyer" });
    expect(normalizeName("Meena\t\nIyer")).toEqual({ ok: true, value: "Meena Iyer" });
  });

  it("accepts any script", () => {
    expect(normalizeName("मीना अय्यर")).toEqual({ ok: true, value: "मीना अय्यर" });
    expect(normalizeName("ಮೀನಾ ಅಯ್ಯರ್")).toEqual({ ok: true, value: "ಮೀನಾ ಅಯ್ಯರ್" });
    expect(normalizeName("మీనా అయ్యర్")).toEqual({ ok: true, value: "మీనా అయ్యర్" });
  });

  it("says missing for nothing or only spaces", () => {
    expect(normalizeName("")).toEqual({ ok: false, error: "missing" });
    expect(normalizeName("  \n ")).toEqual({ ok: false, error: "missing" });
  });

  it("allows 80 characters and refuses 81", () => {
    expect(normalizeName("a".repeat(80)).ok).toBe(true);
    expect(normalizeName("a".repeat(81))).toEqual({ ok: false, error: "tooLong" });
  });

  it("counts characters, not UTF-16 units, as the database does", () => {
    expect(normalizeName("😀".repeat(80)).ok).toBe(true);
    expect(normalizeName("😀".repeat(81)).ok).toBe(false);
  });
});

describe("preset keys (criterion 24)", () => {
  it("are the seven from the canvas, in its order", () => {
    expect([...presetKeys]).toEqual(["maths", "science", "english", "hindi", "physics", "chemistry", "accounts"]);
    expect(isPresetKey("maths")).toBe(true);
    expect(isPresetKey("Maths")).toBe(false);
    expect(isPresetKey("Sanskrit")).toBe(false);
  });

  it("a tapped preset is stored as its key", () => {
    expect(storedSubject("Maths", english)).toBe("maths");
  });

  it("a typed subject equal to a preset's name in the page language, ignoring case, is stored as the key", () => {
    expect(storedSubject("  MATHS ", english)).toBe("maths");
    expect(storedSubject("गणित", hindi)).toBe("maths");
  });

  it("any other typed subject is stored as typed, tidied", () => {
    expect(storedSubject("  Sanskrit   Grammar ", english)).toBe("Sanskrit Grammar");
    expect(storedSubject("ಕನ್ನಡ ವ್ಯಾಕರಣ", english)).toBe("ಕನ್ನಡ ವ್ಯಾಕರಣ");
  });

  it("a preset's name in another language is just typed text", () => {
    expect(storedSubject("गणित", english)).toBe("गणित");
  });

  it("is shown in the page's language, and typed text as typed", () => {
    expect(subjectLabel("maths", hindi)).toBe("गणित");
    expect(subjectLabel("maths", english)).toBe("Maths");
    expect(subjectLabel("Sanskrit", hindi)).toBe("Sanskrit");
  });
});

describe("normalizeSubjects (criterion 23)", () => {
  it("needs at least one", () => {
    expect(normalizeSubjects([], english)).toEqual({ ok: false, error: "missing" });
    expect(normalizeSubjects(["  ", ""], english)).toEqual({ ok: false, error: "missing" });
  });

  it("keeps the order and stores presets as keys", () => {
    expect(normalizeSubjects(["Science", "Sanskrit", "Maths"], english)).toEqual({ ok: true, value: ["science", "Sanskrit", "maths"] });
  });

  it("drops repeats, ignoring case", () => {
    expect(normalizeSubjects(["maths", "Maths", "Sanskrit", "sanskrit"], english)).toEqual({ ok: true, value: ["maths", "Sanskrit"] });
  });

  it("allows 8 and refuses 9", () => {
    const eight = Array.from({ length: 8 }, (_, i) => `Subject ${i}`);
    expect(normalizeSubjects(eight, english).ok).toBe(true);
    expect(normalizeSubjects([...eight, "Subject 9"], english)).toEqual({ ok: false, error: "limit" });
  });

  it("allows 30 characters and refuses 31", () => {
    expect(normalizeSubjects(["a".repeat(30)], english).ok).toBe(true);
    expect(normalizeSubjects(["a".repeat(31)], english)).toEqual({ ok: false, error: "limit" });
  });

  it("refuses what the database would: more than 400 bytes joined, which long Kannada names reach before 8 x 30 characters", () => {
    const kannada = "ಕ".repeat(30); // 30 characters, 90 bytes
    const five = Array.from({ length: 5 }, (_, i) => kannada.slice(0, 29) + String.fromCharCode(0x0c85 + i));
    expect(normalizeSubjects(five, english)).toEqual({ ok: false, error: "limit" });
    expect(normalizeSubjects(five.slice(0, 4), english).ok).toBe(true);
  });
});
