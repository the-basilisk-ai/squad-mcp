import { beforeEach, describe, expect, it, vi } from "vitest";
import { authCtx, captureTools, parse, userCtx } from "./test-utils.js";

const mockIngestSignals = vi.fn();
const mockGetUserContext = vi.fn();

vi.mock("../lib/ingest-client.js", () => ({
  ingestSignals: mockIngestSignals,
}));
vi.mock("../helpers/getUser.js", async importOriginal => ({
  ...(await importOriginal<object>()),
  getUserContext: mockGetUserContext,
}));
vi.mock("../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const { registerIngestTools } = await import("./ingest.js");
const tools = captureTools(registerIngestTools);

beforeEach(() => {
  mockIngestSignals.mockReset();
  mockGetUserContext.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("ingest_signal", () => {
  it("maps items with provenance metadata and echoes the result", async () => {
    mockIngestSignals.mockResolvedValue({
      success: true,
      created: 2,
      ids: ["s1", "s2"],
    });

    const result = await tools.get("ingest_signal")!(
      {
        signals: [
          {
            content: "Exports are broken for large workspaces",
            source: "zendesk",
            sourceUrl: "https://z.example/t/1",
            author: "casey@example.com",
          },
          { content: "Need CSV export" },
        ],
      },
      authCtx,
    );

    const [items, ctx] = mockIngestSignals.mock.calls[0];
    expect(items[0]).toEqual({
      content: "Exports are broken for large workspaces",
      title: undefined,
      source: "zendesk",
      strength: undefined,
      metadata: {
        sourceUrl: "https://z.example/t/1",
        author: "casey@example.com",
      },
    });
    expect(items[1].source).toBe("api");
    expect(items[1].metadata).toBeUndefined();
    expect(ctx).toEqual(userCtx);

    const parsed = parse(result);
    expect(parsed.created).toBe(2);
    expect(parsed.signalIds).toEqual(["s1", "s2"]);
    expect(parsed.note).toContain("asynchronously");
  });

  it("surfaces per-item errors from the ingest response", async () => {
    mockIngestSignals.mockResolvedValue({
      success: true,
      created: 1,
      ids: ["s1"],
      errors: ["Item 1: too long"],
    });

    const parsed = parse(
      await tools.get("ingest_signal")!(
        { signals: [{ content: "a" }, { content: "b" }] },
        authCtx,
      ),
    );
    expect(parsed.itemErrors).toEqual(["Item 1: too long"]);
  });
});
