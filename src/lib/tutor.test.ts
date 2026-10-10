// Spec R1-1, criteria 25, 26 and 36: reading and saving the tutor's row, against a small fake client.
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { op: string; args: unknown[] }[] = [];
let outcome: { data: unknown; error: { code?: string; message?: string } | null; status?: number } = { data: null, error: null };
let session: { user: { id: string } } | null = { user: { id: "user-1" } };
let throwOnQuery = false;

// A chain that records each call and ends by answering with `outcome`.
function chain(): Record<string, unknown> {
  const link = (op: string) => (...args: unknown[]) => {
    calls.push({ op, args });
    if (throwOnQuery) throw new Error("network");
    return proxy;
  };
  const proxy: Record<string, unknown> = {};
  for (const op of ["select", "update", "eq"]) proxy[op] = link(op);
  for (const op of ["single", "maybeSingle"]) {
    proxy[op] = (...args: unknown[]) => {
      calls.push({ op, args });
      if (throwOnQuery) throw new Error("network");
      return Promise.resolve(outcome);
    };
  }
  return proxy;
}

const client = {
  auth: { getSession: () => Promise.resolve({ data: { session } }) },
  from: (table: string) => {
    calls.push({ op: "from", args: [table] });
    return chain();
  },
};

vi.mock("./supabase", () => ({ getClient: () => Promise.resolve(client) }));

const row = { id: "user-1", email: "meena@example.com", name: "Meena Iyer", language: "hi", upi_id: "meena@okhdfc", subjects: ["maths", "Sanskrit"] };

beforeEach(() => {
  calls.length = 0;
  outcome = { data: row, error: null };
  session = { user: { id: "user-1" } };
  throwOnQuery = false;
});

const ops = () => calls.map((c) => c.op);

describe("getTutor", () => {
  it("reads the tutor's own row and turns it into the app's shape", async () => {
    const { getTutor } = await import("./tutor");
    await expect(getTutor()).resolves.toEqual({
      id: "user-1",
      email: "meena@example.com",
      name: "Meena Iyer",
      language: "hi",
      upiId: "meena@okhdfc",
      subjects: ["maths", "Sanskrit"],
    });
    expect(calls[0]).toEqual({ op: "from", args: ["tutors"] });
    expect(calls[1]).toEqual({ op: "select", args: ["id,email,name,language,upi_id,subjects"] });
  });

  it("gives empty values for a new tutor", async () => {
    outcome = { data: { id: "u", email: null, name: null, language: "en", upi_id: null, subjects: null }, error: null };
    const { getTutor } = await import("./tutor");
    await expect(getTutor()).resolves.toEqual({ id: "u", email: null, name: null, language: "en", upiId: null, subjects: [] });
  });

  it("treats a language the app does not know as English", async () => {
    outcome = { data: { ...row, language: "ta" }, error: null };
    const { getTutor } = await import("./tutor");
    expect((await getTutor())?.language).toBe("en");
  });

  it("is null when there is no row", async () => {
    outcome = { data: null, error: null };
    const { getTutor } = await import("./tutor");
    await expect(getTutor()).resolves.toBeNull();
  });

  it("throws TutorLoadError when the read fails or the network throws", async () => {
    const { getTutor, TutorLoadError } = await import("./tutor");
    outcome = { data: null, error: { message: "Failed to fetch" } };
    await expect(getTutor()).rejects.toBeInstanceOf(TutorLoadError);
    throwOnQuery = true;
    await expect(getTutor()).rejects.toBeInstanceOf(TutorLoadError);
  });
});

describe("getTutor tells a refused session from a failure (review fix)", () => {
  it.each([
    ["401", { status: 401, error: { message: "JWT expired", code: "PGRST301" } }],
    ["403", { status: 403, error: { message: "forbidden", code: "42501" } }],
    ["PGRST302 with no status", { error: { code: "PGRST302", message: "anonymous access is disabled" } }],
    ["PGRST303", { status: 401, error: { code: "PGRST303", message: "JWT claims" } }],
  ])("%s is rejected", async (_name, extra) => {
    outcome = { data: null, ...extra } as typeof outcome;
    const { getTutor } = await import("./tutor");
    await expect(getTutor()).rejects.toMatchObject({ name: "TutorLoadError", kind: "rejected" });
  });

  it.each([
    ["503", { status: 503, error: { message: "unavailable" } }],
    ["500", { status: 500, error: { code: "XX000", message: "boom" } }],
    ["a dropped connection", { status: 0, error: { message: "Failed to fetch" } }],
    ["PGRST116", { status: 406, error: { code: "PGRST116", message: "no rows" } }],
  ])("%s is a plain failure", async (_name, extra) => {
    outcome = { data: null, ...extra } as typeof outcome;
    const { getTutor } = await import("./tutor");
    await expect(getTutor()).rejects.toMatchObject({ kind: "failed" });
  });

  it("a thrown network error is a plain failure", async () => {
    throwOnQuery = true;
    const { getTutor } = await import("./tutor");
    await expect(getTutor()).rejects.toMatchObject({ kind: "failed" });
  });
});

describe("classifyLoadFailure", () => {
  it("does not mistake near misses for a refusal", async () => {
    const { classifyLoadFailure } = await import("./tutor");
    expect(classifyLoadFailure({ code: "PGRST3010" })).toBe("failed");
    expect(classifyLoadFailure({ code: "PGRST200" })).toBe("failed");
    expect(classifyLoadFailure({ status: 404 })).toBe("failed");
    expect(classifyLoadFailure({})).toBe("failed");
  });
});

describe("saveProfile (criterion 25)", () => {
  it("sends only name, subjects and language to the tutor's own row, then reads it back", async () => {
    const { saveProfile } = await import("./tutor");
    const result = await saveProfile({ name: "Meena Iyer", subjects: ["maths"], language: "kn" });
    expect(result.ok).toBe(true);
    expect(calls.find((c) => c.op === "update")?.args).toEqual([{ name: "Meena Iyer", subjects: ["maths"], language: "kn" }]);
    expect(calls.find((c) => c.op === "eq")?.args).toEqual(["id", "user-1"]);
    // A zero-row update must be an error: the call ends in select and single.
    expect(ops().slice(-2)).toEqual(["select", "single"]);
  });

  it("fails, not pretends, when the server refuses", async () => {
    outcome = { data: null, error: { code: "500", message: "boom" } };
    const { saveProfile } = await import("./tutor");
    await expect(saveProfile({ name: "A", subjects: ["maths"], language: "en" })).resolves.toEqual({ ok: false, reason: "failed" });
  });

  it("fails when the network throws", async () => {
    throwOnQuery = true;
    const { saveProfile } = await import("./tutor");
    await expect(saveProfile({ name: "A", subjects: ["maths"], language: "en" })).resolves.toEqual({ ok: false, reason: "failed" });
  });

  it("fails without sending anything when there is no session", async () => {
    session = null;
    const { saveProfile } = await import("./tutor");
    await expect(saveProfile({ name: "A", subjects: ["maths"], language: "en" })).resolves.toEqual({ ok: false, reason: "failed" });
    expect(ops()).not.toContain("update");
  });

  it("says missing when the update changed no row (criterion 26)", async () => {
    outcome = { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } };
    const { saveProfile } = await import("./tutor");
    await expect(saveProfile({ name: "A", subjects: ["maths"], language: "en" })).resolves.toEqual({ ok: false, reason: "missing" });
  });
});

describe("saveUpi (criterion 30)", () => {
  it("sends only upi_id", async () => {
    const { saveUpi } = await import("./tutor");
    const result = await saveUpi("meena@okhdfc");
    expect(result.ok).toBe(true);
    expect(calls.find((c) => c.op === "update")?.args).toEqual([{ upi_id: "meena@okhdfc" }]);
  });

  it("reports missing and failed like saveProfile", async () => {
    const { saveUpi } = await import("./tutor");
    outcome = { data: null, error: { code: "PGRST116" } };
    await expect(saveUpi("a@bank")).resolves.toEqual({ ok: false, reason: "missing" });
    outcome = { data: null, error: { code: "42501" } };
    await expect(saveUpi("a@bank")).resolves.toEqual({ ok: false, reason: "failed" });
  });
});

describe("syncLanguage (criterion 36)", () => {
  it("sends nothing when the language is already the page's", async () => {
    const { syncLanguage } = await import("./tutor");
    await syncLanguage({ language: "hi" }, "hi");
    expect(calls).toEqual([]);
  });

  it("updates only language when it differs", async () => {
    const { syncLanguage } = await import("./tutor");
    await syncLanguage({ language: "en" }, "te");
    expect(calls.find((c) => c.op === "update")?.args).toEqual([{ language: "te" }]);
  });

  it("ignores a failure", async () => {
    throwOnQuery = true;
    const { syncLanguage } = await import("./tutor");
    await expect(syncLanguage({ language: "en" }, "te")).resolves.toBeUndefined();
    throwOnQuery = false;
    outcome = { data: null, error: { code: "500" } };
    await expect(syncLanguage({ language: "en" }, "te")).resolves.toBeUndefined();
  });
});
