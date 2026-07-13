import { describe, expect, it } from "vitest";

import { chunkToFrameBody, toRunFrame } from "./run-frame-stream.js";

describe("chunkToFrameBody", () => {
  it("unwraps a [mode, data] tuple", () => {
    expect(chunkToFrameBody(["values", { a: 1 }])).toEqual({ event: "values", data: { a: 1 } });
    expect(chunkToFrameBody(["messages", "hi"])).toEqual({ event: "messages", data: "hi" });
  });

  it("treats a bare (non-tuple) chunk as an updates payload", () => {
    expect(chunkToFrameBody({ x: 1 })).toEqual({ event: "updates", data: { x: 1 } });
  });

  it("only unwraps tuples whose first element is a known mode", () => {
    expect(chunkToFrameBody(["nope", 1])).toEqual({ event: "updates", data: ["nope", 1] });
  });
});

describe("toRunFrame", () => {
  it("stamps the sequence number onto a frame body", () => {
    expect(toRunFrame(3, { event: "messages", data: "x" })).toEqual({
      seq: 3,
      event: "messages",
      data: "x",
    });
  });
});
