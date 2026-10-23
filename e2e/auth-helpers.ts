// Helpers for the signed-in app's browser specs (spec R1-1, section 9). Test code only.
//
// The build under test is made with the CI's made-up Supabase address, and Playwright answers every
// request to it: no real project, no Google, no key. A made-up session is written into localStorage
// before the page loads, under the key the library reads, so the real supabase-js code runs (storage,
// PKCE, request shape) against answers written here.
//   rm -rf .next out && NEXT_PUBLIC_SUPABASE_URL=https://cicicicicicicicicici.supabase.co \
//     NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-anon-key pnpm build
import type { BrowserContext, Page, Request, Route } from "@playwright/test";

export const HOST = "https://cicicicicicicicicici.supabase.co";
export const SESSION_KEY = "sb-cicicicicicicicicici-auth-token";

/** What a spec says when the build was made with another address: the first request goes elsewhere. */
export const BUILD_HINT =
  "Build with the CI fake address: rm -rf .next out && NEXT_PUBLIC_SUPABASE_URL=https://cicicicicicicicicici.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-anon-key pnpm build";

export type FakeTutor = {
  id: string;
  email: string | null;
  name: string | null;
  language: string;
  upi_id: string | null;
  subjects: string[];
};

export const USER_ID = "00000000-0000-4000-8000-0000000000a1";

/** A tutor row as a new tutor has it: only the id, the email and the language the trigger sets. */
export function newTutor(overrides: Partial<FakeTutor> = {}): FakeTutor {
  return { id: USER_ID, email: "meena@example.com", name: null, language: "en", upi_id: null, subjects: [], ...overrides };
}

/** A tutor whose setup is finished. */
export function completeTutor(overrides: Partial<FakeTutor> = {}): FakeTutor {
  return newTutor({ name: "Meena Iyer", subjects: ["maths", "science"], upi_id: "meena.tuitions@okhdfc", ...overrides });
}

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** Made-up and unsigned, built here so no token-shaped text sits in the repository. */
function fakeToken(expiresAt: number): string {
  return [base64url({ alg: "HS256", typ: "JWT" }), base64url({ sub: USER_ID, role: "authenticated", exp: expiresAt }), "bWFkZS11cA"].join(".");
}

/** What the token endpoint returns and what the library stores. Valid for an hour from now. */
export function fakeSession(email: string | null = "meena@example.com", validForSeconds = 3600) {
  const expiresAt = Math.floor(Date.now() / 1000) + validForSeconds;
  return {
    access_token: fakeToken(expiresAt),
    token_type: "bearer",
    expires_in: validForSeconds,
    expires_at: expiresAt,
    refresh_token: "made-up-refresh-token",
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email,
      app_metadata: { provider: "google" },
      user_metadata: {},
      created_at: "2026-10-11T00:00:00Z",
    },
  };
}

/**
 * Makes the phone look signed in before any page script runs. Written once per tab (a sign-out in the
 * test must stay a sign-out after the next page load).
 */
export async function seedSession(page: Page | BrowserContext, session: unknown = fakeSession()): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (window.sessionStorage.getItem("e2e-seeded") === "1") return;
      window.sessionStorage.setItem("e2e-seeded", "1");
      window.localStorage.setItem(key, value);
    },
    [SESSION_KEY, JSON.stringify(session)],
  );
}

export type Logged = { method: string; path: string; query: string; headers: Record<string, string>; body: string | null };

export type Stub = {
  /** Every request that reached the fake host, in order. */
  log: Logged[];
  /** The tutor's row. Null means there is none. Change it between steps. */
  tutor: FakeTutor | null;
  /** Answer reads and writes of the tutor's row by dropping the connection, as a dead network does. */
  networkDown: boolean;
  /** Answer writes of the tutor's row with a server error. */
  refuseWrites: boolean;
  /** Answer the token endpoint with a refusal, as for a used code. */
  refuseToken: boolean;
  /** Answer the token endpoint by dropping the connection, as a dead network does (a refresh that cannot be tried). */
  tokenDown: boolean;
  /** Hold the token endpoint's answer back this many milliseconds, so a spec can look at the page in between. */
  tokenDelayMs: number;
  /** Answer reads of the tutor's row with this status and a PostgREST-shaped error (401: the server refuses the session; 503: it is down). Null answers normally. */
  tutorReadStatus: number | null;
  /** Hold the tutor's row back this many milliseconds (the loading state). */
  tutorDelayMs: number;
  /** Answer the logout call by dropping the connection, as a dead network does. */
  logoutFails: boolean;
  /** The authorize requests (the page is then answered with a plain page, never Google). */
  authorize: URL[];
  /** The bodies of every PATCH to the tutor's row. */
  patches: Record<string, unknown>[];
  /** Requests that matched nothing we answer (a surprise in a test). */
  unknown: Logged[];
  /** Requests of one kind. */
  where(predicate: (request: Logged) => boolean): Logged[];
};

function cors(request: Request): Record<string, string> {
  const headers = request.headers();
  return {
    "access-control-allow-origin": headers["origin"] ?? "*",
    "access-control-allow-headers": headers["access-control-request-headers"] ?? "*",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-expose-headers": "*",
    vary: "origin",
  };
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    body: JSON.stringify(body),
    headers: { ...cors(route.request()), "content-type": "application/json" },
  });
}

/**
 * Answers every request to the fake Supabase host: the Google start (recorded, then a plain page), the
 * code exchange and refresh (a made-up session), logout, and the tutor's row (read and update). Returns
 * a handle the spec can read and change.
 */
export async function stubSupabase(page: Page | BrowserContext, initial: { tutor?: FakeTutor | null } = {}): Promise<Stub> {
  const stub: Stub = {
    log: [],
    tutor: initial.tutor === undefined ? newTutor() : initial.tutor,
    networkDown: false,
    refuseWrites: false,
    refuseToken: false,
    tokenDown: false,
    tokenDelayMs: 0,
    tutorReadStatus: null,
    tutorDelayMs: 0,
    logoutFails: false,
    authorize: [],
    patches: [],
    unknown: [],
    where: (predicate) => stub.log.filter(predicate),
  };

  await page.route(`${HOST}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const logged: Logged = {
      method: request.method(),
      path: url.pathname,
      query: url.search,
      headers: request.headers(),
      body: request.postData(),
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors(request) });
      return;
    }
    stub.log.push(logged);

    if (url.pathname === "/auth/v1/authorize") {
      stub.authorize.push(url);
      await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>stub</title><p>The Google sign-in page is not opened in tests.</p>" });
      return;
    }
    if (url.pathname === "/auth/v1/token") {
      if (stub.tokenDown) {
        await route.abort("failed");
        return;
      }
      if (stub.tokenDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, stub.tokenDelayMs));
      if (stub.refuseToken) {
        await json(route, 400, { error: "invalid_grant", error_description: "invalid flow state, no valid flow state found" });
        return;
      }
      await json(route, 200, fakeSession(stub.tutor?.email ?? "meena@example.com"));
      return;
    }
    if (url.pathname === "/auth/v1/logout") {
      if (stub.logoutFails) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({ status: 204, headers: cors(request) });
      return;
    }
    if (url.pathname === "/rest/v1/tutors") {
      if (stub.networkDown) {
        await route.abort("failed");
        return;
      }
      if (stub.tutorDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, stub.tutorDelayMs));
      if (stub.tutorReadStatus !== null && request.method() === "GET") {
        const refused = stub.tutorReadStatus === 401 || stub.tutorReadStatus === 403;
        await json(route, stub.tutorReadStatus, refused ? { code: "PGRST301", message: "JWT expired" } : { message: "made-up server error" });
        return;
      }
      const wantsObject = (request.headers()["accept"] ?? "").includes("vnd.pgrst.object");
      if (request.method() === "GET") {
        if (stub.tutor) await json(route, 200, wantsObject ? stub.tutor : [stub.tutor]);
        else if (wantsObject) await json(route, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 0 rows" });
        else await json(route, 200, []);
        return;
      }
      if (request.method() === "PATCH") {
        const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
        stub.patches.push(body);
        if (stub.refuseWrites) {
          await json(route, 500, { code: "XX000", message: "made-up server error" });
          return;
        }
        if (!stub.tutor) {
          await json(route, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 0 rows" });
          return;
        }
        stub.tutor = { ...stub.tutor, ...body } as FakeTutor;
        await json(route, 200, wantsObject ? stub.tutor : [stub.tutor]);
        return;
      }
    }
    // The students and batches tables: a signed-in tutor with nothing in them, unless a spec registers
    // `stubRoster` (roster-helpers.ts), whose route is tried first.
    if ((url.pathname === "/rest/v1/students" || url.pathname === "/rest/v1/batches") && request.method() === "GET") {
      if (stub.networkDown) {
        await route.abort("failed");
        return;
      }
      await json(route, 200, []);
      return;
    }
    // The dues board (R1-6): no fees, and nothing to make, unless a spec registers `stubDues` (dues-helpers.ts).
    if (url.pathname === "/rest/v1/dues" && request.method() === "GET") {
      if (stub.networkDown) {
        await route.abort("failed");
        return;
      }
      await json(route, 200, []);
      return;
    }
    if (url.pathname === "/rest/v1/rpc/ensure_my_dues" && request.method() === "POST") {
      await json(route, 200, 0);
      return;
    }
    // Parents' claims (R1-10): none, unless a spec registers `stubClaims` (claims-helpers.ts). The chip on Home asks for a count.
    if (url.pathname === "/rest/v1/payment_claims" && (request.method() === "GET" || request.method() === "HEAD")) {
      if (stub.networkDown) {
        await route.abort("failed");
        return;
      }
      if (request.method() === "HEAD") await route.fulfill({ status: 200, headers: { ...cors(request), "content-range": "*/0" } });
      else await json(route, 200, []);
      return;
    }
    stub.unknown.push(logged);
    await json(route, 404, { message: "nothing is stubbed at this address" });
  });
  return stub;
}

/** The hosts a page talks to other than its own and the fake Supabase host. Should stay empty (criterion 49). */
export function watchOtherHosts(page: Page, ownOrigin: string): string[] {
  const others: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin === ownOrigin || url.origin === HOST) return;
    others.push(request.url());
  });
  return others;
}

/** What the library keeps while a Google sign-in is under way: the PKCE verifier, under the session key plus this. */
export const VERIFIER_KEY = `${SESSION_KEY}-code-verifier`;

/** Makes the phone look as it does when it comes back from Google: a verifier is in storage. Once per tab. */
export async function seedVerifier(page: Page | BrowserContext): Promise<void> {
  await page.addInitScript(
    ([key]) => {
      if (window.sessionStorage.getItem("e2e-verifier") === "1") return;
      window.sessionStorage.setItem("e2e-verifier", "1");
      // The library writes every stored value as JSON, and treats anything else as corrupt.
      window.localStorage.setItem(key, JSON.stringify("made-up-code-verifier-made-up-code-verifier-0000"));
    },
    [VERIFIER_KEY],
  );
}
