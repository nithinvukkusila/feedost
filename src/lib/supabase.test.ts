// @vitest-environment node
// Spec R1-1, criterion 14 and section 8.4: the client is made lazily, once, with the options pinned.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn((url: string, key: string, options: unknown) => ({ url, key, options }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

beforeEach(() => {
  createClient.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://cicicicicicicicicici.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "ci-anon-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the client options (criterion 14)", () => {
  it("are PKCE, no address detection, a kept session and automatic refresh", async () => {
    const { clientOptions } = await import("./supabase");
    expect(clientOptions).toEqual({
      auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
    });
  });

  it("are what createClient receives, with the build's address and key", async () => {
    const { getClient, clientOptions } = await import("./supabase");
    await getClient();
    expect(createClient).toHaveBeenCalledWith("https://cicicicicicicicicici.supabase.co", "ci-anon-key", clientOptions);
  });
});

describe("getClient", () => {
  it("makes one client however many times it is asked", async () => {
    const { getClient } = await import("./supabase");
    const [a, b] = await Promise.all([getClient(), getClient()]);
    expect(a).toBe(b);
    expect(await getClient()).toBe(a);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("does not load the library until it is asked", async () => {
    await import("./supabase");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("says plainly what is missing when the build has no address or key", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const { getClient } = await import("./supabase");
    await expect(getClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("does not remember a failure, so a retry can work", async () => {
    createClient.mockImplementationOnce(() => {
      throw new Error("chunk did not load");
    });
    const { getClient } = await import("./supabase");
    await expect(getClient()).rejects.toThrow("chunk did not load");
    await expect(getClient()).resolves.toBeTruthy();
    expect(createClient).toHaveBeenCalledTimes(2);
  });
});
