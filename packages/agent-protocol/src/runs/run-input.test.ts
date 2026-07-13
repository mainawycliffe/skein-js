import { isCommand } from "@langchain/langgraph";
import { describe, expect, it } from "vitest";

import { normalizeModes, toGraphCallOptions, toGraphInput } from "./run-input.js";

describe("normalizeModes", () => {
  it("defaults to values when nothing is requested", () => {
    expect(normalizeModes()).toEqual(["values"]);
    expect(normalizeModes([])).toEqual(["values"]);
  });

  it("maps SDK aliases onto graph modes and de-duplicates", () => {
    expect(normalizeModes("messages-tuple")).toEqual(["messages"]);
    expect(normalizeModes(["events"])).toEqual(["updates"]);
    expect(normalizeModes(["values", "values", "updates"])).toEqual(["values", "updates"]);
  });
});

describe("toGraphInput", () => {
  it("builds a Command when the run carries one", () => {
    const input = toGraphInput({ command: { resume: "yes" } });
    expect(isCommand(input)).toBe(true);
  });

  it("passes input through, defaulting to null", () => {
    expect(toGraphInput({ input: { value: "hi" } })).toEqual({ value: "hi" });
    expect(toGraphInput({})).toBeNull();
  });
});

describe("toGraphCallOptions", () => {
  it("threads thread_id through configurable and always wins over caller config", () => {
    const signal = new AbortController().signal;
    const options = toGraphCallOptions(
      { config: { configurable: { thread_id: "other", foo: "bar" } }, stream_mode: "values" },
      "t1",
      signal,
    );
    expect(options.configurable).toEqual({ foo: "bar", thread_id: "t1" });
    expect(options.streamMode).toEqual(["values"]);
    expect(options.signal).toBe(signal);
  });

  it("strips server-owned configurable keys a client must not set", () => {
    const options = toGraphCallOptions(
      {
        config: {
          configurable: {
            user_key: "ok",
            checkpoint_id: "attacker-picked",
            checkpoint_ns: "x",
            run_id: "spoof",
            __pregel_internal: "no",
          },
        },
      },
      "t1",
      new AbortController().signal,
    );
    expect(options.configurable).toEqual({ user_key: "ok", thread_id: "t1" });
  });

  it("carries context, recursion limit, and interrupt lists when present", () => {
    const options = toGraphCallOptions(
      {
        context: { user: "a" },
        config: { recursion_limit: 5 },
        interrupt_before: ["ask"],
        interrupt_after: "*",
      },
      "t1",
      new AbortController().signal,
    );
    expect(options.context).toEqual({ user: "a" });
    expect(options.recursionLimit).toBe(5);
    expect(options.interruptBefore).toEqual(["ask"]);
    expect(options.interruptAfter).toBe("*");
  });
});
