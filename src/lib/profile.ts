// The tutor's profile rules and the route decision. Pure: no React, no browser, no network.

import type { Place } from "@/config/routes";

export const NAME_MAX = 80;
export const SUBJECT_MAX = 30;
export const SUBJECTS_MAX = 8;
/** The database also caps all subjects joined by commas, in bytes (the tutors table's check). */
export const SUBJECTS_BYTES_MAX = 400;

/** The seven subjects shown as chips. They are stored as these keys, so a name can change language without a migration. */
export const presetKeys = ["maths", "science", "english", "hindi", "physics", "chemistry", "accounts"] as const;
export type PresetKey = (typeof presetKeys)[number];
/** The page language's name for each preset, from the `subjects` messages. */
export type SubjectNames = Record<PresetKey, string>;

const characters = (text: string): number => Array.from(text).length;
const bytes = (text: string): number => new TextEncoder().encode(text).length;

/** Spaces at the ends removed, every run of white space made one space. */
function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export type NameCheck = { ok: true; value: string } | { ok: false; error: "missing" | "tooLong" };

/** 1 to 80 characters, any script, tidied. Length counts characters, as the database does. */
export function normalizeName(raw: string): NameCheck {
  const value = tidy(raw);
  if (value === "") return { ok: false, error: "missing" };
  if (characters(value) > NAME_MAX) return { ok: false, error: "tooLong" };
  return { ok: true, value };
}

export function isPresetKey(value: string): value is PresetKey {
  return (presetKeys as readonly string[]).includes(value);
}

/** What is saved for something the tutor typed or tapped: a preset's key when it is the page language's name for one, else the tidied text. */
export function storedSubject(typed: string, names: SubjectNames): string {
  const value = tidy(typed);
  const lower = value.toLowerCase();
  const hit = presetKeys.find((key) => names[key].toLowerCase() === lower);
  return hit ?? value;
}

/** What is shown for a saved subject: a preset's key in the page's language, anything else as it was typed. */
export function subjectLabel(stored: string, names: SubjectNames): string {
  return isPresetKey(stored) ? names[stored] : stored;
}

export type SubjectsCheck = { ok: true; value: string[] } | { ok: false; error: "missing" | "limit" };

/** At least 1 and at most 8, each 1 to 30 characters, no repeats (ignoring case), and short enough in total for the database. */
export function normalizeSubjects(list: readonly string[], names: SubjectNames): SubjectsCheck {
  const seen = new Set<string>();
  const value: string[] = [];
  for (const item of list) {
    const stored = storedSubject(item, names);
    if (stored === "") continue;
    const id = stored.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    value.push(stored);
  }
  if (value.length === 0) return { ok: false, error: "missing" };
  if (value.length > SUBJECTS_MAX) return { ok: false, error: "limit" };
  if (value.some((item) => characters(item) > SUBJECT_MAX)) return { ok: false, error: "limit" };
  if (bytes(value.join(",")) > SUBJECTS_BYTES_MAX) return { ok: false, error: "limit" };
  return { ok: true, value };
}

/** The fields that decide whether setup is finished. */
export type ProfileFields = { name: string | null; subjects: readonly string[]; upiId: string | null };

/** Which setup step is still open: 1 when the name or subjects are missing, else 2 when the UPI ID is, else none. */
export function openStep(profile: ProfileFields): "profile" | "upi" | null {
  if (!profile.name || profile.name.trim() === "" || profile.subjects.length === 0) return "profile";
  if (!profile.upiId || profile.upiId.trim() === "") return "upi";
  return null;
}

export function isProfileComplete(profile: ProfileFields): boolean {
  return openStep(profile) === null;
}

export type RouteInput = {
  /** What is known about the session. `error` is a network failure, not a sign-out. */
  session: "loading" | "signed-out" | "signed-in" | "error";
  /** The tutor's profile once fetched; undefined while it is not known. */
  profile: ProfileFields | undefined;
  /** The screen the tutor is on. */
  place: Place;
};

export type Decision = { action: "wait" } | { action: "stay" } | { action: "go"; to: Place };

const wait: Decision = { action: "wait" };
const stay: Decision = { action: "stay" };
const go = (to: Place): Decision => ({ action: "go", to });

const appPlaces: readonly Place[] = ["home", "more", "setup-profile", "setup-upi"];

/**
 * Where a tutor goes (spec R1-1, criterion 17). This is a convenience for the person; it protects
 * nothing: row-level security does.
 *
 * - Not known yet, or a network failure: wait (the screen shows its loading or error state).
 * - Signed out: the sign-in and callback screens stay; every app screen goes to sign-in.
 * - Signed in with setup unfinished: sign-in, callback, home and more go to the open step. Step 1
 *   stays; step 2 stays unless step 1 is still open.
 * - Signed in with setup finished: sign-in and callback go home. Everything else stays, so a
 *   finished profile can still be edited.
 */
export function nextRoute(input: RouteInput): Decision {
  const { session, profile, place } = input;
  if (session === "loading" || session === "error") return wait;
  if (session === "signed-out") return appPlaces.includes(place) ? go("sign-in") : stay;
  if (profile === undefined) return wait;
  const open = openStep(profile);
  if (open === null) return place === "sign-in" || place === "callback" ? go("home") : stay;
  const step: Place = open === "profile" ? "setup-profile" : "setup-upi";
  if (place === "setup-profile") return stay;
  if (place === "setup-upi") return open === "profile" ? go("setup-profile") : stay;
  return go(step);
}
