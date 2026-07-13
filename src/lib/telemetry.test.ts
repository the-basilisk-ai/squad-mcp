import type { PostHogMCP } from "@posthog/mcp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureToolCall, setTelemetryClientForTests } from "./telemetry.js";

vi.mock("./logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("captureToolCall", () => {
  const capture = vi.fn();

  beforeEach(() => {
    capture.mockReset();
    setTelemetryClientForTests({
      captureToolCall: capture,
    } as unknown as PostHogMCP);
  });

  it("emits the canonical payload with org and workspace groups", () => {
    captureToolCall({
      tool: "get_entity",
      userId: "user-1",
      orgId: "pa-org-1",
      workspaceId: "ws-1",
      durationMs: 42,
      ok: true,
    });

    expect(capture).toHaveBeenCalledWith({
      toolName: "get_entity",
      distinctId: "user-1",
      durationMs: 42,
      isError: false,
      groups: { organisation: "pa-org-1", workspace: "ws-1" },
    });
  });

  it("passes the thrown error through and omits groups pre-context", () => {
    const boom = new Error("boom");
    captureToolCall({
      tool: "list_workspaces",
      userId: "user-1",
      durationMs: 10,
      ok: false,
      error: boom,
    });

    const payload = capture.mock.calls[0][0];
    expect(payload.isError).toBe(true);
    expect(payload.error).toBe(boom);
    expect(payload.groups).toBeUndefined();
  });

  it("is a no-op without a client", () => {
    setTelemetryClientForTests(null);
    captureToolCall({ tool: "search", userId: "u", durationMs: 1, ok: true });
    expect(capture).not.toHaveBeenCalled();
  });
});
