// A small fake of the Supabase client for the data modules' tests. Test code only.
// Every call is recorded; the call that ends a chain answers from `queue` (the last answer repeats).
export type Outcome = { count?: number | null; data: unknown; error: { code?: string; message?: string; details?: string } | null; status?: number };

export type Call = { op: string; args: unknown[] };

export function makeFake() {
  const calls: Call[] = [];
  const queue: Outcome[] = [];
  const state = { throwOnQuery: false };

  const next = (): Outcome => (queue.length > 1 ? (queue.shift() as Outcome) : (queue[0] ?? { data: null, error: null }));

  function chain(): Record<string, unknown> {
    const proxy: Record<string, unknown> = {};
    for (const op of ["select", "insert", "update", "delete", "eq", "neq", "gte", "lt", "is", "not", "in", "order", "limit", "range"]) {
      proxy[op] = (...args: unknown[]) => {
        calls.push({ op, args });
        if (state.throwOnQuery) throw new Error("network");
        return proxy;
      };
    }
    // The calls that end a chain. `returns` marks a list read: awaiting the chain gives the answer.
    for (const op of ["single", "maybeSingle", "returns"]) {
      proxy[op] = (...args: unknown[]) => {
        calls.push({ op, args });
        if (state.throwOnQuery) throw new Error("network");
        return Promise.resolve(next());
      };
    }
    // A chain ended by `.select()` after a delete is awaited as it is.
    proxy.then = (resolve: (value: Outcome) => unknown, reject: (reason: unknown) => unknown) => {
      try {
        return Promise.resolve(next()).then(resolve, reject);
      } catch (error) {
        return Promise.reject(error).then(resolve, reject);
      }
    };
    return proxy;
  }

  const client = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: "user-1" } } } }) },
    from: (table: string) => {
      calls.push({ op: "from", args: [table] });
      return chain();
    },
    // A function call. Awaiting the chain gives the next answer; a client with no network throws.
    rpc: (name: string, ...rest: unknown[]) => {
      calls.push({ op: "rpc", args: [name, ...rest] });
      if (state.throwOnQuery) throw new Error("network");
      return chain();
    },
  };

  return {
    client,
    calls,
    state,
    answer(...outcomes: Outcome[]) {
      queue.length = 0;
      queue.push(...outcomes);
    },
    reset() {
      calls.length = 0;
      queue.length = 0;
      state.throwOnQuery = false;
    },
    ops: () => calls.map((c) => c.op),
    /** The first argument of the first call of this kind. */
    arg: (op: string) => calls.find((c) => c.op === op)?.args[0],
  };
}
