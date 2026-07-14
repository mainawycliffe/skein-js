// @skein-js/express — Express adapter for skein-js. A thin transport shim: it maps Express requests
// onto @skein-js/agent-protocol's transport-neutral handler table and serializes JSON / 204 / SSE
// responses back out. It adds no protocol logic of its own. See docs/agent-protocol.md.

// Convenience assemblers — the common entry points.
export { skeinRouter } from "./skein-router.js";
export type { SkeinRouter, SkeinRouterOptions } from "./skein-router.js";
export { createExpressServer } from "./create-express-server.js";
export type { SkeinExpressServer } from "./create-express-server.js";

// The pure transport shim + route table, for callers wiring their own `ProtocolDeps`.
export { createHandlerRouter, skeinRoutes } from "./routes.js";
export type { HandlerRouterOptions } from "./routes.js";

// Low-level request/response mappers, for adapters composing their own routing.
export { toProtocolRequest } from "./to-protocol-request.js";
export { sendProtocolResponse } from "./send-protocol-response.js";
export { sendErrorResponse } from "./error-response.js";
export { loadInMemoryRuntime, loadReloadableInMemoryRuntime } from "./in-memory-runtime.js";
export type {
  InMemoryRuntimeConfig,
  ReloadableInMemoryRuntime,
  DevStateSnapshot,
} from "./in-memory-runtime.js";

// LangGraph-compatible CORS: map a langgraph.json `http.cors` block to `cors` options.
export { corsFromHttpConfig, toCorsOptions } from "./cors-config.js";
export type { LanggraphCorsConfig } from "./cors-config.js";
