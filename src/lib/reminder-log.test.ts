// Spec R1-8, criteria 17, 24 and 28: the in-memory log and its retry.
import { beforeEach, describe, expect, it, vi } from "vitest";

// A plain function, not a vi.fn: the mock tracker reports a rejected answer it was not asked about as a failure.
type Impl = (args: { dueId: string; template: string; requestId: string }) => Promise<number>;
const stub = vi.hoisted(() => ({ calls: [] as { dueId: string; template: string; requestId: string }[], impl: null as unknown as Impl }));
vi.mock("./reminders", async (original) => ({
  ...(await original<typeof import("./reminders")>()),
  recordReminder: (args: { dueId: string; template: string; requestId: string }) => {
    stub.calls.push({ dueId: args.dueId, template: args.template, requestId: args.requestId });
    return stub.impl(args);
  },
}));
const ok = () => Promise.resolve(1);
const refuse = (code: ConstructorParameters<typeof ReminderError>[0]) => () => Promise.reject(new ReminderError(code));

import { LogQueue, MAX_ATTEMPTS } from "./reminder-log";
import { ReminderError } from "./reminders";

const args = { dueId: "d1", template: "polite:en:month", requestId: "r1" };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  stub.calls.length = 0;
  stub.impl = ok;
});

describe("LogQueue.log", () => {
  it("starts the request before it returns, and sends one request for a double tap", async () => {
    stub.impl = ok;
    const queue = new LogQueue();
    queue.log(args);
    expect(stub.calls).toHaveLength(1);
    queue.log(args);
    await settle();
    queue.log(args);
    expect(stub.calls).toHaveLength(1);
    expect(queue.isPending("r1")).toBe(false);
  });

  it("keeps a failed entry, tells listeners, and sends the same request id again on flush", async () => {
    let first = true;
    stub.impl = () => {
      const answer = first ? refuse("offline")() : ok();
      first = false;
      return answer;
    };
    const queue = new LogQueue();
    const heard = vi.fn();
    queue.subscribe(heard);
    queue.log(args);
    await settle();
    expect(queue.isPending("r1")).toBe(true);
    expect(heard).toHaveBeenCalled();
    await queue.flush();
    expect(queue.isPending("r1")).toBe(false);
    expect(stub.calls.map((c) => c.requestId)).toEqual(["r1", "r1"]);
    expect(stub.calls.every((c) => c.dueId === "d1" && c.template === "polite:en:month")).toBe(true);
  });

  it("drops an entry on each refusal that means the fee changed, and does not try again", async () => {
    for (const code of ["already_paid", "student_archived", "no_phone", "due_not_found", "invalid_argument"] as const) {
      stub.calls.length = 0;
      stub.impl = refuse(code);
      const queue = new LogQueue();
      queue.log(args);
      await settle();
      expect(queue.isPending("r1")).toBe(false);
      await queue.flush();
      expect(stub.calls).toHaveLength(1);
    }
  });

  it("gives up after 5 attempts in all", async () => {
    stub.impl = refuse("failed");
    const queue = new LogQueue();
    queue.log(args);
    await settle();
    for (let i = 0; i < 10; i++) await queue.flush();
    expect(stub.calls).toHaveLength(MAX_ATTEMPTS);
    expect(queue.isPending("r1")).toBe(false);
  });

  it("retries one at a time, in order", async () => {
    stub.impl = refuse("offline");
    const queue = new LogQueue();
    queue.log({ ...args, requestId: "a" });
    queue.log({ ...args, requestId: "b" });
    await settle();
    stub.calls.length = 0;
    let running = 0;
    let most = 0;
    const order: string[] = [];
    stub.impl = async (a) => {
      running += 1;
      most = Math.max(most, running);
      order.push(a.requestId);
      await settle();
      running -= 1;
      return 1;
    };
    await Promise.all([queue.flush(), queue.flush()]);
    expect(order).toEqual(["a", "b"]);
    expect(most).toBe(1);
  });

  it("counts what the database confirmed and tells listeners", async () => {
    const queue = new LogQueue();
    const heard = vi.fn();
    queue.subscribe(heard);
    expect(queue.saved()).toBe(0);
    queue.log(args);
    await settle();
    expect(queue.saved()).toBe(1);
    expect(heard).toHaveBeenCalled();
  });

  it("does not log again after it succeeded, even if asked again", async () => {
    stub.impl = ok;
    const queue = new LogQueue();
    queue.log(args);
    await settle();
    queue.log(args);
    await queue.flush();
    expect(stub.calls).toHaveLength(1);
  });
});
