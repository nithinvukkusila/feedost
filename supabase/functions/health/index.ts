import { handle } from "./handler.ts";

Deno.serve((req) => handle(req, Deno.env.get("APP_ENV")));
