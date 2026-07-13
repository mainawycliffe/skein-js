// `SkeinStore` — the durable home for Agent Protocol *resources* (assistants, threads, runs,
// long-term store items). This is deliberately NOT LangGraph's checkpointer: graph state and
// history stay 100% LangGraph-native via a `BaseCheckpointSaver`. SkeinStore owns only the
// resource rows that OSS keeps in memory (see docs/storage.md).
//
// Every driver (memory, postgres, …) implements this one interface and is held to the shared
// conformance suite, so they behave identically. Methods return the wire types from
// `../wire`, so a handler can pass a repo result straight to the client.

import type {
  Assistant,
  Config,
  DefaultValues,
  Interrupt,
  Item,
  Metadata,
  MultitaskStrategy,
  Run,
  RunStatus,
  SearchItem,
  StreamMode,
  Thread,
  ThreadStatus,
} from "../wire/wire.js";

// --- assistants ---------------------------------------------------------------------------

/** Fields accepted when registering an assistant (from a langgraph.json graph or the API). */
export interface AssistantCreate {
  graph_id: string;
  /** Server-assigned when omitted. */
  assistant_id?: string;
  name?: string;
  description?: string;
  config?: Config;
  context?: unknown;
  metadata?: Metadata;
}

export interface AssistantRepo {
  list(): Promise<Assistant[]>;
  get(assistantId: string): Promise<Assistant | null>;
  /** Create (or, for a graph-derived assistant, register) an assistant. */
  create(input: AssistantCreate): Promise<Assistant>;
  delete(assistantId: string): Promise<void>;
}

// --- threads ------------------------------------------------------------------------------

export interface ThreadCreate {
  /** Server-assigned when omitted. */
  thread_id?: string;
  metadata?: Metadata;
  status?: ThreadStatus;
}

/** Partial update; omitted fields are left unchanged. */
export interface ThreadUpdate {
  metadata?: Metadata;
  status?: ThreadStatus;
  /** Latest graph state values mirrored onto the thread row. */
  values?: DefaultValues;
  /** Pending human-in-the-loop interrupts, mirrored from the graph state onto the thread row. */
  interrupts?: Record<string, Interrupt[]>;
}

export interface ThreadRepo {
  list(): Promise<Thread[]>;
  get(threadId: string): Promise<Thread | null>;
  create(input?: ThreadCreate): Promise<Thread>;
  update(threadId: string, patch: ThreadUpdate): Promise<Thread>;
  delete(threadId: string): Promise<void>;
}

// --- runs ---------------------------------------------------------------------------------

/**
 * The execution payload of a run — everything the run engine needs to (re)start a graph. Stored
 * *opaquely* alongside the run (it is NOT part of the wire {@link Run}), so a background run picked
 * up later, or a run reclaimed after a crash, can be reconstructed from just its `run_id`.
 */
export interface RunKwargs {
  /** Graph input for a fresh turn. Absent when the run is a resume (see {@link command}). */
  input?: unknown;
  /** A LangGraph command (e.g. `{ resume }`) — present when resuming an interrupted thread. */
  command?: { resume?: unknown; update?: unknown; goto?: unknown };
  config?: Config;
  context?: unknown;
  /** Requested stream modes; the engine normalizes these to graph modes. */
  stream_mode?: StreamMode | StreamMode[];
  interrupt_before?: string[] | "*";
  interrupt_after?: string[] | "*";
}

export interface RunCreate {
  thread_id: string;
  assistant_id: string;
  /** Server-assigned when omitted. */
  run_id?: string;
  /** Defaults to `"pending"`. */
  status?: RunStatus;
  metadata?: Metadata;
  multitask_strategy?: MultitaskStrategy | null;
  /** Execution payload, stored opaquely for the run engine (see {@link RunKwargs}). */
  kwargs?: RunKwargs;
}

export interface RunRepo {
  get(runId: string): Promise<Run | null>;
  listByThread(threadId: string): Promise<Run[]>;
  create(input: RunCreate): Promise<Run>;
  setStatus(runId: string, status: RunStatus): Promise<Run>;
  delete(runId: string): Promise<void>;
  /** The opaque execution payload stored with a run, or null if the run is unknown. */
  getKwargs(runId: string): Promise<RunKwargs | null>;
  /**
   * The protocol concurrency guard: true while the thread has an *inflight* run — one still
   * `pending` or `running` (i.e. non-terminal per {@link isTerminalRunStatus}). An `interrupted`
   * run is terminal and does NOT count: it has yielded the thread to a human, and a resume arrives
   * as a fresh run. The run engine uses this to reject/queue concurrent runs.
   */
  hasActiveRun(threadId: string): Promise<boolean>;
}

/**
 * Run statuses from which a run never transitions again. `"interrupted"` is terminal: resuming an
 * interrupt starts a *new* run on the same thread (this matches `@langchain/langgraph-api`, whose
 * inflight check is `pending | running` only — so an interrupted run never blocks the resume).
 */
export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = [
  "success",
  "error",
  "timeout",
  "interrupted",
];

/** True if `status` is terminal (the run is finished and no longer holds its thread). */
export function isTerminalRunStatus(status: RunStatus): boolean {
  return TERMINAL_RUN_STATUSES.includes(status);
}

// --- store (long-term memory) -------------------------------------------------------------

export interface StoreSearchQuery {
  /** Restrict to items under this namespace prefix. */
  prefix?: string[];
  /** Natural-language query for semantic search (naive scan in the memory driver). */
  query?: string;
  limit?: number;
  offset?: number;
}

export interface StoreRepo {
  get(namespace: string[], key: string): Promise<Item | null>;
  put(namespace: string[], key: string, value: Record<string, unknown>): Promise<Item>;
  delete(namespace: string[], key: string): Promise<void>;
  search(query: StoreSearchQuery): Promise<SearchItem[]>;
  listNamespaces(prefix?: string[]): Promise<string[][]>;
}

// --- the store ----------------------------------------------------------------------------

/** The single persistence seam for Agent Protocol resources. One implementation per driver. */
export interface SkeinStore {
  assistants: AssistantRepo;
  threads: ThreadRepo;
  runs: RunRepo;
  store: StoreRepo;
}
