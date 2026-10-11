import { afterEach, describe, expect, it, vi } from "vitest";
import { joinWaitlist, TIMEOUT_MS } from "./join";

const values = { name: "Asha", phone: "+919876543210", city: "Mysuru", students_count: 10 } as const;
const URL = "https://x.supabase.co/functions/v1/waitlist-join";

function reply(status: number, body: unknown) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("joinWaitlist", () => {
  it("posts the five fields and an empty honeypot, as JSON, to the function, with no credentials", async () => {
    const fetchMock = vi.fn(async () => reply(200, { code: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await joinWaitlist(values, "hi", undefined, URL)).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(init.body as string)).toEqual({ ...values, language: "hi", website: "" });
  });

  it.each([
    [200, { code: "invalid" }, "invalid"],
    [400, { code: "invalid" }, "invalid"],
    [429, { code: "rate_limited" }, "rate_limited"],
    [429, "not json", "rate_limited"],
    [500, { code: "error" }, "error"],
    [200, { code: "something else" }, "error"],
    [200, "<html>", "error"],
    [200, { nope: true }, "error"],
    [500, { code: "ok" }, "error"],
  ])("maps status %s and body %j to %s", async (status, body, expected) => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(status, body)));
    expect(await joinWaitlist(values, "en", undefined, URL)).toBe(expected);
  });

  it("answers error when the network is down, and never throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await joinWaitlist(values, "en", undefined, URL)).toBe("error");
  });

  it("gives up after 15 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))),
    );
    const pending = joinWaitlist(values, "en", undefined, URL);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe("error");
  });

  it("stops when the caller cancels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))),
    );
    const caller = new AbortController();
    const pending = joinWaitlist(values, "en", caller.signal, URL);
    caller.abort();
    expect(await pending).toBe("error");
  });
});
