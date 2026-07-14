// Custom auth for the example server, authored against `@langchain/langgraph-sdk`'s `Auth` — the
// exact API LangGraph Platform uses, so this file is drop-in. skein loads it from `langgraph.json`'s
// `auth.path` and applies it to every request across the whole Agent Protocol surface.
//
// It is deliberately frictionless by default: with no `SKEIN_API_KEY` set, the server stays open and
// every caller is the same `demo-user`, so `skein dev` and the tests need no setup. Set
// `SKEIN_API_KEY` to require an `X-Api-Key` header (the browser sends it via `useStream({ apiKey })`)
// and real 401s switch on. Either way, `@auth.on("threads")` returns an ownership filter, so a caller
// only ever sees and mutates their own threads and runs — exactly as on LangGraph Platform.

import { Auth, HTTPException } from "@langchain/langgraph-sdk/auth";

/** Set this to require an API key; leave unset for an open local demo. */
const REQUIRED_API_KEY = process.env["SKEIN_API_KEY"];

export const auth = new Auth()
  .authenticate(async (request) => {
    if (REQUIRED_API_KEY) {
      const provided = request.headers.get("x-api-key");
      if (provided !== REQUIRED_API_KEY) {
        throw new HTTPException(401, { message: "Invalid or missing X-Api-Key." });
      }
    }
    // A real app would verify a JWT / session here and derive a per-user identity; the demo uses one
    // user so the memory the research agent stores under `configurable.user_id` still lines up.
    return { identity: "demo-user", permissions: [] };
  })
  // Scope threads (and their runs) to their creator — the returned filter both hides other users'
  // threads on reads and stamps `owner` onto new ones so later reads match.
  .on("threads", ({ user }) => ({ owner: user.identity }));
