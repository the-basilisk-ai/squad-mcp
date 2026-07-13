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

const { registerResearchWriteTools } = await import("./research-write.js");
const tools = captureTools(registerResearchWriteTools);
const createRq = tools.get("create_research_question")!;

beforeEach(() => {
  mockExecute.mockReset();
  mockGetUserContext.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("create_research_question", () => {
  it("short-circuits on a near-duplicate question", async () => {
    mockExecute.mockImplementation((doc: never) => {
      expect(opName(doc)).toBe("ResearchQuestionList");
      return Promise.resolve({
        researchQuestionList: [
          {
            id: "rq1",
            displayId: 6,
            question: "Why do users churn at step 3 of onboarding?",
            sufficiencyStatus: "insufficient",
          },
        ],
      });
    });

    const parsed = parse(
      await createRq(
        { question: "Why are users churning at step 3 in onboarding??" },
        authCtx,
      ),
    );
    expect(parsed.deduplicated).toBe(true);
    expect(parsed.researchQuestion.displayId).toBe("RQ-6");
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("creates a distinct question with resolved goal uuid", async () => {
    const calls: Array<{ name: string; vars: unknown }> = [];
    mockExecute.mockImplementation((doc: never, vars: unknown) => {
      const name = opName(doc);
      calls.push({ name, vars });
      if (name === "ResearchQuestionList")
        return Promise.resolve({ researchQuestionList: [] });
      if (name === "GetGoal")
        return Promise.resolve({ goal: { id: "uuid-g1" } });
      return Promise.resolve({
        createResearchQuestion: {
          id: "rq2",
          displayId: 7,
          question: "What drives expansion revenue?",
          sufficiencyStatus: "insufficient",
        },
      });
    });

    const parsed = parse(
      await createRq(
        {
          question: "What drives expansion revenue?",
          goalId: "GL-2",
          rationale: "Pricing work depends on it",
        },
        authCtx,
      ),
    );

    const create = calls.find(c => c.name === "CreateResearchQuestion");
    expect(create?.vars).toEqual({
      question: "What drives expansion revenue?",
      goalId: "uuid-g1",
      category: undefined,
      rationale: "Pricing work depends on it",
    });
    expect(parsed.researchQuestion.displayId).toBe("RQ-7");
  });
});
