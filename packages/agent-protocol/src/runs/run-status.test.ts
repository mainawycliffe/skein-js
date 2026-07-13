import { describe, expect, it } from "vitest";

import { canTransition, threadStatusForRun } from "./run-status.js";

describe("threadStatusForRun", () => {
  it("mirrors each run status onto the right thread status", () => {
    expect(threadStatusForRun("pending")).toBe("idle");
    expect(threadStatusForRun("running")).toBe("busy");
    expect(threadStatusForRun("success")).toBe("idle");
    expect(threadStatusForRun("interrupted")).toBe("interrupted");
    expect(threadStatusForRun("error")).toBe("error");
    expect(threadStatusForRun("timeout")).toBe("error");
  });
});

describe("canTransition", () => {
  it("allows starting and finalizing a run", () => {
    expect(canTransition("pending", "running")).toBe(true);
    expect(canTransition("pending", "error")).toBe(true);
    expect(canTransition("running", "success")).toBe(true);
    expect(canTransition("running", "interrupted")).toBe(true);
  });

  it("never leaves a terminal status", () => {
    expect(canTransition("success", "running")).toBe(false);
    expect(canTransition("interrupted", "running")).toBe(false);
    expect(canTransition("error", "success")).toBe(false);
    expect(canTransition("timeout", "running")).toBe(false);
  });

  it("forbids running->pending and same-status no-ops", () => {
    expect(canTransition("running", "pending")).toBe(false);
    expect(canTransition("running", "running")).toBe(false);
  });
});
