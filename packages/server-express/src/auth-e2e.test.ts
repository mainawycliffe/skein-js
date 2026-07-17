// End-to-end proof that auth rides entirely inside the transport-neutral handler table: the Express
// adapter is unchanged beyond passing headers/method/url through, yet an injected engine gates real
// HTTP — 401 without a key, ownership-scoped 404 across users — reading the key from a real request
// header the way a client (e.g. `useStream({ apiKey })`) sends it.

import { SkeinHttpError, type AuthEngine } from "@skein-js/core";
import { afterEach, describe, expect, it } from "vitest";

import { startEchoServer, type RunningServer } from "./__fixtures__/echo-server.js";

const jsonHeaders = { "content-type": "application/json" };

/** Reads the caller from the `x-api-key` header and scopes every resource by `owner`. */
function apiKeyEngine(): AuthEngine {
  return {
    enabled: true,
    studioAuthDisabled: true,
    authenticate: async (request) => {
      const key = request.headers.get("x-api-key");
      if (!key) throw SkeinHttpError.unauthorized("missing x-api-key");
      return {
        user: { identity: key, display_name: key, is_authenticated: true, permissions: [] },
        scopes: [],
      };
    },
    authorize: async ({ value, context }) =>
      context
        ? { filters: { owner: context.user.identity }, value }
        : { filters: undefined, value },
    matchesFilters: (metadata, filters) =>
      !filters ||
      Object.entries(filters).every(([key, clause]) =>
        typeof clause === "string" ? metadata?.[key] === clause : metadata?.[key] === clause.$eq,
      ),
  };
}

describe("@skein-js/express auth", () => {
  let running: RunningServer | undefined;

  afterEach(async () => {
    await running?.close();
    running = undefined;
  });

  it("rejects a request with no credentials as 401", async () => {
    running = await startEchoServer({ auth: apiKeyEngine() });
    const res = await fetch(`${running.baseUrl}/threads`, {
      method: "POST",
      headers: jsonHeaders,
      body: "{}",
    });
    expect(res.status).toBe(401);
  });

  it("isolates threads per API key end-to-end", async () => {
    running = await startEchoServer({ auth: apiKeyEngine() });
    const { baseUrl } = running;

    const created = await fetch(`${baseUrl}/threads`, {
      method: "POST",
      headers: { ...jsonHeaders, "x-api-key": "alice" },
      body: "{}",
    });
    expect(created.status).toBe(200);
    const thread = (await created.json()) as {
      thread_id: string;
      metadata: Record<string, unknown>;
    };
    expect(thread.metadata.owner).toBe("alice");

    // Bob cannot see Alice's thread.
    const bobGet = await fetch(`${baseUrl}/threads/${thread.thread_id}`, {
      headers: { "x-api-key": "bob" },
    });
    expect(bobGet.status).toBe(404);

    // Alice can.
    const aliceGet = await fetch(`${baseUrl}/threads/${thread.thread_id}`, {
      headers: { "x-api-key": "alice" },
    });
    expect(aliceGet.status).toBe(200);
  });

  it("does not let a run hijack another user's thread via its thread_id", async () => {
    running = await startEchoServer({ auth: apiKeyEngine() });
    const { baseUrl } = running;

    const alice = (await (
      await fetch(`${baseUrl}/threads`, {
        method: "POST",
        headers: { ...jsonHeaders, "x-api-key": "alice" },
        body: "{}",
      })
    ).json()) as { thread_id: string };

    // Bob runs against Alice's thread id — must 404 (the scoped store hides it), never recreate it.
    const hijack = await fetch(`${baseUrl}/threads/${alice.thread_id}/runs/wait`, {
      method: "POST",
      headers: { ...jsonHeaders, "x-api-key": "bob" },
      body: JSON.stringify({ assistant_id: "echo", input: { messages: [] } }),
    });
    expect(hijack.status).toBe(404);

    // Alice's thread is untouched and still hers.
    const after = (await (
      await fetch(`${baseUrl}/threads/${alice.thread_id}`, { headers: { "x-api-key": "alice" } })
    ).json()) as { metadata: Record<string, unknown> };
    expect(after.metadata.owner).toBe("alice");
  });
});
