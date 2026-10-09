import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const url = vi.hoisted(() => ({ value: "https://abcdefghijklmnopqrst.supabase.co" }));
vi.mock("@/lib/supabase-env", () => ({
  get supabaseUrl() {
    return url.value;
  },
}));

import { copy } from "./copy";
import { EnvCheck, readHealth } from "./env-check";

const answer = (status: number, body: string) => Promise.resolve(new Response(body, { status }));
const result = () => screen.getByTestId("env-check-result");

beforeEach(() => {
  url.value = "https://abcdefghijklmnopqrst.supabase.co";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("readHealth", () => {
  it("accepts exactly status 200 and exactly {ok:true, env}", () => {
    for (const env of ["local", "staging", "production"]) {
      expect(readHealth(200, JSON.stringify({ ok: true, env }))).toEqual({ kind: "ok", env });
    }
  });

  it("names a 500, a 405 and any other status", () => {
    expect(readHealth(500, '{"ok":false}')).toMatchObject({ kind: "unexpected", reason: "not-set" });
    expect(readHealth(405, '{"ok":false}')).toMatchObject({ kind: "unexpected", reason: "method" });
    expect(readHealth(404, "")).toMatchObject({ kind: "unexpected", reason: "status", status: 404 });
  });

  it("refuses a 200 with the wrong body", () => {
    for (const body of [
      "not json",
      "null",
      "[]",
      '{"ok":true}',
      '{"ok":false,"env":"staging"}',
      '{"ok":true,"env":"qa"}',
      '{"ok":true,"env":"staging","extra":1}',
      '{"ok":"true","env":"staging"}',
    ]) {
      expect(readHealth(200, body), body).toMatchObject({ kind: "unexpected", reason: "shape" });
    }
  });
});

describe("EnvCheck", () => {
  it("calls health with no custom headers", async () => {
    const fetchMock = vi.fn(() => answer(200, '{"ok":true,"env":"staging"}'));
    vi.stubGlobal("fetch", fetchMock);
    render(<EnvCheck />);
    await waitFor(() => expect(result().getAttribute("data-state")).toBe("ok"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe("https://abcdefghijklmnopqrst.supabase.co/functions/v1/health");
    expect(init.headers).toBeUndefined();
    expect(init.method).toBeUndefined();
  });

  it("shows checking first, then the environment name", async () => {
    vi.stubGlobal("fetch", () => answer(200, '{"ok":true,"env":"production"}'));
    render(<EnvCheck />);
    expect(result().getAttribute("data-state")).toBe("checking");
    expect(result().textContent).toContain(copy.checking);
    await waitFor(() => expect(result().getAttribute("data-state")).toBe("ok"));
    expect(result().textContent).toContain("production");
    expect(result().querySelector("[data-env]")?.getAttribute("data-env")).toBe("production");
  });

  it("shows each environment's own word", async () => {
    for (const env of ["local", "staging"]) {
      vi.stubGlobal("fetch", () => answer(200, JSON.stringify({ ok: true, env })));
      render(<EnvCheck />);
      await waitFor(() => expect(result().getAttribute("data-state")).toBe("ok"));
      expect(screen.getByTestId("env-check-word").textContent).toBe(env);
      cleanup();
    }
  });

  it("says unexpected answer for a 500, with the reason", async () => {
    vi.stubGlobal("fetch", () => answer(500, '{"ok":false}'));
    render(<EnvCheck />);
    await waitFor(() => expect(result().getAttribute("data-state")).toBe("unexpected"));
    expect(result().textContent).toContain(copy.unexpectedTitle);
    expect(result().textContent).toContain(copy.unexpectedNotSet);
  });

  it("says unexpected answer for a 200 with the wrong body", async () => {
    vi.stubGlobal("fetch", () => answer(200, '{"hello":1}'));
    render(<EnvCheck />);
    await waitFor(() => expect(result().getAttribute("data-state")).toBe("unexpected"));
    expect(result().textContent).toContain(copy.unexpectedShape);
  });

  it("says cannot reach, mentioning a paused project, on a network error", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    render(<EnvCheck />);
    await waitFor(() => expect(result().getAttribute("data-state")).toBe("unreachable"));
    expect(result().textContent).toContain(copy.unreachableTitle);
    expect(result().textContent).toContain("paused");
  });

  it("gives up after 5 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    render(<EnvCheck />);
    expect(result().getAttribute("data-state")).toBe("checking");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result().getAttribute("data-state")).toBe("unreachable");
  });

  it("says not configured, and does not call the network, when there is no URL", () => {
    url.value = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<EnvCheck />);
    expect(result().getAttribute("data-state")).toBe("not-configured");
    expect(result().textContent).toContain(copy.notConfigured);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks again when asked", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new TypeError("Failed to fetch")))
      .mockImplementationOnce(() => answer(200, '{"ok":true,"env":"staging"}'));
    vi.stubGlobal("fetch", fetchMock);
    render(<EnvCheck />);
    await waitFor(() => expect(result().getAttribute("data-state")).toBe("unreachable"));
    await userEvent.click(screen.getByRole("button", { name: copy.retry }));
    await waitFor(() => expect(result().getAttribute("data-state")).toBe("ok"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
