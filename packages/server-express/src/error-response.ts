// Map a thrown error onto an HTTP response. `SkeinHttpError` carries the intended status and is
// serialized as `{ status, message, code?, details? }`; anything else is an unexpected fault → 500.
// Once headers are flushed (mid-SSE) we can only end the response, not rewrite its status.

import type { Logger } from "@skein-js/agent-protocol";
import { isSkeinHttpError } from "@skein-js/core";
import type { Response } from "express";

/** Serialize a caught error onto `res`, using the protocol status when the error carries one. */
export function sendErrorResponse(error: unknown, res: Response, logger?: Logger): void {
  if (res.headersSent) {
    // Too late to set a status (mid-stream) — but still surface an unexpected fault to the log so a
    // truncated stream isn't silent. Deliberate `SkeinHttpError`s are already client-visible.
    if (!isSkeinHttpError(error)) logger?.error("Unhandled error after headers were sent.", error);
    if (!res.writableEnded) res.end();
    return;
  }

  if (isSkeinHttpError(error)) {
    res.status(error.status).json({
      status: error.status,
      message: error.message,
      ...(error.code !== undefined ? { code: error.code } : {}),
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
    return;
  }

  logger?.error("Unhandled error in the skein Express adapter.", error);
  res.status(500).json({ status: 500, message: "Internal Server Error" });
}
