import { describe, expect, it } from "vitest";
import {
  formatDisplayId,
  InvalidEntityIdError,
  parseEntityRef,
} from "./display-id.js";

describe("parseEntityRef", () => {
  it.each([
    ["SI-1", "signal", 1],
    ["IN-42", "insight", 42],
    ["AC-7", "action", 7],
    ["GL-3", "goal", 3],
    ["OP-9", "one_pager", 9],
    ["DC-2", "document", 2],
    ["RQ-5", "research_question", 5],
    ["CL-11", "cluster", 11],
  ])("routes %s to %s", (input, type, num) => {
    expect(parseEntityRef(input)).toEqual({
      kind: "display",
      type,
      displayId: num,
      formatted: input,
    });
  });

  it("accepts lowercase prefixes and normalises them", () => {
    expect(parseEntityRef("ac-12")).toEqual({
      kind: "display",
      type: "action",
      displayId: 12,
      formatted: "AC-12",
    });
  });

  it("passes UUIDs through", () => {
    const uuid = "6F9619FF-8B86-D011-B42D-00C04FC964FF";
    expect(parseEntityRef(uuid)).toEqual({
      kind: "uuid",
      id: uuid.toLowerCase(),
    });
  });

  it("rejects unknown prefixes with the valid-prefix list", () => {
    expect(() => parseEntityRef("XX-1")).toThrow(InvalidEntityIdError);
    expect(() => parseEntityRef("XX-1")).toThrow(/SI-1.*GL-1/s);
  });

  it("rejects junk input", () => {
    expect(() => parseEntityRef("not an id")).toThrow(InvalidEntityIdError);
  });
});

describe("formatDisplayId", () => {
  it("round-trips with parseEntityRef", () => {
    expect(formatDisplayId("one_pager", 4)).toBe("OP-4");
    expect(parseEntityRef(formatDisplayId("signal", 8))).toMatchObject({
      type: "signal",
      displayId: 8,
    });
  });
});
