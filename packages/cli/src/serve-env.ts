// Shared server-bind helpers for the in-process commands (`skein dev` and `skein start`). Both honor
// a `PORT`/`HOST` from the environment (Railway/Fly/Render/Heroku inject one) unless the flag was
// passed explicitly, and both surface the same clear message when the port is already taken.

/**
 * Port to bind, honoring a `PORT` env var. Resolve this *after* the project's `.env` is merged, so a
 * project-declared PORT is honored too — not just an ambient one. Returns `fallback` when PORT is
 * unset or not a valid port.
 */
export function envPort(fallback: number): number {
  const raw = process.env.PORT;
  if (raw === undefined || raw.trim() === "") return fallback;
  const port = Number(raw);
  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : fallback;
}

/** Host to bind, honoring a `HOST` env var when set; otherwise `fallback`. */
export function envHost(fallback: string): string {
  const host = process.env.HOST;
  return host !== undefined && host.trim() !== "" ? host : fallback;
}

/**
 * Human-readable message for a `server.listen` failure: a friendly hint for the common
 * `EADDRINUSE`, the raw error otherwise.
 */
export function describeBindError(error: unknown, port: number): string {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EADDRINUSE") {
    return `port ${port} is already in use. Stop the other process or pass --port.`;
  }
  return `failed to start server: ${error instanceof Error ? error.message : String(error)}`;
}
