// @vitest-environment node
// R0-4 criteria 6, 7, 23: the shared rules, run over the shared vectors.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BANDS,
  LANGUAGES,
  checkCity,
  checkLanguage,
  checkName,
  checkStudents,
  cleanText,
  formatPhone,
  normalizePhone,
  parseBody,
} from "./waitlist-rules.ts";

type Vectors = {
  name: { in: unknown; out: string | null }[];
  nameLong: { repeat: string; times: number; ok: boolean }[];
  city: { in: unknown; out: string | null }[];
  cityLong: { repeat: string; times: number; ok: boolean }[];
  phone: { in: unknown; out: string | null }[];
  format: { in: string; out: string }[];
  language: { in: unknown; ok: boolean }[];
  students: { in: unknown; ok: boolean }[];
  bodies: { label: string; in: unknown; out: unknown }[];
};

const vectors = JSON.parse(readFileSync(join(__dirname, "waitlist-vectors.json"), "utf8")) as Vectors;

const valueOrNull = (r: { ok: boolean; value?: unknown }) => (r.ok ? r.value : null);

describe("name", () => {
  it.each(vectors.name.map((v) => [JSON.stringify(v.in), v] as const))("%s", (_label, v) => {
    expect(valueOrNull(checkName(v.in))).toBe(v.out);
  });
  it.each(vectors.nameLong.map((v) => [`${v.times} x ${v.repeat}`, v] as const))("length %s", (_label, v) => {
    expect(checkName(v.repeat.repeat(v.times)).ok).toBe(v.ok);
  });
});

describe("city", () => {
  it.each(vectors.city.map((v) => [JSON.stringify(v.in), v] as const))("%s", (_label, v) => {
    expect(valueOrNull(checkCity(v.in))).toBe(v.out);
  });
  it.each(vectors.cityLong.map((v) => [`${v.times} x ${v.repeat}`, v] as const))("length %s", (_label, v) => {
    expect(checkCity(v.repeat.repeat(v.times)).ok).toBe(v.ok);
  });
});

describe("phone", () => {
  it.each(vectors.phone.map((v) => [JSON.stringify(v.in), v] as const))("%s", (_label, v) => {
    expect(normalizePhone(v.in)).toBe(v.out);
  });
  it("every accepted result matches the database check", () => {
    for (const v of vectors.phone) if (v.out !== null) expect(v.out).toMatch(/^\+91[6-9][0-9]{9}$/);
  });
  it("is idempotent", () => {
    for (const v of vectors.phone) if (v.out !== null) expect(normalizePhone(v.out)).toBe(v.out);
  });
});

describe("formatPhone", () => {
  it.each(vectors.format.map((v) => [v.in, v] as const))("%j", (_label, v) => {
    expect(formatPhone(v.in)).toBe(v.out);
  });
});

describe("language and students", () => {
  it.each(vectors.language.map((v) => [JSON.stringify(v.in), v] as const))("language %s", (_label, v) => {
    expect(checkLanguage(v.in).ok).toBe(v.ok);
  });
  it.each(vectors.students.map((v) => [JSON.stringify(v.in), v] as const))("students %s", (_label, v) => {
    expect(checkStudents(v.in).ok).toBe(v.ok);
  });
  it("the constants are the four bands and four languages", () => {
    expect([...BANDS]).toEqual([0, 10, 30, 60]);
    expect([...LANGUAGES]).toEqual(["en", "hi", "kn", "te"]);
  });
});

describe("parseBody", () => {
  it.each(vectors.bodies.map((v) => [v.label, v] as const))("%s", (_label, v) => {
    expect(valueOrNull(parseBody(v.in))).toEqual(v.out);
  });
});

describe("cleanText", () => {
  it("returns null for a non-string", () => {
    expect(cleanText(undefined)).toBeNull();
  });
});
