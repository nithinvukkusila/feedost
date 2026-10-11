// A fake of the students and batches tables for the browser specs of slice R1-3. Test code only.
//
// It registers after `stubSupabase` (auth-helpers.ts), and Playwright tries the route registered last
// first, so `auth-helpers.ts` is not changed: requests to `/rest/v1/students` and `/rest/v1/batches` are
// answered here, everything else (and every CORS preflight) falls back to `stubSupabase`.
//
// It acts like the real tables where the app could be fooled by a fake that is too kind: a write that
// names a column the database does not grant is refused (42501, as for `tutor_id` or `pay_token`), a second
// batch name in any letter case is refused (23505 on the unique index), a student's batch must exist
// (23503), an id used twice is refused (23505), and deleting a batch leaves its students with no batch.
// It does not check the field limits: the app's own checks are what the specs prove. Every request body
// is logged so a spec can assert exactly which columns were sent.
import type { Page, Route } from "@playwright/test";
import { HOST, USER_ID } from "./auth-helpers";

export type StudentRow = {
  id: string;
  tutor_id: string;
  batch_id: string | null;
  name: string;
  parent_name: string | null;
  parent_phone: string | null;
  parent_language: string;
  monthly_fee: number;
  opening_balance: number;
  due_day: number;
  pay_token: string;
  active: boolean;
};

export type BatchRow = { id: string; tutor_id: string; name: string; timings: string | null };

export type RosterRequest = { method: string; table: "students" | "batches"; query: string; accept: string; prefer: string; body: unknown };

const STUDENT_INSERT = ["id", "batch_id", "name", "parent_name", "parent_phone", "parent_language", "monthly_fee", "opening_balance", "due_day", "active"];
const STUDENT_UPDATE = STUDENT_INSERT.filter((column) => column !== "id");
const BATCH_INSERT = ["id", "name", "timings"];
const BATCH_UPDATE = ["name", "timings"];

export type Roster = {
  students: StudentRow[];
  batches: BatchRow[];
  /** Every request that reached the two tables, in order, with its body parsed. */
  requests: RosterRequest[];
  /** Answer every request to the two tables by dropping the connection, as a dead network does. */
  networkDown: boolean;
  /** Answer every write with a server error. */
  refuseWrites: boolean;
  /** Hold every read back this many milliseconds (the loading state). */
  listDelayMs: number;
  /** Answer every read with this status and a PostgREST-shaped error (503: down). Null answers normally. */
  readStatus: number | null;
  /** Refuse every batch insert and rename as if the name were taken, whatever it is. */
  batchNameTaken: boolean;
  /** Refuse every student write that names a batch as if that batch had been deleted elsewhere. */
  batchGone: boolean;
  /** Do the next write but drop its answer, as a network that dies on the way back does. Resets itself. */
  dropNextAnswer: boolean;
  /** Hold every write back this many milliseconds (the busy state). */
  writeDelayMs: number;
  /** Add a student (with defaults) and return the row. */
  addStudent(partial: Partial<StudentRow> & { name: string }): StudentRow;
  addBatch(partial: Partial<BatchRow> & { name: string }): BatchRow;
  /** The bodies of the requests of one kind, in order. */
  bodies(method: string, table: "students" | "batches"): Record<string, unknown>[];
};

let counter = 0;
const uuid = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
};

function selectedColumns(query: URLSearchParams, row: Record<string, unknown>): Record<string, unknown> {
  const select = query.get("select");
  if (!select || select === "*") return row;
  return Object.fromEntries(select.split(",").map((column) => [column, row[column]]));
}

/** Rows matching `id=eq.X` or `id=in.(X,Y)`. Without an id filter, all rows. */
function matching<T extends { id: string }>(rows: T[], query: URLSearchParams): T[] {
  const id = query.get("id");
  if (id === null) return rows;
  if (id.startsWith("eq.")) return rows.filter((row) => row.id === id.slice(3));
  if (id.startsWith("in.(")) {
    const ids = id.slice(4, -1).split(",").map((part) => part.replace(/^"|"$/g, ""));
    return rows.filter((row) => ids.includes(row.id));
  }
  return [];
}

export async function stubRoster(
  page: Page,
  initial: { students?: Partial<StudentRow>[]; batches?: Partial<BatchRow>[] } = {},
): Promise<Roster> {
  const roster: Roster = {
    students: [],
    batches: [],
    requests: [],
    networkDown: false,
    refuseWrites: false,
    listDelayMs: 0,
    readStatus: null,
    batchNameTaken: false,
    batchGone: false,
    dropNextAnswer: false,
    writeDelayMs: 0,
    addStudent(partial) {
      const row: StudentRow = {
        id: uuid(),
        tutor_id: USER_ID,
        batch_id: null,
        parent_name: null,
        parent_phone: null,
        parent_language: "en",
        monthly_fee: 100000,
        opening_balance: 0,
        due_day: 1,
        pay_token: `token-${counter}-aaaaaaaaaaaaaaaa`,
        active: true,
        ...partial,
      };
      roster.students.push(row);
      return row;
    },
    addBatch(partial) {
      const row: BatchRow = { id: uuid(), tutor_id: USER_ID, timings: null, ...partial };
      roster.batches.push(row);
      return row;
    },
    bodies: (method, table) =>
      roster.requests.filter((request) => request.method === method && request.table === table).map((request) => request.body as Record<string, unknown>),
  };
  for (const student of initial.students ?? []) roster.addStudent({ name: "?", ...student });
  for (const batch of initial.batches ?? []) roster.addBatch({ name: "?", ...batch });

  const cors = (route: Route) => {
    const headers = route.request().headers();
    return {
      "access-control-allow-origin": headers["origin"] ?? "*",
      "access-control-expose-headers": "*",
      vary: "origin",
    };
  };
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, body: JSON.stringify(body), headers: { ...cors(route), "content-type": "application/json" } });
  const noRow = (route: Route) =>
    json(route, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 0 rows" });
  const denied = (route: Route, table: string) => json(route, 403, { code: "42501", message: `permission denied for table ${table}` });

  await page.route(
    (url) => url.origin === HOST && (url.pathname === "/rest/v1/students" || url.pathname === "/rest/v1/batches"),
    async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await route.fallback();
        return;
      }
      const url = new URL(request.url());
      const table = url.pathname.endsWith("/students") ? "students" : "batches";
      const method = request.method();
      const query = url.searchParams;
      const accept = request.headers()["accept"] ?? "";
      const prefer = request.headers()["prefer"] ?? "";
      const wantsObject = accept.includes("vnd.pgrst.object");
      let body: unknown = null;
      const text = request.postData();
      if (text) body = JSON.parse(text);
      roster.requests.push({ method, table, query: url.search, accept, prefer, body });

      if (roster.networkDown) {
        await route.abort("failed");
        return;
      }
      const reply = (rows: Record<string, unknown>[]) => {
        const shaped = rows.map((row) => selectedColumns(query, row));
        if (wantsObject) return shaped.length === 1 ? json(route, 200, shaped[0]) : noRow(route);
        return json(route, 200, shaped);
      };

      if (method === "GET") {
        if (roster.listDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, roster.listDelayMs));
        if (roster.readStatus !== null) {
          await json(route, roster.readStatus, { message: "made-up server error" });
          return;
        }
        const rows = table === "students" ? matching(roster.students, query) : matching(roster.batches, query);
        await reply(rows as unknown as Record<string, unknown>[]);
        return;
      }

      // Writes.
      if (roster.writeDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, roster.writeDelayMs));
      if (roster.refuseWrites) {
        await json(route, 500, { code: "XX000", message: "made-up server error" });
        return;
      }
      const drop = roster.dropNextAnswer && (method === "POST" || method === "PATCH" || method === "DELETE");
      const finish = async (status: number, payload: unknown) => {
        if (drop) {
          roster.dropNextAnswer = false;
          await route.abort("failed");
          return;
        }
        await json(route, status, payload);
      };
      const finishRows = async (rows: Record<string, unknown>[], status = 200) => {
        const shaped = rows.map((row) => selectedColumns(query, row));
        if (!wantsObject) await finish(status, shaped);
        else if (shaped.length === 1) await finish(status, shaped[0]);
        else await noRow(route);
      };

      const keys = body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body as object) : [];

      if (table === "students") {
        const patch = body as Record<string, unknown>;
        if (method === "POST") {
          if (keys.some((key) => !STUDENT_INSERT.includes(key))) return void (await denied(route, "students"));
          if (roster.batchGone && patch.batch_id) return void (await json(route, 409, { code: "23503", message: 'insert or update on table "students" violates foreign key constraint "students_batch_fkey"' }));
          if (patch.batch_id && !roster.batches.some((batch) => batch.id === patch.batch_id)) return void (await json(route, 409, { code: "23503", message: 'insert or update on table "students" violates foreign key constraint "students_batch_fkey"' }));
          if (roster.students.some((student) => student.id === patch.id)) return void (await json(route, 409, { code: "23505", message: 'duplicate key value violates unique constraint "students_pkey"' }));
          const row = roster.addStudent({ name: String(patch.name), ...(patch as Partial<StudentRow>) });
          await finishRows([row as unknown as Record<string, unknown>], 201);
          return;
        }
        if (method === "PATCH") {
          if (keys.some((key) => !STUDENT_UPDATE.includes(key))) return void (await denied(route, "students"));
          if (patch.batch_id && (roster.batchGone || !roster.batches.some((batch) => batch.id === patch.batch_id))) {
            return void (await json(route, 409, { code: "23503", message: 'insert or update on table "students" violates foreign key constraint "students_batch_fkey"' }));
          }
          const rows = matching(roster.students, query);
          for (const row of rows) Object.assign(row, patch);
          await finishRows(rows as unknown as Record<string, unknown>[]);
          return;
        }
        if (method === "DELETE") {
          const rows = matching(roster.students, query);
          roster.students = roster.students.filter((student) => !rows.includes(student));
          await finishRows(rows as unknown as Record<string, unknown>[]);
          return;
        }
      } else {
        const patch = body as Record<string, unknown>;
        const taken = (name: unknown, exceptId?: string) =>
          roster.batchNameTaken || roster.batches.some((batch) => batch.id !== exceptId && batch.name.toLowerCase() === String(name).toLowerCase());
        const takenError = { code: "23505", message: 'duplicate key value violates unique constraint "batches_tutor_id_lower_name_key"' };
        if (method === "POST") {
          if (keys.some((key) => !BATCH_INSERT.includes(key))) return void (await denied(route, "batches"));
          if (roster.batches.some((batch) => batch.id === patch.id)) return void (await json(route, 409, { code: "23505", message: 'duplicate key value violates unique constraint "batches_pkey"' }));
          if (taken(patch.name)) return void (await json(route, 409, takenError));
          const row = roster.addBatch({ name: String(patch.name), ...(patch as Partial<BatchRow>) });
          await finishRows([row as unknown as Record<string, unknown>], 201);
          return;
        }
        if (method === "PATCH") {
          if (keys.some((key) => !BATCH_UPDATE.includes(key))) return void (await denied(route, "batches"));
          const rows = matching(roster.batches, query);
          if (rows.length === 1 && patch.name !== undefined && taken(patch.name, rows[0].id)) return void (await json(route, 409, takenError));
          for (const row of rows) Object.assign(row, patch);
          await finishRows(rows as unknown as Record<string, unknown>[]);
          return;
        }
        if (method === "DELETE") {
          const rows = matching(roster.batches, query);
          roster.batches = roster.batches.filter((batch) => !rows.includes(batch));
          // The database nulls the batch of the students who were in it; they are not deleted.
          for (const student of roster.students) if (rows.some((row) => row.id === student.batch_id)) student.batch_id = null;
          await finishRows(rows as unknown as Record<string, unknown>[]);
          return;
        }
      }
      await json(route, 405, { message: "not stubbed" });
    },
  );
  return roster;
}
