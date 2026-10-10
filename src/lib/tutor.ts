// The tutor's own row: read it, change the profile, keep the language in step. The one place that
// writes the profile. It is a direct, online-only call, a recorded exception to "writes go through the
// outbox" (spec R1-1, decision 9): the outbox arrives in R1-12 and swaps these functions.
//
// Only the columns the database grants are ever sent (name, subjects, upi_id, language), and every
// update ends in `.select().single()` so an update that changed no row is an error, not silence.
import { isLocale, type Locale } from "@/config/locales";
import { getClient } from "./supabase";

export type Tutor = {
  id: string;
  email: string | null;
  name: string | null;
  language: Locale;
  upiId: string | null;
  subjects: string[];
};

type Row = {
  id: string;
  email: string | null;
  name: string | null;
  language: string;
  upi_id: string | null;
  subjects: string[] | null;
};

const COLUMNS = "id,email,name,language,upi_id,subjects";

function fromRow(row: Row): Tutor {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    language: isLocale(row.language) ? row.language : "en",
    upiId: row.upi_id,
    subjects: row.subjects ?? [],
  };
}

/**
 * Why the tutor's row could not be read. `rejected`: the server answered and refused this session (401,
 * 403, PostgREST's PGRST30x), so trying again cannot help and the tutor must sign in again. `failed`:
 * anything else (the network, a 5xx). Nothing is lost; try again.
 */
export type TutorLoadKind = "rejected" | "failed";

export class TutorLoadError extends Error {
  readonly kind: TutorLoadKind;
  constructor(kind: TutorLoadKind = "failed") {
    super("The tutor's row could not be loaded");
    this.name = "TutorLoadError";
    this.kind = kind;
  }
}

/** Tells a refused session (401, 403, PGRST30x: bad, expired or unknown token, a deleted user) from any other failure. */
export function classifyLoadFailure(failure: { status?: number; code?: string }): TutorLoadKind {
  if (failure.status === 401 || failure.status === 403) return "rejected";
  if (typeof failure.code === "string" && /^PGRST30\d$/.test(failure.code)) return "rejected";
  return "failed";
}

/**
 * The signed-in tutor's own row (row-level security lets them see no other). Null when there is no row.
 * Throws TutorLoadError when it could not be read; its `kind` says whether the session was refused.
 */
export async function getTutor(): Promise<Tutor | null> {
  let result;
  try {
    const client = await getClient();
    result = await client.from("tutors").select(COLUMNS).maybeSingle<Row>();
  } catch {
    throw new TutorLoadError();
  }
  if (result.error) throw new TutorLoadError(classifyLoadFailure({ status: result.status, code: result.error.code }));
  return result.data ? fromRow(result.data) : null;
}

/** `failed`: nothing was saved (network, server, no session). `missing`: the call worked but there is no row to change. */
export type SaveResult = { ok: true; tutor: Tutor } | { ok: false; reason: "failed" | "missing" };

// PostgREST says this when `.single()` finds no row, which is what an update that changed nothing looks like.
const NO_ROW = "PGRST116";

async function update(patch: Partial<Pick<Row, "name" | "subjects" | "upi_id" | "language">>): Promise<SaveResult> {
  try {
    const client = await getClient();
    const { data: current } = await client.auth.getSession();
    const id = current.session?.user.id;
    if (!id) return { ok: false, reason: "failed" };
    const { data, error } = await client.from("tutors").update(patch).eq("id", id).select(COLUMNS).single<Row>();
    if (error) return { ok: false, reason: error.code === NO_ROW ? "missing" : "failed" };
    return { ok: true, tutor: fromRow(data) };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Setup step 1. `language` is the language of the page in use. */
export function saveProfile(profile: { name: string; subjects: string[]; language: Locale }): Promise<SaveResult> {
  return update({ name: profile.name, subjects: profile.subjects, language: profile.language });
}

/** Setup step 2. */
export function saveUpi(upiId: string): Promise<SaveResult> {
  return update({ upi_id: upiId });
}

/** When the tutor's saved language is not the page's, quietly make it so. A failure is ignored: nothing depends on it. */
export async function syncLanguage(tutor: Pick<Tutor, "language">, locale: Locale): Promise<void> {
  if (tutor.language === locale) return;
  await update({ language: locale });
}
