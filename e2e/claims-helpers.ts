// A fake of the payment_claims table and its two functions, for the browser specs of slice R1-10 Part B. Test code
// only. Registers after `signedIn` (board-fixture.ts) and `stubPayments` (pay-helpers.ts), and changes the same due
// and payment rows they hold, the way the real `confirm_claim` records one payment per fee in one transaction
// (supabase/migrations/20261015170625_r1_payment_claims.sql holds the contract).
//
// It is as strict as the real database where the app could be fooled by a fake that is too kind: a read that asks
// for `*`, `tutor_id` or `confirm_request_id` is refused (400); the two functions answer the contract's words
// (claim_not_found, already_handled, request_reused, student_archived, date_out_of_range, amount_over_remaining
// with the paise owed as the detail); the same request id on a confirmed claim returns the same row; and every
// other write to the table is refused (42501) and logged, so a spec can prove none was sent.
import type { Page, Route } from "@playwright/test";
import { HOST, USER_ID } from "./auth-helpers";
import { NOW } from "./board-fixture";
import type { Dues } from "./dues-helpers";
import type { Payments } from "./pay-helpers";
import type { Roster } from "./roster-helpers";

export type ClaimRow = {
  id: string;
  tutor_id: string;
  student_id: string;
  due_id: string;
  amount: number;
  fee_count: number;
  upi_ref: string | null;
  screenshot_path: string | null;
  status: "pending" | "confirmed" | "rejected";
  created_at: string;
  handled_at: string | null;
  confirm_request_id: string | null;
  confirmed_receipt_from: number | null;
  confirmed_receipt_count: number | null;
};

export type ClaimRequest = { method: string; path: string; query: string; body: string | null; headers: Record<string, string> };

export type Claims = {
  claims: ClaimRow[];
  requests: ClaimRequest[];
  /** Answer the next confirm_claim with a server error, changing nothing. */
  failNext: boolean;
  /** Do the next confirm_claim, then drop the connection instead of answering (the lost response). */
  loseNextResponse: boolean;
  /** Hold every function answer back this many milliseconds. */
  delayMs: number;
  /** Answer every read (the list and the count) with this status. Null answers normally. */
  readStatus: number | null;
  /** A claim sent by a parent. The fee it names, its student and the proof are needed; the rest has defaults. */
  add(partial: Partial<ClaimRow> & { student_id: string; due_id: string; amount: number }): ClaimRow;
  /** Another phone handled the claim: the database has it, this phone does not know yet. */
  handleElsewhere(id: string, how: "confirm" | "reject"): ClaimRow;
  /** The bodies of the calls of one function. */
  calls(name: "confirm_claim" | "reject_claim"): Record<string, unknown>[];
  /** Reads of the table (GET and HEAD). */
  reads(): ClaimRequest[];
  /** Writes to the table other than the two functions: always empty if the app behaves. */
  writes(): ClaimRequest[];
};

const COLUMNS = ["id", "student_id", "due_id", "amount", "fee_count", "upi_ref", "screenshot_path", "status", "created_at", "handled_at", "confirmed_receipt_from", "confirmed_receipt_count"];
const DAY = 86_400_000;
const INDIA_OFFSET = 19_800_000;
const indiaDay = (ms: number) => new Date(ms + INDIA_OFFSET).toISOString().slice(0, 10);
let counter = 0;
const uuid = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(800000 + counter).padStart(12, "0")}`;
};

export async function stubClaims(page: Page, dues: Dues, pay: Payments, roster: Roster, initial: (Partial<ClaimRow> & { student_id: string; due_id: string; amount: number })[] = []): Promise<Claims> {
  const state: Claims = {
    claims: [],
    requests: [],
    failNext: false,
    loseNextResponse: false,
    delayMs: 0,
    readStatus: null,
    add(partial) {
      const row: ClaimRow = {
        id: uuid(),
        tutor_id: USER_ID,
        fee_count: 1,
        upi_ref: "628104739915",
        screenshot_path: null,
        status: "pending",
        created_at: "2026-10-12T03:00:00Z",
        handled_at: null,
        confirm_request_id: null,
        confirmed_receipt_from: null,
        confirmed_receipt_count: null,
        ...partial,
      };
      state.claims.push(row);
      return row;
    },
    handleElsewhere(id, how) {
      const claim = state.claims.find((c) => c.id === id);
      if (!claim) throw new Error(`no claim ${id}`);
      return how === "confirm" ? confirm(claim, uuid()) : reject(claim);
    },
    calls: (name) => state.requests.filter((r) => r.path.endsWith(`/rpc/${name}`)).map((r) => JSON.parse(r.body ?? "{}") as Record<string, unknown>),
    reads: () => state.requests.filter((r) => r.path === "/rest/v1/payment_claims" && (r.method === "GET" || r.method === "HEAD")),
    writes: () => state.requests.filter((r) => r.path === "/rest/v1/payment_claims" && r.method !== "GET" && r.method !== "HEAD"),
  };
  for (const claim of initial) state.add(claim);

  // The fees a student still owes, in the order the database applies a claim: an earlier balance, then by due date.
  const open = (studentId: string) =>
    dues.dues
      .filter((due) => due.student_id === studentId && due.status !== "paid")
      .sort((a, b) => Number(b.kind === "opening") - Number(a.kind === "opening") || a.due_date.localeCompare(b.due_date));

  function confirm(claim: ClaimRow, requestId: string): ClaimRow {
    const from = pay.payments.reduce((most, p) => Math.max(most, p.receipt_no), 0) + 1;
    let left = claim.amount;
    let count = 0;
    for (const due of open(claim.student_id)) {
      if (left === 0) break;
      const take = Math.min(left, due.amount - due.amount_paid);
      pay.seed({ due_id: due.id, amount: take, method: "upi", paid_on: indiaDay(Date.parse(claim.created_at)) });
      left -= take;
      count += 1;
    }
    claim.status = "confirmed";
    claim.handled_at = NOW.toISOString();
    claim.confirm_request_id = requestId;
    claim.confirmed_receipt_from = from;
    claim.confirmed_receipt_count = count;
    return claim;
  }
  function reject(claim: ClaimRow): ClaimRow {
    claim.status = "rejected";
    claim.handled_at = NOW.toISOString();
    return claim;
  }

  const cors = (route: Route) => ({
    "access-control-allow-origin": route.request().headers()["origin"] ?? "*",
    "access-control-expose-headers": "*",
    vary: "origin",
  });
  const json = (route: Route, status: number, body: unknown, headers: Record<string, string> = {}) =>
    route.fulfill({ status, body: JSON.stringify(body), headers: { ...cors(route), "content-type": "application/json", ...headers } });
  const refuse = (route: Route, word: string, details: string | null = null) => json(route, 400, { code: "P0001", message: word, details, hint: null });

  await page.route(
    (url) => url.origin === HOST && (url.pathname === "/rest/v1/payment_claims" || url.pathname === "/rest/v1/rpc/confirm_claim" || url.pathname === "/rest/v1/rpc/reject_claim"),
    async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await route.fallback();
        return;
      }
      const url = new URL(request.url());
      const method = request.method();
      state.requests.push({ method, path: url.pathname, query: url.search, body: request.postData(), headers: request.headers() });

      if (url.pathname === "/rest/v1/payment_claims") {
        if (method !== "GET" && method !== "HEAD") {
          await json(route, 403, { code: "42501", message: "permission denied for table payment_claims" });
          return;
        }
        if (state.readStatus !== null) {
          await json(route, state.readStatus, { message: "made-up server error" });
          return;
        }
        const select = url.searchParams.get("select") ?? "*";
        if (select === "*" || select.split(",").some((column) => !COLUMNS.includes(column))) {
          await json(route, 400, { code: "42703", message: `a column the app may not ask for: ${select}` });
          return;
        }
        let rows = state.claims.slice();
        const status = url.searchParams.get("status") ?? "";
        if (status.startsWith("eq.")) rows = rows.filter((row) => row.status === status.slice(3));
        else if (status.startsWith("in.(")) rows = rows.filter((row) => status.slice(4, -1).split(",").includes(row.status));
        const order = url.searchParams.get("order") ?? "";
        const [column, direction] = order.split(".");
        if (column) {
          const key = column as "created_at" | "handled_at";
          rows.sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * (direction === "desc" ? -1 : 1));
        }
        const total = rows.length;
        if (url.searchParams.get("limit")) rows = rows.slice(0, Number(url.searchParams.get("limit")));
        const range = { "content-range": total === 0 ? "*/0" : `0-${total - 1}/${total}` };
        if (method === "HEAD") {
          await route.fulfill({ status: 200, headers: { ...cors(route), ...range } });
          return;
        }
        await json(
          route,
          200,
          rows.map((row) => Object.fromEntries(select.split(",").map((c) => [c, (row as Record<string, unknown>)[c]]))),
          range,
        );
        return;
      }

      if (state.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, state.delayMs));
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
      const claim = state.claims.find((c) => c.id === body.p_claim);

      if (url.pathname.endsWith("/confirm_claim")) {
        if (state.failNext) {
          state.failNext = false;
          await json(route, 500, { code: "XX000", message: "made-up server error" });
          return;
        }
        const requestId = String(body.p_request_id);
        if (!claim) return void (await refuse(route, "claim_not_found"));
        if (claim.status === "confirmed" && claim.confirm_request_id === requestId) return void (await json(route, 200, claim));
        if (state.claims.some((c) => c.confirm_request_id === requestId && c.id !== claim.id)) return void (await refuse(route, "request_reused"));
        if (claim.status !== "pending") return void (await refuse(route, "already_handled"));
        if (roster.students.find((s) => s.id === claim.student_id)?.active === false) return void (await refuse(route, "student_archived"));
        if (Math.floor(NOW.getTime() / DAY) - Math.floor((Date.parse(claim.created_at) + INDIA_OFFSET) / DAY) > 90) return void (await refuse(route, "date_out_of_range"));
        const owed = open(claim.student_id).reduce((sum, due) => sum + due.amount - due.amount_paid, 0);
        if (owed < claim.amount) return void (await refuse(route, "amount_over_remaining", String(owed)));
        confirm(claim, requestId);
        if (state.loseNextResponse) {
          state.loseNextResponse = false;
          await route.abort("failed");
          return;
        }
        await json(route, 200, claim);
        return;
      }

      // reject_claim
      if (!claim) return void (await refuse(route, "claim_not_found"));
      if (claim.status !== "pending") return void (await refuse(route, "already_handled"));
      await json(route, 200, reject(claim));
    },
  );
  return state;
}
