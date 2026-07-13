// Assemble a `ProtocolDeps` backed entirely by in-process drivers — the zero-setup runtime that
// powers `skein dev`. This is the ONLY place the adapter reaches for a concrete storage driver;
// everything else is driver-agnostic, so `skein up` can supply Postgres + Redis deps through the
// same seam (see skein-router.ts's `{ deps }` form).

import { MemorySaver } from "@langchain/langgraph";
import type { GraphResolver, GraphSchemas, ProtocolDeps } from "@skein-js/agent-protocol";
import { loadConfig, type GraphRegistry } from "@skein-js/config";
import { MemoryRunEventBus, MemoryRunQueue, MemorySkeinStore } from "@skein-js/storage-memory";
import type { CorsOptions } from "cors";

import { corsFromHttpConfig } from "./cors-config.js";

/**
 * Bridge a config `GraphRegistry` to the engine's `GraphResolver`. They are structurally identical
 * except for `schemas()`: config extracts schemas via `@langchain/langgraph-api`, whose `GraphSchema`
 * omits the SDK's `graph_id`. The shapes are otherwise the same, so the nominal gap is cast away here
 * (the same cast `@skein-js/agent-protocol`'s own fixtures use).
 */
function toGraphResolver(graphs: GraphRegistry): GraphResolver {
  return {
    ids: graphs.ids,
    load: (graphId) => graphs.load(graphId),
    schemas: async (graphId) => (await graphs.schemas(graphId)) as unknown as GraphSchemas,
  };
}

export interface InMemoryRuntimeConfig {
  /** In-memory `ProtocolDeps` (store, queue, bus, checkpointer) around the config's graphs. */
  deps: ProtocolDeps;
  /** CORS mapped from the config's `http.cors`, or `undefined` when none is declared. */
  cors?: CorsOptions;
}

/** Load `langgraph.json`, wiring fresh in-memory drivers and reading its `http.cors` for the adapter. */
export async function loadInMemoryRuntime(configPath: string): Promise<InMemoryRuntimeConfig> {
  const { graphs, config } = await loadConfig({ configPath });
  return {
    deps: {
      store: new MemorySkeinStore(),
      graphs: toGraphResolver(graphs),
      queue: new MemoryRunQueue(),
      bus: new MemoryRunEventBus(),
      checkpointer: new MemorySaver(),
    },
    cors: corsFromHttpConfig(config.http),
  };
}
