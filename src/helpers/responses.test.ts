import { describe, expect, it } from "vitest";
import {
  appLink,
  asyncTriggerResponse,
  clampLimit,
  emptyResponse,
  listResponse,
  MAX_LIMIT,
} from "./responses.js";

function parse(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

describe("clampLimit", () => {
  it("defaults and caps", () => {
    expect(clampLimit(undefined)).toBe(25);
    expect(clampLimit(0)).toBe(25);
    expect(clampLimit(10)).toBe(10);
    expect(clampLimit(10_000)).toBe(MAX_LIMIT);
  });
});

describe("listResponse", () => {
  it("includes cursor and total only when provided", () => {
    const items = [{ id: "1", displayId: "IN-1", title: "T" }];
    expect(parse(listResponse(items))).toEqual({ items });
    expect(parse(listResponse(items, { nextCursor: "c", total: 9 }))).toEqual({
      items,
      nextCursor: "c",
      total: 9,
    });
  });
});

describe("asyncTriggerResponse", () => {
  it("always tells the agent how to check back", () => {
    const parsed = parse(
      asyncTriggerResponse({
        id: "op-1",
        displayId: "OP-1",
        status: "building",
      }),
    );
    expect(parsed).toEqual({
      id: "op-1",
      displayId: "OP-1",
      status: "building",
      checkWith: "get_entity",
    });
  });
});

describe("emptyResponse", () => {
  it("carries a suggestion", () => {
    expect(
      parse(emptyResponse("Nothing found.", "Try list_clusters.")),
    ).toEqual({
      items: [],
      message: "Nothing found.",
      suggestion: "Try list_clusters.",
    });
  });
});

describe("appLink", () => {
  it("builds slug-based links against the production app by default", () => {
    expect(appLink("acme", "main", "insights")).toBe(
      "https://app.meetsquad.ai/acme/main/insights",
    );
    expect(appLink("acme", "main")).toBe("https://app.meetsquad.ai/acme/main");
    expect(appLink("acme", "main", "/actions")).toBe(
      "https://app.meetsquad.ai/acme/main/actions",
    );
  });
});
