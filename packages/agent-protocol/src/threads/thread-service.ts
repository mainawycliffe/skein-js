// Thread CRUD + history. State and history are LangGraph-native (read from the checkpointer via a
// graph bound to the thread's `thread_id`); the thread *row* only carries the mirrored latest
// values/status. Deleting a thread first aborts any run still executing on it, so an in-flight run
// can't write to a thread that's about to disappear.

import {
  isTerminalRunStatus,
  SkeinHttpError,
  type Metadata,
  type Thread,
  type ThreadCreate,
  type ThreadState,
} from "@skein-js/core";

import type { ProtocolContext } from "../context.js";

import { snapshotToThreadState } from "./thread-mirror.js";

export interface CreateThreadInput {
  thread_id?: string;
  metadata?: Metadata;
}

export interface PatchThreadInput {
  metadata?: Metadata;
}

export interface HistoryOptions {
  limit?: number;
}

export interface ThreadService {
  create(input?: CreateThreadInput): Promise<Thread>;
  get(threadId: string): Promise<Thread>;
  list(): Promise<Thread[]>;
  patch(threadId: string, patch: PatchThreadInput): Promise<Thread>;
  delete(threadId: string): Promise<void>;
  history(threadId: string, options?: HistoryOptions): Promise<ThreadState[]>;
  /** The thread's current state snapshot — `GET /threads/{id}/state`, what `useStream` hydrates from. */
  getState(threadId: string): Promise<ThreadState>;
}

/**
 * The state of a thread with no checkpoint yet (created but never run). A fresh object per call —
 * never a shared constant — so a caller mutating the result can't corrupt later reads. The
 * checkpoint carries the real `thread_id` to match what LangGraph returns for an empty thread.
 */
function emptyThreadState(threadId: string): ThreadState {
  return {
    values: {},
    next: [],
    checkpoint: {
      thread_id: threadId,
      checkpoint_ns: "",
      checkpoint_id: undefined,
      checkpoint_map: undefined,
    },
    metadata: {},
    created_at: null,
    parent_checkpoint: null,
    tasks: [],
  };
}

export function createThreadService(ctx: ProtocolContext): ThreadService {
  const { deps, control } = ctx;

  const requireThread = async (threadId: string): Promise<Thread> => {
    const thread = await deps.store.threads.get(threadId);
    if (!thread) throw SkeinHttpError.notFound(`Thread "${threadId}" not found.`);
    return thread;
  };

  // History lives in the checkpointer; read it through the graph of the thread's latest run.
  // `getStateHistory` yields newest-first, so element 0 is the thread's current state.
  const readHistory = async (
    threadId: string,
    options?: HistoryOptions,
  ): Promise<ThreadState[]> => {
    await requireThread(threadId);
    const runs = await deps.store.runs.listByThread(threadId);
    const latest = [...runs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!latest) return [];
    const assistant = await deps.store.assistants.get(latest.assistant_id);
    if (!assistant) return [];

    const resolved = await deps.graphs.load(assistant.graph_id);
    // A factory graph must be built with the run's `configurable` — same as the run engine — so a
    // graph whose shape depends on run config is reconstructed identically for the state read.
    let graph;
    if (typeof resolved === "function") {
      const kwargs = await deps.store.runs.getKwargs(latest.run_id);
      graph = await resolved({ configurable: kwargs?.config?.configurable });
    } else {
      graph = resolved;
    }
    // Attach the checkpointer so history reads this thread's checkpoints (as the engine does).
    (graph as { checkpointer?: unknown }).checkpointer = deps.checkpointer;

    const states: ThreadState[] = [];
    const limit = options?.limit;
    for await (const snapshot of graph.getStateHistory({
      configurable: { thread_id: threadId },
    })) {
      states.push(snapshotToThreadState(snapshot));
      if (limit !== undefined && states.length >= limit) break;
    }
    return states;
  };

  return {
    create: (input) => deps.store.threads.create(input as ThreadCreate | undefined),

    get: requireThread,

    list: () => deps.store.threads.list(),

    async patch(threadId, patch) {
      await requireThread(threadId);
      return deps.store.threads.update(threadId, { metadata: patch.metadata });
    },

    async delete(threadId) {
      await requireThread(threadId);
      // Abort any run still executing on this thread before the rows disappear.
      const runs = await deps.store.runs.listByThread(threadId);
      for (const run of runs) {
        if (!isTerminalRunStatus(run.status)) {
          control.abort(run.run_id, "cancel");
          await deps.bus.close(run.run_id);
        }
      }
      await deps.store.threads.delete(threadId);
    },

    history: readHistory,

    async getState(threadId) {
      const [current] = await readHistory(threadId, { limit: 1 });
      return current ?? emptyThreadState(threadId);
    },
  };
}
