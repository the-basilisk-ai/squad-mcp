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

const { registerEntityTools } = await import("./get-entity.js");
const tools = captureTools(registerEntityTools);
const getEntity = tools.get("get_entity")!;

beforeEach(() => {
  mockExecute.mockReset();
  mockGetUserContext.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("get_entity routing", () => {
  it("routes AC- to the action query", async () => {
    byOperation(mockExecute, {
      GetAction: {
        action: { id: "a1", displayId: 12, title: "Fix onboarding" },
      },
    });

    const parsed = parse(await getEntity({ id: "AC-12" }, authCtx));
    expect(parsed.entityType).toBe("action");
    expect(parsed.displayId).toBe("AC-12");
  });

  it("fetches documents as markdown in two steps", async () => {
    byOperation(mockExecute, {
      GetDocumentMeta: {
        document: {
          id: "uuid-doc",
          displayId: 3,
          title: "Spec",
          kind: "knowledge",
        },
      },
      GetDocumentMarkdown: { documentMarkdownExport: "# Spec\n\nBody" },
    });

    const parsed = parse(await getEntity({ id: "DC-3" }, authCtx));
    expect(parsed.markdown).toBe("# Spec\n\nBody");
    expect(parsed.blockNoteJson).toBeUndefined();
  });

  it("resolves one-pagers via the formatted display ID", async () => {
    byOperation(mockExecute, {
      GetOnePager: (vars: unknown) => {
        expect(vars).toEqual({ displayId: "OP-2" });
        return { onePager: { id: "op1", displayId: 2, title: "Brief" } };
      },
    });

    const parsed = parse(await getEntity({ id: "op-2" }, authCtx));
    expect(parsed.displayId).toBe("OP-2");
  });

  it("probes types in order for UUID input", async () => {
    byOperation(mockExecute, {
      GetAction: { action: null },
      GetInsight: {
        insight: {
          id: "6f9619ff-8b86-d011-b42d-00c04fc964ff",
          displayId: 5,
          title: "T",
          goals: [],
          suggestedActions: [],
        },
      },
    });

    const parsed = parse(
      await getEntity({ id: "6F9619FF-8B86-D011-B42D-00C04FC964FF" }, authCtx),
    );
    expect(parsed.entityType).toBe("insight");
  });

  it("caps insight evidence and notes the total", async () => {
    const signals = Array.from({ length: 14 }, (_, i) => ({
      id: `s${i}`,
      displayId: i,
      contentSummary: `sig ${i}`,
    }));
    byOperation(mockExecute, {
      GetInsight: (vars: unknown) => {
        expect((vars as { withEvidence: boolean }).withEvidence).toBe(true);
        return {
          insight: {
            id: "i1",
            displayId: 5,
            title: "T",
            signals,
            goals: [],
            suggestedActions: [],
          },
        };
      },
    });

    const parsed = parse(
      await getEntity({ id: "IN-5", include: ["evidence"] }, authCtx),
    );
    expect(parsed.signals).toHaveLength(10);
    expect(parsed.evidenceNote).toContain("14");
  });

  it("rejects invalid includes with the valid list for the type", async () => {
    const result = await getEntity(
      { id: "GL-1", include: ["evidence"] },
      authCtx,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("goal");
  });

  it("rejects unknown prefixes with guidance", async () => {
    const result = await getEntity({ id: "XX-1" }, authCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("SI-1");
  });

  it("says not-found cleanly when the entity is missing", async () => {
    byOperation(mockExecute, { GetSignal: { signal: null } });
    const result = await getEntity({ id: "SI-999" }, authCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("SI-999");
  });
});
