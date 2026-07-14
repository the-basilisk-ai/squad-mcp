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

const { registerActionReadTools } = await import("./actions-read.js");
const tools = captureTools(registerActionReadTools);

beforeEach(() => {
  mockExecute.mockReset();
  mockGetUserContext.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("list_actions", () => {
  it('resolves assignee "me" and defaults to open statuses', async () => {
    byOperation(mockExecute, {
      ListActions: (vars: unknown) => {
        const v = vars as Record<string, unknown>;
        expect(v.assigneeUserId).toBe("user-1");
        expect(v.statuses).toEqual(["suggested", "in_progress"]);
        return {
          actions: [
            {
              id: "a1",
              displayId: 12,
              title: "Fix onboarding drop-off",
              status: "suggested",
              priority: "P0",
              insight: { id: "i1", displayId: 4, title: "T" },
            },
          ],
        };
      },
    });

    const parsed = parse(
      await tools.get("list_actions")!({ assignee: "me" }, authCtx),
    );
    expect(parsed.items[0].displayId).toBe("AC-12");
    expect(parsed.items[0].extra.insight).toBe("IN-4");
  });

  it("routes insight-scoped listing through actionList", async () => {
    byOperation(mockExecute, {
      ListActionsForInsight: (vars: unknown) => {
        expect((vars as { insightId: string }).insightId).toBe("IN-4");
        return { actionList: [] };
      },
    });

    const parsed = parse(
      await tools.get("list_actions")!({ insightId: "IN-4" }, authCtx),
    );
    expect(parsed.items).toEqual([]);
  });
});

describe("get_action_context", () => {
  it("composes action, why, capped evidence and strategy sections", async () => {
    byOperation(mockExecute, {
      ActionContext: {
        action: {
          id: "a1",
          displayId: 12,
          title: "Fix onboarding drop-off",
          status: "suggested",
          priority: "P0",
          insight: {
            id: "i1",
            displayId: 4,
            title: "Users churn at step 3",
            description: "desc",
            combinedScore: 0.9,
            evidenceCount: 12,
            goals: [
              { id: "g1", displayId: 2, title: "Reduce churn", importance: 5 },
            ],
            signals: Array.from({ length: 12 }, (_, i) => ({
              id: `s${i}`,
              displayId: i + 1,
              contentSummary: `quote ${i}`,
              source: "zendesk",
              externalSource: { sourceUri: `https://z.example/${i}` },
            })),
          },
        },
      },
    });

    const parsed = parse(
      await tools.get("get_action_context")!({ id: "AC-12" }, authCtx),
    );

    expect(parsed.action.displayId).toBe("AC-12");
    expect(parsed.why.insight).toBe("IN-4");
    expect(parsed.evidence).toHaveLength(8);
    expect(parsed.evidence[0].sourceUrl).toBe("https://z.example/0");
    expect(parsed.evidenceNote).toContain("12");
    expect(parsed.strategy[0].displayId).toBe("GL-2");
  });

  it("degrades cleanly for an orphan action", async () => {
    byOperation(mockExecute, {
      ActionContext: {
        action: { id: "a2", displayId: 13, title: "Standalone", insight: null },
      },
    });

    const parsed = parse(
      await tools.get("get_action_context")!({ id: "AC-13" }, authCtx),
    );
    expect(parsed.why.note).toContain("stands alone");
    expect(parsed.evidence.note).toBeDefined();
    expect(parsed.strategy.note).toBeDefined();
  });
});
