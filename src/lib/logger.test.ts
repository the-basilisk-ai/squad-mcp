import { format } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger.js";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a message containing format specifiers verbatim, with its data", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    logger.warn({ userId: "u-1" }, "rate %s for %o");

    const line = format(...(warn.mock.calls[0] ?? []));
    expect(line).toMatch(/\[WARN\] rate %s for %o \{ userId: 'u-1' \}$/);
  });
});
