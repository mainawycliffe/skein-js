// Wraps the protocol handler table with authentication + authorization when an `AuthEngine` is
// configured. This is the ONE transport-neutral seam through which every adapter (Express, Fastify,
// Nest) inherits auth — nothing framework-specific lives here. Per request it authenticates the
// caller (studio traffic bypassed unless disabled), authorizes the route's resource + action, and —
// only when the handler returned ownership filters — dispatches through a per-request service whose
// store is the auth-scoped decorator. The shared cancellation registry and thread locks are reused
// from the base context (only `deps.store` is swapped), so background-run cancellation still works.

import type { AuthContext, AuthEngine, AuthUser } from "@skein-js/core";

import type { ProtocolContext } from "../context.js";
import { createProtocolHandlers, type ProtocolHandlers } from "../create-handlers.js";
import { buildProtocolService } from "../service.js";

import { createAuthScopedStore } from "./auth-scoped-store.js";
import { authValue, ROUTE_AUTHZ, synthesizeRequest } from "./route-authz.js";

/** The synthetic caller LangGraph Studio presents; used only when studio auth is not disabled. */
const STUDIO_USER: AuthUser = {
  identity: "langgraph-studio-user",
  display_name: "langgraph-studio-user",
  is_authenticated: true,
  permissions: [],
};

/**
 * Build a handler table that authenticates and authorizes every request before dispatch. Studio
 * traffic (`x-auth-scheme: langsmith`) is admitted without authenticating unless
 * `auth.disable_studio_auth` is set, matching LangGraph.
 */
export function createAuthorizingHandlers(
  context: ProtocolContext,
  engine: AuthEngine,
): ProtocolHandlers {
  const baseHandlers = createProtocolHandlers(buildProtocolService(context));
  const names = Object.keys(baseHandlers) as (keyof ProtocolHandlers)[];

  const resolveAuthContext = async (
    req: Parameters<ProtocolHandlers[keyof ProtocolHandlers]>[0],
  ): Promise<AuthContext | undefined> => {
    if (!engine.studioAuthDisabled && req.headers["x-auth-scheme"] === "langsmith") {
      return { user: STUDIO_USER, scopes: [] };
    }
    return engine.authenticate(synthesizeRequest(req));
  };

  const wrapped = {} as ProtocolHandlers;
  for (const name of names) {
    const route = ROUTE_AUTHZ[name];
    wrapped[name] = async (req) => {
      const authContext = await resolveAuthContext(req);
      const { filters } = await engine.authorize({
        resource: route.resource,
        action: route.action,
        value: authValue(req),
        context: authContext,
      });
      // No ownership filters: authorization passed with nothing to scope — dispatch unscoped.
      if (!filters) return baseHandlers[name](req);

      const scopedStore = createAuthScopedStore(context.deps.store, engine, filters, route.resource);
      const scopedContext: ProtocolContext = {
        ...context,
        deps: { ...context.deps, store: scopedStore },
      };
      return createProtocolHandlers(buildProtocolService(scopedContext))[name](req);
    };
  }
  return wrapped;
}
