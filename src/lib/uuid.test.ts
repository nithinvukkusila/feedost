import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe("newId", () => {
  it("is a version-4 UUID, and different each time", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(V4);
  });

  it("still works where randomUUID does not exist (a page over plain http)", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: <T extends ArrayBufferView>(array: T) => real.getRandomValues(array) });
    expect(typeof crypto.randomUUID).toBe("undefined");
    for (let i = 0; i < 20; i++) expect(newId()).toMatch(V4);
  });
});
