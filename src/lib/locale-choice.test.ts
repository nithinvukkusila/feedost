import { afterEach, describe, expect, it, vi } from "vitest";
import { readSavedLocale, saveLocale, STORAGE_KEY } from "./locale-choice";
import { brand } from "@/config/brand";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("locale choice", () => {
  it("returns null when nothing is saved", () => {
    expect(readSavedLocale()).toBeNull();
  });

  it("round-trips each of the four codes", () => {
    for (const code of ["en", "hi", "kn", "te"] as const) {
      expect(saveLocale(code)).toBe(true);
      expect(readSavedLocale()).toBe(code);
    }
  });

  it("ignores a saved value that is not one of the four codes", () => {
    for (const bad of ["fr", "HI", "hi-IN", "", "null", "{}"]) {
      localStorage.setItem(STORAGE_KEY, bad);
      expect(readSavedLocale()).toBeNull();
    }
  });

  it("does not save a code that is not one of the four", () => {
    expect(saveLocale("fr" as never)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("works, and says nothing, when storage throws", () => {
    const blocked = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "QuotaExceededError");
      },
    };
    vi.stubGlobal("localStorage", blocked);
    expect(readSavedLocale()).toBeNull();
    expect(saveLocale("hi")).toBe(false);
  });

  it("works when storage is missing altogether", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(readSavedLocale()).toBeNull();
    expect(saveLocale("kn")).toBe(false);
  });

  it("is a cookie-free key without the product name", () => {
    expect(STORAGE_KEY.toLowerCase()).not.toContain(brand.name.toLowerCase());
  });
});
