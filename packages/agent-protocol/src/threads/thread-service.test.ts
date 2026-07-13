import { describe, expect, it } from "vitest";

import { createFixtureDeps } from "../__fixtures__/deps.js";
import { createContext } from "../context.js";
import { buildProtocolService } from "../service.js";

async function serviceWithAssistants(deps = createFixtureDeps()) {
  const service = buildProtocolService(createContext(deps));
  await service.assistants.registerGraphAssistants();
  return service;
}

describe("thread service", () => {
  it("creates, reads, lists, and patches metadata", async () => {
    const service = await serviceWithAssistants();
    const created = await service.threads.create({ metadata: { a: 1 } });

    expect((await service.threads.get(created.thread_id)).thread_id).toBe(created.thread_id);
    expect((await service.threads.list()).length).toBe(1);

    const patched = await service.threads.patch(created.thread_id, { metadata: { a: 2 } });
    expect(patched.metadata).toMatchObject({ a: 2 });
  });

  it("404s an unknown thread on get and patch", async () => {
    const service = await serviceWithAssistants();
    await expect(service.threads.get("ghost")).rejects.toMatchObject({ status: 404 });
    await expect(service.threads.patch("ghost", { metadata: {} })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("deletes a thread and cascades its runs", async () => {
    const deps = createFixtureDeps();
    const service = await serviceWithAssistants(deps);
    const thread = await service.threads.create();
    const run = await service.runs.createBackground(thread.thread_id, {
      assistant_id: "echo",
      input: {},
    });

    await service.threads.delete(thread.thread_id);
    expect(await service.threads.get(thread.thread_id).catch((e) => e.status)).toBe(404);
    expect(await deps.store.runs.get(run.run_id)).toBeNull();
  });

  it("returns state history after a run", async () => {
    const service = await serviceWithAssistants();
    const thread = await service.threads.create();
    await service.runs.createWait({
      thread_id: thread.thread_id,
      assistant_id: "echo",
      input: { value: "hi" },
    });

    const history = await service.threads.history(thread.thread_id);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]?.values).toEqual({ value: "echo: hi" });
  });
});
