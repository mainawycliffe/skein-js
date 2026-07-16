// Extract every graph's JSON schemas at build time, on the host, from the TypeScript source. This is
// what lets the production image ship bundled JS with no `.ts`: `getStaticGraphSchema` (which
// `GraphRegistry.schemas` calls) statically analyses the source and never executes it, so it only
// works where the source exists — the build host, not the slim runtime image. The result is baked to
// `schemas.json` and served at runtime through `loadConfig`'s `staticSchemas` seam.

import type { GraphRegistry, GraphSchemas } from "@skein-js/config";

/**
 * Precompute schemas for every declared graph, keyed by graph id. Runs the per-graph extractions
 * concurrently — each spawns langgraph-api's parser worker, and they're independent.
 */
export async function precomputeSchemas(
  graphs: GraphRegistry,
): Promise<Record<string, GraphSchemas>> {
  const entries = await Promise.all(
    graphs.ids.map(async (id) => [id, await graphs.schemas(id)] as const),
  );
  return Object.fromEntries(entries);
}
