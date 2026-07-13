import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, InvalidCursorError } from "./cursor.js";

describe("cursor", () => {
  it("round-trips a payload", () => {
    const cursor = encodeCursor({ sortKey: "2026-07-13T00:00:00Z", id: "a" });
    expect(decodeCursor(cursor)).toEqual({
      sortKey: "2026-07-13T00:00:00Z",
      id: "a",
    });
  });

  it("rejects tampered cursors with a friendly error", () => {
    expect(() => decodeCursor("garbage!!")).toThrow(InvalidCursorError);
    expect(() => decodeCursor("garbage!!")).toThrow(/nextCursor/);
  });

  it("rejects structurally wrong payloads", () => {
    const bad = Buffer.from(JSON.stringify({ nope: 1 })).toString("base64url");
    expect(() => decodeCursor(bad)).toThrow(InvalidCursorError);
  });
});
