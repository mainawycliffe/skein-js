// The framework-agnostic service: the whole protocol as typed methods over validated inputs. This
// is the layer to embed directly (no HTTP required). It is assembled from a `ProtocolContext` so a
// runtime can share one context (and thus one cancellation registry) with the background worker.

import { createAssistantService, type AssistantService } from "./assistants/assistant-service.js";
import type { ProtocolContext } from "./context.js";
import { createContext } from "./context.js";
import type { ProtocolDeps } from "./deps.js";
import { createRunService, type RunService } from "./runs/run-service.js";
import { createStoreService, type StoreService } from "./store/store-service.js";
import { createThreadService, type ThreadService } from "./threads/thread-service.js";
import {
  createThreadStreamService,
  type ThreadStreamService,
} from "./threads/thread-stream-service.js";

export interface ProtocolService {
  assistants: AssistantService;
  threads: ThreadService;
  threadStream: ThreadStreamService;
  runs: RunService;
  store: StoreService;
}

/** Assemble the service over an existing context (used by the runtime to share the context). */
export function buildProtocolService(ctx: ProtocolContext): ProtocolService {
  const runs = createRunService(ctx);
  return {
    assistants: createAssistantService(ctx.deps),
    threads: createThreadService(ctx),
    threadStream: createThreadStreamService(ctx, runs),
    runs,
    store: createStoreService(ctx.deps),
  };
}

/** Build the service with its own context. Use {@link createProtocolRuntime} when you also run a
 * background worker in the same process, so cancellation is shared. */
export function createProtocolService(deps: ProtocolDeps): ProtocolService {
  return buildProtocolService(createContext(deps));
}
