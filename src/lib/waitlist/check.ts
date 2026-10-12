// What the form tells the person about each field. The rules themselves are the shared ones in
// rules.ts; this only names the kind of problem so the page can pick the right sentence.
import { checkCity, checkName, cleanText, normalizePhone, BANDS, type WaitlistRow } from "./rules";

export type TextProblem = "missing" | "check";
export type Problem = TextProblem | null;

export type FormValues = { name: string; phone: string; city: string; students: string };

export type FormCheck = {
  name: Problem;
  phone: Problem;
  city: Problem;
  students: "missing" | null;
  /** The values ready to send, when nothing is wrong. */
  row: Pick<WaitlistRow, "name" | "phone" | "city" | "students_count"> | null;
};

const blank = (raw: string) => (cleanText(raw) ?? raw).trim() === "";

/** Nothing typed is "missing"; anything the rules refuse is "check". */
function text(raw: string, rule: typeof checkName): Problem {
  if (blank(raw)) return "missing";
  return rule(raw).ok ? null : "check";
}

export function checkForm(values: FormValues): FormCheck {
  const name = text(values.name, checkName);
  const city = text(values.city, checkCity);
  const phone: Problem = blank(values.phone) ? "missing" : normalizePhone(values.phone) === null ? "check" : null;
  const band = values.students === "" ? NaN : Number(values.students);
  const students = (BANDS as readonly number[]).includes(band) ? null : "missing";
  const nameChecked = checkName(values.name);
  const cityChecked = checkCity(values.city);
  const phoneChecked = normalizePhone(values.phone);
  const row =
    nameChecked.ok && cityChecked.ok && phoneChecked !== null && students === null
      ? { name: nameChecked.value, phone: phoneChecked, city: cityChecked.value, students_count: band as WaitlistRow["students_count"] }
      : null;
  return { name, phone, city, students, row };
}
