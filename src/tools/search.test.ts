import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authCtx,
  byOperation,
  captureTools,
  parse,
  userCtx,
} from "./test-utils.js";

const mockExecute = vi.fn();
const mockGetUserContext = vi.fn();

vi.mock("../lib/squad-api-client.js", async importOriginal => ({
  ...(await importOriginal<object>()),
  execute: mockExecute,
}));
vi.mock("../helpers/getUser.js", async importOriginal => ({
  ...(await importOriginal<object>()),
  getUserContext: mockGetUserContext,
}));
vi.mock("../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const { registerSearchTools } = await import("./search.js");
const tools = captureTools(registerSearchTools);

beforeEach(() => {
  mockExecute.mockReset();
  mockGetUserContext.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("search", () => {
  it("filters to requested types and formats display IDs", async () => {
    byOperation(mockExecute, {
      CommandSearch: {
        commandSearchEntities: [
          { id: "i1", displayId: 4, title: "Billing pain", type: "insight" },
          { id: "g1", displayId: 2, title: "Reduce churn", type: "goal" },
        ],
      },
    });

    const result = await tools.get("search")!(
      { query: "billing", types: ["insight"] },
      authCtx,
    );
    const parsed = parse(result);

    expect(parsed.items).toEqual([
      { id: "i1", displayId: "IN-4", title: "Billing pain", type: "insight" },
    ]);
    // document search skipped when documents not requested
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("merges document text search without duplicates", async () => {
    byOperation(mockExecute, {
      CommandSearch: {
        commandSearchEntities: [
          { id: "d1", displayId: 7, title: "Spec", type: "document" },
        ],
      },
      DocumentTextSearch: {
        documentSearch: [
          { id: "d1", displayId: 7, title: "Spec", kind: "knowledge" },
          { id: "d2", displayId: 9, title: "Brief", kind: "one_pager" },
        ],
      },
    });

    const parsed = parse(
      await tools.get("search")!({ query: "spec" }, authCtx),
    );
    const ids = parsed.items.map((i: { id: string }) => i.id);
    expect(ids).toEqual(["d1", "d2"]);
    expect(parsed.items[1].displayId).toBe("OP-9");
  });

  it("returns the empty state with a browsing suggestion", async () => {
    byOperation(mockExecute, {
      CommandSearch: { commandSearchEntities: [] },
      DocumentTextSearch: { documentSearch: [] },
    });

    const parsed = parse(await tools.get("search")!({ query: "zzz" }, authCtx));
    expect(parsed.items).toEqual([]);
    expect(parsed.suggestion).toContain("list_clusters");
  });
});
