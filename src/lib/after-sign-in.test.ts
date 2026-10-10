// @vitest-environment node
// Spec R1-1, criterion 17: after sign-in the tutor goes home, or to the open setup step.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tutor } from "./tutor";

const getTutor = vi.fn<() => Promise<Tutor | null>>();
vi.mock("./tutor", () => ({ getTutor: () => getTutor() }));

import { placeAfterSignIn } from "./after-sign-in";

const tutor = (over: Partial<Tutor> = {}): Tutor => ({
  id: "u",
  email: "m@example.com",
  name: "Meena Iyer",
  language: "en",
  upiId: "meena@okhdfc",
  subjects: ["maths"],
  ...over,
});

beforeEach(() => {
  getTutor.mockReset();
});

describe("placeAfterSignIn", () => {
  it("is home for a finished profile", async () => {
    getTutor.mockResolvedValue(tutor());
    await expect(placeAfterSignIn()).resolves.toBe("home");
  });

  it("is step 1 when the name is missing", async () => {
    getTutor.mockResolvedValue(tutor({ name: null }));
    await expect(placeAfterSignIn()).resolves.toBe("setup-profile");
  });

  it("is step 1 when no subject is picked", async () => {
    getTutor.mockResolvedValue(tutor({ subjects: [] }));
    await expect(placeAfterSignIn()).resolves.toBe("setup-profile");
  });

  it("is step 2 when only the UPI ID is missing", async () => {
    getTutor.mockResolvedValue(tutor({ upiId: null }));
    await expect(placeAfterSignIn()).resolves.toBe("setup-upi");
  });

  it("is home when there is no row or the read fails: the gate there says what is wrong", async () => {
    getTutor.mockResolvedValue(null);
    await expect(placeAfterSignIn()).resolves.toBe("home");
    getTutor.mockImplementation(() => Promise.reject(new Error("network")));
    await expect(placeAfterSignIn()).resolves.toBe("home");
  });
});
