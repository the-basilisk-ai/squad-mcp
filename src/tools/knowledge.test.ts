import { beforeEach, describe, expect, it, vi } from "vitest";
import { authCtx, captureTools, opName, parse, userCtx } from "./test-utils.js";

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

const { registerKnowledgeTools } = await import("./knowledge.js");
const tools = captureTools(registerKnowledgeTools);

beforeEach(() => {
  mockExecute.mockReset();
  mockGetUserContext.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("create_document", () => {
  it("returns the existing document on a near-identical title", async () => {
    mockExecute.mockImplementation((doc: never) => {
      expect(opName(doc)).toBe("DocumentTextSearch");
      return Promise.resolve({
        documentSearch: [
          {
            id: "d1",
            displayId: 3,
            title: "Q3 Churn Analysis!",
            kind: "knowledge",
          },
        ],
      });
    });

    const parsed = parse(
      await tools.get("create_document")!(
        { title: "Q3 churn analysis", markdown: "# Body" },
        authCtx,
      ),
    );
    expect(parsed.deduplicated).toBe(true);
    expect(parsed.document.displayId).toBe("DC-3");
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("creates with markdown as content and applies tags", async () => {
    const calls: Array<{ name: string; vars: unknown }> = [];
    mockExecute.mockImplementation((doc: never, vars: unknown) => {
      const name = opName(doc);
      calls.push({ name, vars });
      if (name === "DocumentTextSearch")
        return Promise.resolve({ documentSearch: [] });
      if (name === "CreateDocument")
        return Promise.resolve({
          createDocument: {
            id: "d2",
            displayId: 4,
            title: "Notes",
            path: "/Notes",
          },
        });
      return Promise.resolve({
        addDocumentTag: { id: "d2", tags: ["research"] },
      });
    });

    const parsed = parse(
      await tools.get("create_document")!(
        { title: "Notes", markdown: "## Section\nBody", tags: ["research"] },
        authCtx,
      ),
    );

    const create = calls.find(c => c.name === "CreateDocument");
    expect(create?.vars).toEqual({
      input: {
        title: "Notes",
        content: "## Section\nBody",
        directoryId: undefined,
      },
    });
    expect(calls.filter(c => c.name === "AddDocumentTag")).toHaveLength(1);
    expect(parsed.document.displayId).toBe("DC-4");
  });
});

describe("update_document", () => {
  it("resolves the display ID and updates with a version snapshot", async () => {
    const calls: Array<{ name: string; vars: unknown }> = [];
    mockExecute.mockImplementation((doc: never, vars: unknown) => {
      const name = opName(doc);
      calls.push({ name, vars });
      if (name === "GetDocumentMeta")
        return Promise.resolve({ document: { id: "uuid-d1", displayId: 3 } });
      return Promise.resolve({
        updateDocument: { id: "uuid-d1", displayId: 3, title: "T" },
      });
    });

    const parsed = parse(
      await tools.get("update_document")!(
        { documentId: "DC-3", markdown: "new body" },
        authCtx,
      ),
    );

    const update = calls.find(c => c.name === "UpdateDocument");
    expect(update?.vars).toEqual({
      id: "uuid-d1",
      input: { content: "new body", title: undefined, createVersion: true },
    });
    expect(parsed.message).toContain("version snapshot");
  });
});

describe("list_one_pagers", () => {
  it("maps filters and formats source references", async () => {
    mockExecute.mockImplementation((doc: never, vars: unknown) => {
      expect(opName(doc)).toBe("OnePagerList");
      expect((vars as { filters: unknown }).filters).toEqual({
        onePagerStatus: ["draft"],
        onePagerType: "decision",
        sourceInsightId: undefined,
      });
      return Promise.resolve({
        onePagerList: [
          {
            id: "op1",
            displayId: 2,
            title: "Brief",
            onePagerStatus: "draft",
            onePagerType: "decision",
            decisionRecommendation: "build",
            sourceAction: { id: "a1", displayId: 12, title: "A" },
          },
        ],
      });
    });

    const parsed = parse(
      await tools.get("list_one_pagers")!(
        { status: ["draft"], type: "decision" },
        authCtx,
      ),
    );
    expect(parsed.items[0].displayId).toBe("OP-2");
    expect(parsed.items[0].extra.sourceAction).toBe("AC-12");
    expect(parsed.items[0].extra.recommendation).toBe("build");
  });
});

describe("generate_one_pager", () => {
  it("requires exactly one source", async () => {
    const result = await tools.get("generate_one_pager")!(
      { actionId: "AC-1", insightId: "IN-1" },
      authCtx,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("exactly one");
  });

  it("generates from an action and returns the async contract", async () => {
    mockExecute.mockImplementation((doc: never, vars: unknown) => {
      const name = opName(doc);
      if (name === "GetAction")
        return Promise.resolve({
          action: { id: "uuid-a1", displayId: 12, notes: null },
        });
      expect(name).toBe("GenerateOnePagerFromAction");
      expect(vars).toEqual({ actionId: "uuid-a1", type: undefined });
      return Promise.resolve({
        generateOnePagerFromAction: {
          onePagerId: "uuid-op1",
          onePagerDisplayId: "OP-9",
        },
      });
    });

    const parsed = parse(
      await tools.get("generate_one_pager")!({ actionId: "AC-12" }, authCtx),
    );
    expect(parsed).toMatchObject({
      id: "uuid-op1",
      displayId: "OP-9",
      status: "building",
      checkWith: "get_entity",
    });
  });

  it("generates from an insight via the document-returning mutation", async () => {
    mockExecute.mockImplementation((doc: never) => {
      const name = opName(doc);
      if (name === "GetInsight")
        return Promise.resolve({ insight: { id: "uuid-i1", displayId: 4 } });
      expect(name).toBe("GenerateOnePagerFromInsight");
      return Promise.resolve({
        generateOnePagerFromInsight: {
          id: "uuid-op2",
          displayId: 10,
          onePagerStatus: "building",
        },
      });
    });

    const parsed = parse(
      await tools.get("generate_one_pager")!({ insightId: "IN-4" }, authCtx),
    );
    expect(parsed.displayId).toBe("OP-10");
    expect(parsed.status).toBe("building");
  });
});
