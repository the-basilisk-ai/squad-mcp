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

const { registerStrategyReadTools } = await import("./strategy-read.js");
const tools = captureTools(registerStrategyReadTools);

beforeEach(() => {
  mockExecute.mockReset();
  mockGetUserContext.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("list_research_questions", () => {
  it("filters by sufficiency via researchQuestionList", async () => {
    byOperation(mockExecute, {
      ResearchQuestionList: (vars: unknown) => {
        expect((vars as { sufficiencyStatus: string }).sufficiencyStatus).toBe(
          "insufficient",
        );
        return {
          researchQuestionList: [
            {
              id: "rq1",
              displayId: 6,
              question: "Why churn at step 3?",
              sufficiencyStatus: "insufficient",
              signalCount: 2,
              sourceTypeCount: 1,
            },
          ],
        };
      },
    });

    const parsed = parse(
      await tools.get("list_research_questions")!(
        { sufficiency: "insufficient" },
        authCtx,
      ),
    );
    expect(parsed.items[0].displayId).toBe("RQ-6");
    expect(parsed.items[0].status).toBe("insufficient");
  });

  it("scopes by goal via researchQuestionsByGoal", async () => {
    byOperation(mockExecute, {
      ResearchQuestionsByGoal: { researchQuestionsByGoal: [] },
    });

    const parsed = parse(
      await tools.get("list_research_questions")!({ goalId: "GL-2" }, authCtx),
    );
    expect(parsed.items).toEqual([]);
  });
});

describe("get_activity", () => {
  it("maps filters onto activityStream and passes the native cursor through", async () => {
    byOperation(mockExecute, {
      ActivityStream: (vars: unknown) => {
        const v = vars as Record<string, unknown>;
        expect(v.actorType).toEqual(["agent"]);
        expect(v.entityType).toEqual(["insight"]);
        expect(v.after).toBe("cur-1");
        return {
          activityStream: {
            endCursor: "cur-2",
            hasNextPage: true,
            events: [
              {
                id: "e1",
                action: "created",
                actorType: "agent",
                agentName: "Analysis Agent",
                entityType: "insight",
                entityId: "i1",
                createdAt: "2026-07-13T10:00:00Z",
              },
            ],
          },
        };
      },
    });

    const parsed = parse(
      await tools.get("get_activity")!(
        {
          actorType: "agent",
          entityTypes: ["insight"],
          cursor: "cur-1",
        },
        authCtx,
      ),
    );

    expect(parsed.items[0].title).toContain("Analysis Agent created insight");
    expect(parsed.nextCursor).toBe("cur-2");
  });
});
