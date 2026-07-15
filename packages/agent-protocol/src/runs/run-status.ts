// The run/thread status state machine, kept pure so it can be reasoned about and tested in
// isolation. A run moves pending -> running -> one of the terminal statuses; the owning thread's
// cosmetic status is mirrored from the run's. Vocabulary is fixed by the wire types:
//   RunStatus    = pending | running | success | error | timeout | interrupted | cancelled
//   ThreadStatus = idle | busy | interrupted | error
// (`cancelled` is skein's deliberate widening of the SDK union — see packages/core/src/wire.)

import { isTerminalRunStatus, type RunStatus, type ThreadStatus } from "@skein-js/core";

/** The thread status that mirrors a given run status (what the thread row should show). */
export function threadStatusForRun(status: RunStatus): ThreadStatus {
  switch (status) {
    case "running":
      return "busy";
    case "interrupted":
      return "interrupted";
    case "error":
    case "timeout":
      return "error";
    // pending (not yet started), success, and cancelled all leave the thread idle. A cancellation
    // is a clean stop, not a failure, so the thread returns to idle rather than error.
    case "pending":
    case "success":
    case "cancelled":
      return "idle";
    default:
      return "idle";
  }
}

/**
 * Whether a run may move from `from` to `to`. A terminal run never transitions again — this is the
 * invariant the engine relies on so a late cancel or timeout can't reopen a finished run.
 */
export function canTransition(from: RunStatus, to: RunStatus): boolean {
  if (isTerminalRunStatus(from)) return false;
  if (from === to) return false;
  // pending may start or be finalized directly (e.g. cancelled before it runs); running may only
  // move to a terminal status.
  if (from === "running" && to === "pending") return false;
  return true;
}
