// The shared internal state the run-facing services and the background worker must agree on: the
// resolved deps, the per-run cancellation registry (so a cancel can abort a run executing anywhere
// in the same process — inline or on the worker), and the per-thread lock for the concurrency
// guard. Built once and threaded through, so there is exactly one of each per runtime.

import { resolveDeps, type ProtocolDeps, type ResolvedDeps } from "./deps.js";
import { RunControlRegistry } from "./runs/cancellation.js";
import { ThreadLocks } from "./runs/thread-locks.js";

export interface ProtocolContext {
  deps: ResolvedDeps;
  control: RunControlRegistry;
  locks: ThreadLocks;
}

export function createContext(deps: ProtocolDeps): ProtocolContext {
  return {
    deps: resolveDeps(deps),
    control: new RunControlRegistry(),
    locks: new ThreadLocks(),
  };
}
