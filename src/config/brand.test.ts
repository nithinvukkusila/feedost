import { describe, expect, it } from "vitest";
import { brand } from "./brand";

describe("brand", () => {
  it("has a name and a bare domain", () => {
    expect(brand.name.length).toBeGreaterThan(0);
    expect(brand.domain).not.toMatch(/^https?:/);
  });
});
