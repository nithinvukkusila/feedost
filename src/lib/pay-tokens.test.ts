// Spec R1-9 Part C, criteria 46 and 47: the Remind screen's one read of pay tokens.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFake } from "./db-fake.test-util";
import { PAY_TOKENS_WAIT_MS, readPayTokens } from "./pay-tokens";

const fake = makeFake();
vi.mock("./supabase", () => ({ getClient: () => Promise.resolve(fake.client) }));

const onLine = (value: boolean) => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });
const T1 = "abcdefghijklmnopqrstuv";

beforeEach(() => {
  fake.reset();
  onLine(true);
});
afterEach(() => vi.restoreAllMocks());

describe("readPayTokens", () => {
  it("makes one call for exactly id and pay_token, with no filter", async () => {
    fake.answer({ data: [{ id: "s1", pay_token: T1 }], error: null });
    const map = await readPayTokens();
    expect(map.get("s1")).toBe(T1);
    expect(fake.calls).toEqual([
      { op: "from", args: ["students"] },
      { op: "select", args: ["id,pay_token"] },
    ]);
  });

  it("skips malformed rows and never throws", async () => {
    fake.answer({ data: [null, 5, { id: "s1" }, { id: 3, pay_token: T1 }, { id: "s2", pay_token: "" }, { id: "s3", pay_token: T1 }], error: null });
    expect([...(await readPayTokens())]).toEqual([["s3", T1]]);
  });

  it("gives an empty map on an error answer, a thrown network error and an offline phone", async () => {
    fake.answer({ data: null, error: { code: "500", message: "boom" } });
    expect((await readPayTokens()).size).toBe(0);
    fake.reset();
    fake.state.throwOnQuery = true;
    expect((await readPayTokens()).size).toBe(0);
    fake.reset();
    onLine(false);
    expect((await readPayTokens()).size).toBe(0);
    expect(fake.calls).toEqual([]);
  });

  it("gives an empty map when the read is too slow", async () => {
    vi.useFakeTimers();
    try {
      const never = new Promise(() => {});
      vi.spyOn(fake.client, "from").mockImplementation(() => ({ select: () => never }) as never);
      const pending = readPayTokens();
      await vi.advanceTimersByTimeAsync(PAY_TOKENS_WAIT_MS);
      expect((await pending).size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not log the token", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    fake.answer({ data: [{ id: "s1", pay_token: T1 }], error: null });
    await readPayTokens();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
