// The whole behaviour of the health function, as a pure function so Node can test it.
// It reads no data and holds no keys. It answers one word: which environment this project is.
const ENVS = ["local", "staging", "production"];

const CORS = { "Access-Control-Allow-Origin": "*" };

function json(status: number, body: string, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS, ...extra },
  });
}

export function handle(req: Request, appEnv: string | undefined): Response {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "apikey, authorization, content-type",
      },
    });
  }
  if (req.method !== "GET") return json(405, '{"ok":false}', { Allow: "GET, OPTIONS" });
  // An unset or unknown value must fail the smoke check, never pass as "local".
  if (appEnv === undefined || !ENVS.includes(appEnv)) return json(500, '{"ok":false}');
  return json(200, `{"ok":true,"env":"${appEnv}"}`);
}
