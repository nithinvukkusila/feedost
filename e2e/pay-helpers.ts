// A fake of the payments table and the two functions that change it, for the browser specs of slice R1-7.
// Test code only. Registers after `signedIn` (board-fixture.ts) and mutates the same due rows `stubDues`
// holds, the way the real functions change `dues.amount_paid` and `dues.status` in one transaction.
//
// It is as strict as the real database where the app could be fooled by a fake that is too kind: a read of
// `payments` that asks for `*`, `tutor_id`, `request_id` or `receipt_token` is refused (400); the two
// functions answer the contract's machine words (supabase/migrations/20261012130000_r1_payments.sql); a
// retry with the same request id returns the same payment; and every other write to `payments` or `dues` is
// refused (42501) and logged so a spec can prove none was sent.
import type { Page, Route } from "@playwright/test";
import { HOST, USER_ID } from "./auth-helpers";
import { NOW } from "./board-fixture";
import type { Dues } from "./dues-helpers";

export type PaymentRow = {
  id: string;
  tutor_id: string;
  due_id: string;
  amount: number;
  method: "upi" | "cash";
  paid_on: string;
  receipt_no: number;
  receipt_token: string;
  request_id: string;
  balance_after: number;
  created_at: string;
  voided_at: string | null;
};

export type PayRequest = { method: string; path: string; query: string; body: string | null };

export type Payments = {
  payments: PaymentRow[];
  requests: PayRequest[];
  /** Answer the next record_payment with a server error, recording nothing. */
  failNext: boolean;
  /** Record the next payment, then drop the connection instead of answering (the lost response). */
  loseNextResponse: boolean;
  /** Hold every function answer back this many milliseconds. */
  delayMs: number;
  /** Another phone paid: the fee has this much more paid, with a receipt, without this phone knowing. */
  payElsewhere(dueId: string, amount: number): PaymentRow;
  /** A payment made earlier, as a row (for the 24-hour window). */
  seed(partial: Partial<PaymentRow> & { due_id: string }): PaymentRow;
  /** The calls of record_payment and void_payment, with their bodies parsed. */
  calls(name: "record_payment" | "void_payment"): Record<string, unknown>[];
  reads(): PayRequest[];
  /** Writes to payments or dues other than the two functions: always empty if the app behaves. */
  writes(): PayRequest[];
};

const TODAY = "2026-10-12";
const DAY = 86_400_000;
let counter = 0;
const uuid = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(700000 + counter).padStart(12, "0")}`;
};
const COLUMNS = ["id", "due_id", "amount", "method", "paid_on", "receipt_no", "balance_after", "created_at", "voided_at"];
const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY);

export async function stubPayments(page: Page, dues: Dues, initial: (Partial<PaymentRow> & { due_id: string })[] = []): Promise<Payments> {
  const state: Payments = {
    payments: [],
    requests: [],
    failNext: false,
    loseNextResponse: false,
    delayMs: 0,
    payElsewhere(dueId, amount) {
      const due = dues.dues.find((row) => row.id === dueId);
      if (!due) throw new Error(`no due ${dueId}`);
      return record(due.id, amount, "cash", TODAY, uuid());
    },
    seed(partial) {
      const due = dues.dues.find((row) => row.id === partial.due_id);
      if (!due) throw new Error(`no due ${partial.due_id}`);
      const amount = partial.amount ?? due.amount;
      return record(due.id, amount, partial.method ?? "upi", partial.paid_on ?? TODAY, partial.request_id ?? uuid(), partial.created_at);
    },
    calls: (name) => state.requests.filter((r) => r.path.endsWith(`/rpc/${name}`)).map((r) => JSON.parse(r.body ?? "{}") as Record<string, unknown>),
    reads: () => state.requests.filter((r) => r.method === "GET" && r.path === "/rest/v1/payments"),
    writes: () => state.requests.filter((r) => (r.path === "/rest/v1/payments" || r.path === "/rest/v1/dues") && r.method !== "GET"),
  };

  function record(dueId: string, amount: number, method: "upi" | "cash", paidOn: string, requestId: string, createdAt?: string): PaymentRow {
    const due = dues.dues.find((row) => row.id === dueId)!;
    // A fee the fixture already has as paid is left as it is: a seeded payment only gives it a receipt.
    const already = due.status === "paid";
    const balance = already ? 0 : due.amount - due.amount_paid - amount;
    if (!already) {
      due.amount_paid += amount;
      due.status = due.amount_paid >= due.amount ? "paid" : "partial";
    }
    const row: PaymentRow = {
      id: uuid(),
      tutor_id: USER_ID,
      due_id: dueId,
      amount,
      method,
      paid_on: paidOn,
      receipt_no: Math.max(0, ...state.payments.map((p) => p.receipt_no)) + 1,
      receipt_token: `${"t".repeat(20)}${String(counter).padStart(4, "0")}`,
      request_id: requestId,
      balance_after: balance,
      created_at: createdAt ?? NOW.toISOString(),
      voided_at: null,
    };
    state.payments.push(row);
    return row;
  }
  for (const row of initial) state.seed(row);

  const cors = (route: Route) => ({
    "access-control-allow-origin": route.request().headers()["origin"] ?? "*",
    "access-control-expose-headers": "*",
    vary: "origin",
  });
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, body: JSON.stringify(body), headers: { ...cors(route), "content-type": "application/json" } });
  const refuse = (route: Route, word: string, details: string | null = null) => json(route, 400, { code: "P0001", message: word, details, hint: null });

  await page.route(
    (url) =>
      url.origin === HOST &&
      (url.pathname === "/rest/v1/payments" || url.pathname === "/rest/v1/rpc/record_payment" || url.pathname === "/rest/v1/rpc/void_payment"),
    async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await route.fallback();
        return;
      }
      const url = new URL(request.url());
      const method = request.method();
      state.requests.push({ method, path: url.pathname, query: url.search, body: request.postData() });

      if (url.pathname === "/rest/v1/payments") {
        if (method !== "GET") {
          await json(route, 403, { code: "42501", message: "permission denied for table payments" });
          return;
        }
        const select = url.searchParams.get("select") ?? "*";
        if (select === "*" || select.split(",").some((column) => !COLUMNS.includes(column))) {
          await json(route, 400, { code: "42703", message: `a column the app may not ask for: ${select}` });
          return;
        }
        let rows = state.payments.slice();
        const due = url.searchParams.get("due_id");
        if (due?.startsWith("eq.")) rows = rows.filter((row) => row.due_id === due.slice(3));
        rows.sort((a, b) => b.receipt_no - a.receipt_no);
        await json(route, 200, rows.map((row) => Object.fromEntries(select.split(",").map((column) => [column, (row as Record<string, unknown>)[column]]))));
        return;
      }

      if (state.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, state.delayMs));
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;

      if (url.pathname.endsWith("/record_payment")) {
        if (state.failNext) {
          state.failNext = false;
          await json(route, 500, { code: "XX000", message: "made-up server error" });
          return;
        }
        const { p_due: dueId, p_amount: amount, p_method: how, p_paid_on: paidOn, p_request_id: requestId } = body as Record<string, string | number>;
        const known = state.payments.find((row) => row.request_id === requestId);
        if (known) {
          if (known.due_id !== dueId || known.amount !== amount) return void (await refuse(route, "request_reused"));
          await json(route, 200, known);
          return;
        }
        const due = dues.dues.find((row) => row.id === dueId);
        if (!due) return void (await refuse(route, "due_not_found"));
        if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || (how !== "upi" && how !== "cash")) return void (await refuse(route, "invalid_argument"));
        if (due.status === "paid") return void (await refuse(route, "already_paid"));
        const left = due.amount - due.amount_paid;
        if (amount > left) return void (await refuse(route, "amount_over_remaining", String(left)));
        const age = dayNumber(TODAY) - dayNumber(String(paidOn));
        if (age < 0 || age > 90) return void (await refuse(route, "date_out_of_range"));
        const row = record(due.id, amount, how, String(paidOn), String(requestId));
        if (state.loseNextResponse) {
          state.loseNextResponse = false;
          await route.abort("failed");
          return;
        }
        await json(route, 200, row);
        return;
      }

      // void_payment
      const row = state.payments.find((p) => p.id === body.p_payment);
      if (!row) return void (await refuse(route, "payment_not_found"));
      if (row.voided_at !== null) return void (await refuse(route, "already_voided"));
      if (NOW.getTime() - Date.parse(row.created_at) > DAY) return void (await refuse(route, "undo_window_over"));
      row.voided_at = NOW.toISOString();
      const due = dues.dues.find((d) => d.id === row.due_id)!;
      due.amount_paid -= row.amount;
      due.status = due.amount_paid === 0 ? "due" : "partial";
      await json(route, 200, row);
    },
  );
  return state;
}
