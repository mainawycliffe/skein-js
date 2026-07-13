// The convenience assemblers over the pure shim. `skeinRouter` builds a fully-wired protocol runtime
// and returns both the mountable `Router` and the `runtime` (so the caller can `worker.stop()` on
// shutdown). Pass `{ config }` for the in-memory `skein dev` runtime, or `{ deps }` to bring your own
// persistent drivers (Postgres + Redis for `skein up`) through the same `ProtocolDeps` seam.

import {
  createProtocolRuntime,
  type Logger,
  type ProtocolDeps,
  type ProtocolRuntime,
} from "@skein-js/agent-protocol";
import type { CorsOptions } from "cors";
import type { Router } from "express";

import { loadInMemoryRuntime } from "./in-memory-runtime.js";
import { createHandlerRouter } from "./routes.js";

interface SkeinRouterCommonOptions {
  logger?: Logger;
  /**
   * Cross-origin access for browser clients (Agent Chat UI, React `useStream`). When omitted, CORS
   * is driven by the config's `http.cors` block (LangGraph-compatible) and is otherwise **off** — we
   * do not default to LangGraph's permissive `origin: "*"`. Set this to override: `CorsOptions` to
   * restrict origins for `skein up`, `true` for permissive dev (reflect the request origin), or
   * `false` to force it off. An explicit value wins over `http.cors`.
   */
  cors?: boolean | CorsOptions;
}

/** Either point at a `langgraph.json` (in-memory runtime) or inject a ready `ProtocolDeps`. */
export type SkeinRouterOptions = SkeinRouterCommonOptions &
  ({ config: string; deps?: never } | { deps: ProtocolDeps; config?: never });

export interface SkeinRouter {
  /** Mount on an Express app: `app.use(router)`. */
  router: Router;
  /** The wired runtime — call `runtime.worker.stop()` on shutdown to drain background runs. */
  runtime: ProtocolRuntime;
}

/**
 * Wire a protocol runtime and return its mountable router. Seeds one assistant per declared graph
 * and starts the background run worker before returning, so the router is ready to serve.
 */
export async function skeinRouter(options: SkeinRouterOptions): Promise<SkeinRouter> {
  let deps: ProtocolDeps;
  let corsFromConfig: boolean | CorsOptions | undefined;
  if (options.deps) {
    deps = options.deps;
  } else {
    const loaded = await loadInMemoryRuntime(options.config);
    deps = loaded.deps;
    corsFromConfig = loaded.cors;
  }

  const runtime = createProtocolRuntime(deps);
  await runtime.service.assistants.registerGraphAssistants();
  runtime.worker.start();

  const router = createHandlerRouter(runtime.handlers, {
    logger: options.logger,
    // Explicit option wins; otherwise fall back to the config's `http.cors`, else off.
    cors: options.cors ?? corsFromConfig ?? false,
  });
  return { router, runtime };
}
