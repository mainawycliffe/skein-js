import { runSkeinStoreConformance } from "@skein-js/test-support";
import { describe, expect, it } from "vitest";

import { MemorySkeinStore } from "./memory-skein-store.js";

// The whole point of the memory driver in this slice: prove it satisfies the shared SkeinStore
// contract. Postgres will run this exact suite later, making the two interchangeable.
runSkeinStoreConformance("memory", () => new MemorySkeinStore());

// TTL config (default_ttl / refresh_on_read) can't be exercised by the config-less conformance
// factory, so cover it here against the memory driver directly. The Postgres equivalents run in the
// Docker integration suite.
describe("memory store TTL config", () => {
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  const tinyTtl = 40 / 60_000; // ~40ms in minutes

  it("applies default_ttl to a put with no explicit ttl", async () => {
    const store = new MemorySkeinStore({ ttl: { defaultTtl: tinyTtl } });
    await store.store.put(["ns"], "k", { v: 1 });

    await wait(120);
    expect(await store.store.get(["ns"], "k")).toBeNull();
  });

  it("refreshes expiry on read by default, and honors refresh_on_read: false", async () => {
    const refreshing = new MemorySkeinStore({ ttl: { defaultTtl: 60 } }); // 1 min, plenty of headroom
    await refreshing.store.put(["ns"], "k", { v: 1 });
    // A read keeps the item alive; it should still be present immediately after.
    expect(await refreshing.store.get(["ns"], "k")).not.toBeNull();

    const noRefresh = new MemorySkeinStore({ ttl: { defaultTtl: tinyTtl, refreshOnRead: false } });
    await noRefresh.store.put(["ns"], "k", { v: 1 });
    await noRefresh.store.get(["ns"], "k"); // must NOT extend the expiry
    await wait(120);
    expect(await noRefresh.store.get(["ns"], "k")).toBeNull();
  });
});
