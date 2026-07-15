// The in-memory SkeinStore: plain Maps, zero external services — what `skein dev` runs on and
// what the shared conformance suite is first proven against. It holds only Agent Protocol
// *resources* (assistants/threads/runs/store items); graph checkpoints are LangGraph's, via a
// MemorySaver, not this. Every read/write deep-clones at the boundary (like a real serializing
// driver), so callers can neither mutate stored rows through a returned object nor corrupt the
// store by mutating an input they still hold.

import { randomUUID } from "node:crypto";

import {
  isMetadataSubset,
  isTerminalRunStatus,
  SkeinHttpError,
  type Assistant,
  type AssistantCreate,
  type AssistantRepo,
  type Item,
  type Run,
  type RunCreate,
  type RunKwargs,
  type RunRepo,
  type RunStatus,
  type SearchItem,
  type SkeinStore,
  type SkeinStoreSnapshot,
  type StorePutOptions,
  type StoreRepo,
  type StoreSearchQuery,
  type StoreTtlConfig,
  type Thread,
  type ThreadCreate,
  type ThreadRepo,
  type ThreadSearchQuery,
  type ThreadUpdate,
} from "@skein-js/core";

const nowIso = (): string => new Date().toISOString();

/** Deep copy at the persistence boundary — mirrors what a serializing driver (Postgres) does. */
const clone = <T>(value: T): T => structuredClone(value);

/** Read one row by id, deep-cloned so the caller can't mutate what's stored. */
function readOne<T>(map: Map<string, T>, id: string): T | null {
  const found = map.get(id);
  return found ? clone(found) : null;
}

/** Read every row, each deep-cloned. */
function readAll<T>(map: Map<string, T>): T[] {
  return [...map.values()].map((row) => clone(row));
}

/** Store a row (deep-cloned in, so later caller mutation can't reach it) and return a fresh copy. */
function write<T>(map: Map<string, T>, id: string, row: T): T {
  const stored = clone(row);
  map.set(id, stored);
  return clone(stored);
}

/** True if `namespace` starts with every segment of `prefix` (empty/absent prefix matches all). */
function hasPrefix(namespace: string[], prefix?: string[]): boolean {
  if (!prefix || prefix.length === 0) return true;
  if (prefix.length > namespace.length) return false;
  return prefix.every((segment, i) => namespace[i] === segment);
}

/** Serialize a (namespace, key) pair to a collision-free Map key. */
function itemKey(namespace: string[], key: string): string {
  return JSON.stringify([namespace, key]);
}

/** In-process SkeinStore for development and tests. */
export class MemorySkeinStore implements SkeinStore {
  readonly #assistants = new Map<string, Assistant>();
  readonly #threads = new Map<string, Thread>();
  readonly #runs = new Map<string, Run>();
  // The opaque execution payload lives beside the run row (it is not part of the wire `Run`).
  readonly #runKwargs = new Map<string, RunKwargs>();
  readonly #items = new Map<string, Item>();
  // Item expiry lives beside the item (never on the wire `Item`), keyed the same way as #items:
  // `expiresAt` is epoch-ms (null = never expires), `ttlMinutes` is what a refresh-on-read extends by.
  readonly #itemExpiry = new Map<string, { expiresAt: number | null; ttlMinutes: number | null }>();
  readonly #ttl?: StoreTtlConfig;

  constructor(options?: { ttl?: StoreTtlConfig }) {
    this.#ttl = options?.ttl;
  }

  /** Record (or clear) an item's expiry from a resolved per-item TTL in minutes. */
  #setExpiry(id: string, ttlMinutes: number | null): void {
    if (ttlMinutes === null || ttlMinutes === undefined) {
      this.#itemExpiry.delete(id);
      return;
    }
    this.#itemExpiry.set(id, { expiresAt: Date.now() + ttlMinutes * 60_000, ttlMinutes });
  }

  /** True if the item has expired and should read as absent. */
  #isExpired(id: string): boolean {
    const entry = this.#itemExpiry.get(id);
    return entry?.expiresAt != null && entry.expiresAt <= Date.now();
  }

  /**
   * Extend a live item's expiry on read when TTL is configured and `refresh_on_read` isn't disabled
   * (it defaults on). With no configured TTL we never refresh, matching the Postgres driver.
   */
  #maybeRefresh(id: string): void {
    if (this.#ttl === undefined || this.#ttl.refreshOnRead === false) return;
    const entry = this.#itemExpiry.get(id);
    if (entry?.ttlMinutes != null) {
      this.#itemExpiry.set(id, { ...entry, expiresAt: Date.now() + entry.ttlMinutes * 60_000 });
    }
  }

  readonly assistants: AssistantRepo = {
    list: async () => readAll(this.#assistants),
    get: async (assistantId) => readOne(this.#assistants, assistantId),
    create: async (input: AssistantCreate) => {
      const at = nowIso();
      const assistant: Assistant = {
        assistant_id: input.assistant_id ?? randomUUID(),
        graph_id: input.graph_id,
        config: input.config ?? {},
        context: input.context ?? {},
        created_at: at,
        updated_at: at,
        metadata: input.metadata ?? {},
        version: 1,
        name: input.name ?? input.graph_id,
        description: input.description,
      };
      return write(this.#assistants, assistant.assistant_id, assistant);
    },
    delete: async (assistantId) => {
      this.#assistants.delete(assistantId);
    },
  };

  readonly threads: ThreadRepo = {
    list: async () => readAll(this.#threads),
    search: async (query: ThreadSearchQuery) => {
      const matched = readAll(this.#threads).filter(
        (thread) =>
          (!query.ids || query.ids.includes(thread.thread_id)) &&
          (!query.status || thread.status === query.status) &&
          isMetadataSubset(thread.metadata, query.metadata) &&
          isMetadataSubset(thread.values, query.values),
      );
      const sortBy = query.sortBy ?? "created_at";
      const direction = query.sortOrder === "asc" ? 1 : -1;
      const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
      matched.sort((a, b) => {
        const primary = compare(String(a[sortBy] ?? ""), String(b[sortBy] ?? ""));
        // Break ties on thread_id in the same direction, so paging is deterministic and matches the
        // Postgres driver's `ORDER BY <sortBy> <dir>, thread_id <dir>`.
        const ordered = primary !== 0 ? primary : compare(a.thread_id, b.thread_id);
        return direction * ordered;
      });
      const offset = query.offset ?? 0;
      const limit = query.limit ?? matched.length;
      return matched.slice(offset, offset + limit);
    },
    get: async (threadId) => readOne(this.#threads, threadId),
    create: async (input?: ThreadCreate) => {
      const at = nowIso();
      const thread: Thread = {
        thread_id: input?.thread_id ?? randomUUID(),
        created_at: at,
        updated_at: at,
        state_updated_at: at,
        metadata: input?.metadata ?? {},
        status: input?.status ?? "idle",
        values: {} as Record<string, unknown>,
        interrupts: {},
      };
      return write(this.#threads, thread.thread_id, thread);
    },
    update: async (threadId, patch: ThreadUpdate) => {
      const existing = this.#threads.get(threadId);
      if (!existing) throw SkeinHttpError.notFound(`Thread "${threadId}" not found.`);
      const at = nowIso();
      const updated: Thread = {
        ...existing,
        metadata: patch.metadata ?? existing.metadata,
        status: patch.status ?? existing.status,
        values: patch.values ?? existing.values,
        interrupts: patch.interrupts ?? existing.interrupts,
        updated_at: at,
        state_updated_at: patch.values !== undefined ? at : existing.state_updated_at,
      };
      return write(this.#threads, threadId, updated);
    },
    copy: async (threadId) => {
      const existing = this.#threads.get(threadId);
      if (!existing) throw SkeinHttpError.notFound(`Thread "${threadId}" not found.`);
      const at = nowIso();
      const copy: Thread = {
        ...clone(existing),
        thread_id: randomUUID(),
        created_at: at,
        updated_at: at,
        state_updated_at: at,
      };
      return write(this.#threads, copy.thread_id, copy);
    },
    delete: async (threadId) => {
      this.#threads.delete(threadId);
      // Cascade: a deleted thread's runs (and their kwargs) go with it.
      for (const [runId, run] of this.#runs) {
        if (run.thread_id === threadId) {
          this.#runs.delete(runId);
          this.#runKwargs.delete(runId);
        }
      }
    },
  };

  readonly runs: RunRepo = {
    get: async (runId) => readOne(this.#runs, runId),
    listByThread: async (threadId) =>
      readAll(this.#runs).filter((run) => run.thread_id === threadId),
    create: async (input: RunCreate) => {
      const at = nowIso();
      const run: Run = {
        run_id: input.run_id ?? randomUUID(),
        thread_id: input.thread_id,
        assistant_id: input.assistant_id,
        created_at: at,
        updated_at: at,
        status: input.status ?? "pending",
        metadata: input.metadata ?? {},
        multitask_strategy: input.multitask_strategy ?? null,
      };
      const stored = write(this.#runs, run.run_id, run);
      if (input.kwargs) this.#runKwargs.set(run.run_id, clone(input.kwargs));
      return stored;
    },
    setStatus: async (runId, status: RunStatus) => {
      const existing = this.#runs.get(runId);
      if (!existing) throw SkeinHttpError.notFound(`Run "${runId}" not found.`);
      return write(this.#runs, runId, { ...existing, status, updated_at: nowIso() });
    },
    delete: async (runId) => {
      this.#runs.delete(runId);
      this.#runKwargs.delete(runId);
    },
    getKwargs: async (runId) => {
      const found = this.#runKwargs.get(runId);
      return found ? clone(found) : null;
    },
    hasActiveRun: async (threadId) => {
      for (const run of this.#runs.values()) {
        if (run.thread_id === threadId && !isTerminalRunStatus(run.status)) return true;
      }
      return false;
    },
  };

  readonly store: StoreRepo = {
    get: async (namespace, key) => {
      const id = itemKey(namespace, key);
      const found = this.#items.get(id);
      if (!found) return null;
      // Lazy expiry: an expired item reads as absent even before the sweeper deletes it.
      if (this.#isExpired(id)) {
        this.#items.delete(id);
        this.#itemExpiry.delete(id);
        return null;
      }
      this.#maybeRefresh(id);
      return clone(found);
    },
    put: async (namespace, key, value, options?: StorePutOptions) => {
      const id = itemKey(namespace, key);
      const at = nowIso();
      const existing = this.#items.get(id);
      const item: Item = {
        namespace: [...namespace],
        key,
        value,
        createdAt: existing?.createdAt ?? at,
        updatedAt: at,
      };
      const stored = clone(item);
      this.#items.set(id, stored);
      // A per-put ttl wins; otherwise the configured default (null = never expires).
      this.#setExpiry(id, options?.ttl ?? this.#ttl?.defaultTtl ?? null);
      return clone(stored);
    },
    delete: async (namespace, key) => {
      const id = itemKey(namespace, key);
      this.#items.delete(id);
      this.#itemExpiry.delete(id);
    },
    search: async (query: StoreSearchQuery) => {
      const needle = query.query?.toLowerCase();
      const matches: SearchItem[] = [...this.#items.entries()]
        .filter(([id]) => !this.#isExpired(id))
        .map(([, item]) => item)
        .filter((item) => hasPrefix(item.namespace, query.prefix))
        .filter((item) =>
          needle ? JSON.stringify(item.value).toLowerCase().includes(needle) : true,
        )
        .map((item) => {
          const result: SearchItem = clone(item);
          // Naive relevance: any query is an exact-substring hit, so score 1 (pgvector does the
          // real semantic ranking in the Postgres driver).
          if (needle) result.score = 1;
          return result;
        });

      const offset = query.offset ?? 0;
      return matches.slice(offset, query.limit === undefined ? undefined : offset + query.limit);
    },
    listNamespaces: async (prefix) => {
      // Key by JSON.stringify (not join) so distinct namespaces whose segments contain the
      // separator can't collide.
      const seen = new Map<string, string[]>();
      for (const [id, item] of this.#items.entries()) {
        if (this.#isExpired(id)) continue;
        if (hasPrefix(item.namespace, prefix)) {
          seen.set(JSON.stringify(item.namespace), item.namespace);
        }
      }
      return [...seen.values()].map((namespace) => [...namespace]);
    },
    sweepExpired: async () => {
      let removed = 0;
      for (const id of [...this.#itemExpiry.keys()]) {
        if (this.#isExpired(id)) {
          this.#items.delete(id);
          this.#itemExpiry.delete(id);
          removed += 1;
        }
      }
      return removed;
    },
  };

  /**
   * A JSON-serializable copy of every row, so `skein dev` can persist dev state to disk and
   * restore it on the next boot. Rows are deep-cloned at the boundary, exactly like the repo reads.
   */
  snapshot(): MemoryStoreSnapshot {
    const entries = <T>(map: Map<string, T>): [string, T][] =>
      [...map.entries()].map(([id, row]) => [id, clone(row)]);
    return {
      assistants: entries(this.#assistants),
      threads: entries(this.#threads),
      runs: entries(this.#runs),
      runKwargs: entries(this.#runKwargs),
      items: entries(this.#items),
    };
  }

  /** Replace all rows with a {@link snapshot}. Used by `skein dev` to restore persisted dev state. */
  hydrate(snapshot: MemoryStoreSnapshot): void {
    const fill = <T>(map: Map<string, T>, rows: [string, T][]): void => {
      map.clear();
      for (const [id, row] of rows) map.set(id, clone(row));
    };
    fill(this.#assistants, snapshot.assistants);
    fill(this.#threads, snapshot.threads);
    fill(this.#runs, snapshot.runs);
    fill(this.#runKwargs, snapshot.runKwargs);
    fill(this.#items, snapshot.items);
    // Item expiry is not persisted; a restored item won't expire until it is written again.
    this.#itemExpiry.clear();
  }

  /**
   * Bulk-load rows from a snapshot, preserving ids + timestamps and *without* clearing what's
   * already here: existing ids are left untouched (insert-if-absent). Unlike {@link hydrate} (a
   * full replace for cross-restart persistence), this is the additive, lossless sink used by
   * migration tooling — see `@skein-js/express`'s LangGraph importer. `loadSnapshotIntoStore`
   * feature-detects this method, so the memory and Postgres drivers import identically.
   */
  async restore(snapshot: SkeinStoreSnapshot): Promise<void> {
    const add = <T>(map: Map<string, T>, rows: [string, T][]): void => {
      for (const [id, row] of rows) if (!map.has(id)) map.set(id, clone(row));
    };
    add(this.#assistants, snapshot.assistants);
    add(this.#threads, snapshot.threads);
    add(this.#runs, snapshot.runs);
    add(this.#runKwargs, snapshot.runKwargs);
    add(this.#items, snapshot.items);
  }
}

/**
 * A JSON-serializable copy of a {@link MemorySkeinStore}'s rows. An alias of the driver-agnostic
 * {@link SkeinStoreSnapshot} (identical shape); the name predates the shared type and is kept so
 * the dev-persistence snapshot format reads the same.
 */
export type MemoryStoreSnapshot = SkeinStoreSnapshot;
