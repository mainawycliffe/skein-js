import { describe, expect, it } from "vitest";

import { parse, requireParam } from "./parse.js";
import { runCreateSchema, storePutSchema, threadCreateSchema } from "./schemas.js";

describe("validation", () => {
  it("accepts a valid run-create body", () => {
    const parsed = parse(runCreateSchema, { assistant_id: "echo", input: { value: "hi" } });
    expect(parsed.assistant_id).toBe("echo");
  });

  it("rejects a run-create body missing assistant_id with a 400", () => {
    expect(() => parse(runCreateSchema, { input: {} })).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it("rejects a store put with an empty namespace or key", () => {
    expect(() => parse(storePutSchema, { namespace: [], key: "k", value: {} })).toThrow(
      expect.objectContaining({ status: 400 }),
    );
    expect(() => parse(storePutSchema, { namespace: ["ns"], key: "", value: {} })).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it("allows an empty thread-create body", () => {
    expect(parse(threadCreateSchema, {})).toEqual({});
  });

  it("requireParam throws a 400 when a path param is missing", () => {
    expect(() => requireParam({}, "thread_id")).toThrow(expect.objectContaining({ status: 400 }));
    expect(requireParam({ thread_id: "t1" }, "thread_id")).toBe("t1");
  });
});
