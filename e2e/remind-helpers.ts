// A fake of the reminders table's two functions, for the browser specs of slice R1-8. Test code only.
// Registers after `signedIn` (board-fixture.ts) and reads the same due rows `stubDues` holds. It answers the
// contract's machine words (supabase/migrations/20261012150000_r1_reminders.sql), makes a retry with the
// same request id answer the same time, and logs every call so a spec can see exactly what was sent.
import type { Page, Route } from "@playwright/test";
import { HOST, USER_ID } from "./auth-helpers";
import type { Dues } from "./dues-helpers";
import type { Roster } from "./roster-helpers";

export type ReminderRow = { due_id: string; request_id: string; template: string; sent_at: string };
export type RemindRequest = { method: string; path: string; query: string; body: string | null; headers: Record<string, string> };

export type Reminders = {
  rows: ReminderRow[];
  requests: RemindRequest[];
  /** Answer record_reminder with a server error (500), recording nothing, while true. */
  failRecord: boolean;
  /** Record the next reminder, then drop the connection instead of answering. */
  loseNextResponse: boolean;
  /** Answer last_reminders with a server error while true. */
  failRead: boolean;
  /** Seed a reminder made earlier. */
  seed(dueId: string, sentAt: string, template?: string): ReminderRow;
  /** The bodies of the record_reminder calls. */
  calls(): Record<string, unknown>[];
  /** Calls to last_reminders. */
  reads(): RemindRequest[];
};

// 05:00 UTC on 12 Oct 2026, the fixed clock of the board specs (board-fixture.ts).
const NOW = new Date("2026-10-12T05:00:00Z");

let counter = 0;
const uuid = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(500000 + counter).padStart(12, "0")}`;
};

export async function stubReminders(page: Page, dues: Dues, roster: Roster): Promise<Reminders> {
  const state: Reminders = {
    rows: [],
    requests: [],
    failRecord: false,
    loseNextResponse: false,
    failRead: false,
    seed(dueId, sentAt, template = "polite:en:month") {
      const row = { due_id: dueId, request_id: uuid(), template, sent_at: sentAt };
      state.rows.push(row);
      return row;
    },
    calls: () => state.requests.filter((r) => r.path.endsWith("/rpc/record_reminder")).map((r) => JSON.parse(r.body ?? "{}") as Record<string, unknown>),
    reads: () => state.requests.filter((r) => r.path.endsWith("/rpc/last_reminders")),
  };
  const cors = (route: Route) => ({
    "access-control-allow-origin": route.request().headers()["origin"] ?? "*",
    "access-control-expose-headers": "*",
    vary: "origin",
  });
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, body: JSON.stringify(body), headers: { ...cors(route), "content-type": "application/json" } });
  const refuse = (route: Route, word: string) => json(route, 400, { code: "P0001", message: word, details: null, hint: null });

  await page.route(
    (url) => url.origin === HOST && (url.pathname === "/rest/v1/rpc/last_reminders" || url.pathname === "/rest/v1/rpc/record_reminder"),
    async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await route.fallback();
        return;
      }
      const url = new URL(request.url());
      state.requests.push({ method: request.method(), path: url.pathname, query: url.search, body: request.postData(), headers: request.headers() });

      if (url.pathname.endsWith("/last_reminders")) {
        if (state.failRead) return void (await json(route, 500, { code: "XX000", message: "made-up server error" }));
        const out: { due_id: string; last_sent_at: string; times: number }[] = [];
        for (const due of dues.dues) {
          const student = roster.students.find((s) => s.id === due.student_id);
          if (due.status === "paid" || !student?.active) continue;
          const mine = state.rows.filter((r) => r.due_id === due.id);
          if (mine.length === 0) continue;
          const last = mine.map((r) => r.sent_at).sort().at(-1)!;
          out.push({ due_id: due.id, last_sent_at: last, times: mine.length });
        }
        await json(route, 200, out);
        return;
      }

      if (state.failRecord) return void (await json(route, 500, { code: "XX000", message: "made-up server error" }));
      const body = JSON.parse(request.postData() ?? "{}") as Record<string, string>;
      const { p_due: dueId, p_template: template, p_request_id: requestId } = body;
      if (!dueId || !requestId || !/^(polite|firm):(en|hi|kn|te):(month|balance)$/.test(template ?? "")) return void (await refuse(route, "invalid_argument"));
      const known = state.rows.find((r) => r.request_id === requestId);
      if (known) return void (await json(route, 200, known.sent_at));
      const due = dues.dues.find((d) => d.id === dueId);
      const student = roster.students.find((s) => s.id === due?.student_id);
      if (!due || !student) return void (await refuse(route, "due_not_found"));
      if (due.status === "paid") return void (await refuse(route, "already_paid"));
      if (!student.active) return void (await refuse(route, "student_archived"));
      if (!student.parent_phone) return void (await refuse(route, "no_phone"));
      const row = { due_id: dueId, request_id: requestId, template, sent_at: NOW.toISOString() };
      state.rows.push(row);
      if (state.loseNextResponse) {
        state.loseNextResponse = false;
        await route.abort("failed");
        return;
      }
      await json(route, 200, row.sent_at);
    },
  );
  void USER_ID;
  return state;
}
