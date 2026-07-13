import { describe, expect, it } from "vitest";

import { isTerminalRunStatus, TERMINAL_RUN_STATUSES } from "./skein-store.js";

describe("isTerminalRunStatus", () => {
  it("treats success/error/timeout/interrupted as terminal", () => {
    for (const status of TERMINAL_RUN_STATUSES) {
      expect(isTerminalRunStatus(status)).toBe(true);
    }
  });

  it("treats an interrupted run as terminal (it yields the thread; resume is a fresh run)", () => {
    // Aligns with @langchain/langgraph-api, whose inflight check is `pending | running` only.
    expect(isTerminalRunStatus("interrupted")).toBe(true);
  });

  it("treats only pending/running as inflight (non-terminal)", () => {
    expect(isTerminalRunStatus("pending")).toBe(false);
    expect(isTerminalRunStatus("running")).toBe(false);
  });
});
