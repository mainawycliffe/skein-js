import { describe, expect, it } from "vitest";

import { describeInterrupts, extractToolActivity } from "./run-log.js";

describe("extractToolActivity", () => {
  it("pulls tool calls from an AI message in an `updates` chunk", () => {
    const data = {
      agent: {
        messages: [
          { type: "ai", content: "", tool_calls: [{ name: "web_search", id: "call_1", args: {} }] },
        ],
      },
    };
    expect(extractToolActivity(data).calls).toEqual([{ name: "web_search", id: "call_1" }]);
  });

  it("pulls tool calls from a `[message, metadata]` messages-mode tuple payload", () => {
    const data = [{ type: "ai", tool_calls: [{ name: "save_memory", id: "call_2" }] }, { step: 1 }];
    expect(extractToolActivity(data).calls).toEqual([{ name: "save_memory", id: "call_2" }]);
  });

  it("reports tool-result messages with their name and call id", () => {
    const data = {
      tools: { messages: [{ type: "tool", name: "web_search", tool_call_id: "call_1" }] },
    };
    expect(extractToolActivity(data).results).toEqual([{ name: "web_search", id: "call_1" }]);
  });

  it("recognizes a message via `_getType()` when there is no `type` field", () => {
    const data = { messages: [{ _getType: () => "tool", name: "lookup", tool_call_id: "c9" }] };
    expect(extractToolActivity(data).results).toEqual([{ name: "lookup", id: "c9" }]);
  });

  it("returns nothing for payloads with no tool activity, and never throws on odd shapes", () => {
    expect(extractToolActivity({ values: { answer: "hi" } })).toEqual({ calls: [], results: [] });
    expect(extractToolActivity(null)).toEqual({ calls: [], results: [] });
    expect(extractToolActivity("not an object")).toEqual({ calls: [], results: [] });
  });

  it("is cycle-safe", () => {
    const node: Record<string, unknown> = { tool_calls: [{ name: "loop", id: "c1" }] };
    node["self"] = node;
    expect(extractToolActivity(node).calls).toEqual([{ name: "loop", id: "c1" }]);
  });
});

describe("describeInterrupts", () => {
  it("returns the interrupt prompts from a paused snapshot's tasks", () => {
    const snapshot = {
      tasks: [{ interrupts: [{ value: "approve?" }] }, { interrupts: [{ value: { q: "ok?" } }] }],
    } as never;
    expect(describeInterrupts(snapshot)).toEqual(["approve?", '{"q":"ok?"}']);
  });

  it("returns an empty list when there are no tasks or interrupts", () => {
    expect(describeInterrupts({ tasks: [] } as never)).toEqual([]);
    expect(describeInterrupts({} as never)).toEqual([]);
  });
});
