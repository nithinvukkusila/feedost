// A fake of the dues table and the one function that makes dues, for the browser specs of slice R1-6. Test
// code only. Registers after `stubSupabase` (auth-helpers.ts, which answers the same two addresses with
// nothing by default) and after `stubRoster`; Playwright tries the route registered last first.
//
// It is as strict as the real database where the app could be fooled by a fake that is too kind: a read
// that asks for `*` or names `tutor_id` is refused (400), the server returns at most 1,000 rows however many
// are asked for, and every write to the table is refused (42501) and logged so a spec can prove none was sent.
import type { Page, Route } from "@playwright/test";
import { HOST, USER_ID } from "./auth-helpers";

export type DueRow = {
  id: string;
  tutor_id: string;
  student_id: string;
  kind: "monthly" | "opening";
  month: string | null;
  amount: number;
  amount_paid: number;
  status: "due" | "partial" | "paid";
  due_date: string;
};

export type DuesRequest = { method: string; path: string; query: string; body: string | null; headers: Record<string, string> };

export type Dues = {
  dues: DueRow[];
  /** Every request that reached the dues table or the function, in order. */
  requests: DuesRequest[];
  /** Answer every request by dropping the connection, as a dead network does. */
  networkDown: boolean;
  /** Answer every read with this status (use 500: the library retries 503 and 520 with delays). Null answers normally. */
  readStatus: number | null;
  /** Hold every read back this many milliseconds (the loading state). */
  listDelayMs: number;
  /** The server's cap on rows per answer. */
  maxRows: number;
  ensure: {
    /** What the function answers. Null: the number of rows in `add`. */
    returns: number | null;
    /** Rows the function makes when it is called (added to the table). */
    add: DueRow[];
    /** Answer with a server error. */
    fail: boolean;
    /** Hold the answer back this many milliseconds. */
    delayMs: number;
  };
  addDue(partial: Partial<DueRow> & { student_id: string }): DueRow;
  /** The reads of the table (GET), in order. */
  reads(): DuesRequest[];
  /** The calls of the function. */
  ensures(): DuesRequest[];
  /** Writes to the table: always empty if the app behaves. */
  writes(): DuesRequest[];
};

let counter = 0;
const uuid = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(900000 + counter).padStart(12, "0")}`;
};

const COLUMNS = ["id", "student_id", "kind", "month", "amount", "amount_paid", "status", "due_date"];

export async function stubDues(page: Page, initial: (Partial<DueRow> & { student_id: string })[] = []): Promise<Dues> {
  const state: Dues = {
    dues: [],
    requests: [],
    networkDown: false,
    readStatus: null,
    listDelayMs: 0,
    maxRows: 1000,
    ensure: { returns: null, add: [], fail: false, delayMs: 0 },
    addDue(partial) {
      const row: DueRow = {
        id: uuid(),
        tutor_id: USER_ID,
        kind: "monthly",
        month: "2026-10-01",
        amount: 100000,
        amount_paid: 0,
        status: "due",
        due_date: "2026-10-05",
        ...partial,
      };
      state.dues.push(row);
      return row;
    },
    reads: () => state.requests.filter((r) => r.method === "GET"),
    ensures: () => state.requests.filter((r) => r.path.endsWith("/rpc/ensure_my_dues")),
    writes: () => state.requests.filter((r) => r.path === "/rest/v1/dues" && r.method !== "GET"),
  };
  for (const due of initial) state.addDue(due);

  const cors = (route: Route) => ({
    "access-control-allow-origin": route.request().headers()["origin"] ?? "*",
    "access-control-expose-headers": "*",
    vary: "origin",
  });
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, body: JSON.stringify(body), headers: { ...cors(route), "content-type": "application/json" } });

  await page.route(
    (url) => url.origin === HOST && (url.pathname === "/rest/v1/dues" || url.pathname === "/rest/v1/rpc/ensure_my_dues"),
    async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await route.fallback();
        return;
      }
      const url = new URL(request.url());
      const method = request.method();
      state.requests.push({ method, path: url.pathname, query: url.search, body: request.postData(), headers: request.headers() });
      if (state.networkDown) {
        await route.abort("failed");
        return;
      }

      if (url.pathname.endsWith("/rpc/ensure_my_dues")) {
        if (state.ensure.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, state.ensure.delayMs));
        if (state.ensure.fail) {
          await json(route, 500, { code: "XX000", message: "made-up server error" });
          return;
        }
        const made = state.ensure.add;
        state.ensure.add = [];
        state.dues.push(...made);
        await json(route, 200, state.ensure.returns ?? made.length);
        return;
      }

      if (method !== "GET") {
        await json(route, 403, { code: "42501", message: "permission denied for table dues" });
        return;
      }

      if (state.listDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, state.listDelayMs));
      if (state.readStatus !== null) {
        await json(route, state.readStatus, { message: "made-up server error" });
        return;
      }
      const q = url.searchParams;
      const select = q.get("select") ?? "*";
      const columns = select.split(",");
      if (select === "*" || columns.some((column) => !COLUMNS.includes(column))) {
        await json(route, 400, { code: "42703", message: `a column the app may not ask for: ${select}` });
        return;
      }

      let rows = state.dues.slice();
      const month = q.get("month");
      if (month?.startsWith("eq.")) rows = rows.filter((row) => row.month === month.slice(3));
      else if (month === "not.is.null") rows = rows.filter((row) => row.month !== null);
      if (q.get("status") === "neq.paid") rows = rows.filter((row) => row.status !== "paid");
      const order = (q.get("order") ?? "").split(",").filter(Boolean).map((part) => part.split(".")[0]);
      rows.sort((a, b) => {
        for (const column of order) {
          const x = String((a as Record<string, unknown>)[column] ?? "");
          const y = String((b as Record<string, unknown>)[column] ?? "");
          if (x !== y) return x < y ? -1 : 1;
        }
        return 0;
      });
      const offset = Number(q.get("offset") ?? 0);
      const asked = q.get("limit") === null ? Infinity : Number(q.get("limit"));
      rows = rows.slice(offset, offset + Math.min(asked, state.maxRows));
      await json(
        route,
        200,
        rows.map((row) => Object.fromEntries(columns.map((column) => [column, (row as Record<string, unknown>)[column]]))),
      );
    },
  );
  return state;
}
