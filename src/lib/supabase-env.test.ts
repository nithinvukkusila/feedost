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
