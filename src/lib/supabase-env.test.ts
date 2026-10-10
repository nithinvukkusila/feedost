// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("supabaseUrl", () => {
  it("is the build's value", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
    const { supabaseUrl } = await import("./supabase-env");
    expect(supabaseUrl).toBe("https://abcdefghijklmnopqrst.supabase.co");
  });

  it("is an empty string when the variable is not set, never the word undefined", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    const { supabaseUrl } = await import("./supabase-env");
    expect(supabaseUrl).toBe("");
  });
});

describe("supabaseAnonKey", () => {
  it("is the build's value", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "ci-anon-key");
    const { supabaseAnonKey } = await import("./supabase-env");
    expect(supabaseAnonKey).toBe("ci-anon-key");
  });

  it("is an empty string when the variable is not set, never the word undefined", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    const { supabaseAnonKey } = await import("./supabase-env");
    expect(supabaseAnonKey).toBe("");
  });
});

describe("storedSessionKey (spec R1-1, section 8.3)", () => {
  it("is sb-<first label of the host>-auth-token, the library's own default", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://cicicicicicicicicici.supabase.co");
    const { storedSessionKey } = await import("./supabase-env");
    expect(storedSessionKey()).toBe("sb-cicicicicicicicicici-auth-token");
  });

  it("takes an address as an argument", async () => {
    const { storedSessionKey } = await import("./supabase-env");
    expect(storedSessionKey("https://abcdefghijklmnopqrst.supabase.co/")).toBe("sb-abcdefghijklmnopqrst-auth-token");
  });

  it("is null when the address is empty or not an address", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    const { storedSessionKey } = await import("./supabase-env");
    expect(storedSessionKey()).toBeNull();
    expect(storedSessionKey("not a web address")).toBeNull();
  });
});
