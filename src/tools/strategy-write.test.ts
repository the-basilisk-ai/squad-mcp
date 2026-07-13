import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authCtx,
  byOperation,
  captureTools,
  opName,
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

const { registerStrategyWriteTools } = await import("./strategy-write.js");
const tools = captureTools(registerStrategyWriteTools);

beforeEach(() => {
  mockExecute.mockReset();
  mockGetUserContext.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("create_goal", () => {
  it("maps description to content with default importance", async () => {
    byOperation(mockExecute, {
      CreateGoal: (vars: unknown) => {
        expect(vars).toEqual({
          input: {
            title: "Reduce churn",
            content: "Cut churn in half",
            importance: 3,
          },
        });
        return {
          createGoal: {
            id: "g1",
            displayId: 7,
            title: "Reduce churn",
            importance: 3,
          },
        };
      },
    });

    const parsed = parse(
      await tools.get("create_goal")!(
        { title: "Reduce churn", description: "Cut churn in half" },
        authCtx,
      ),
    );
    expect(parsed.goal.displayId).toBe("GL-7");
  });
});

describe("update_insight", () => {
  it("links a goal with the SUPPORTS_GOAL edge", async () => {
    const calls: Array<{ name: string; vars: unknown }> = [];
    mockExecute.mockImplementation((doc: never, vars: unknown) => {
      const name = opName(doc);
      calls.push({ name, vars });
      if (name === "GetInsight")
        return Promise.resolve({
          insight: { id: "uuid-i1", displayId: 4, title: "T" },
        });
      if (name === "GetGoal")
        return Promise.resolve({ goal: { id: "uuid-g1" } });
      if (name === "LinkEntities")
        return Promise.resolve({ linkEntities: { success: true } });
      throw new Error(`unexpected ${name}`);
    });

    const parsed = parse(
      await tools.get("update_insight")!(
        { insightId: "IN-4", linkGoalId: "GL-7" },
        authCtx,
      ),
    );

    const link = calls.find(c => c.name === "LinkEntities");
    expect(link?.vars).toEqual({
      input: {
        sourceType: "Insight",
        sourceId: "uuid-i1",
        targetType: "Goal",
        targetId: "uuid-g1",
        edgeLabel: "SUPPORTS_GOAL",
      },
    });
    expect(parsed.message).toContain("goal linked");
  });

  it("surfaces link failures", async () => {
    mockExecute.mockImplementation((doc: never) => {
      const name = opName(doc);
      if (name === "GetInsight")
        return Promise.resolve({ insight: { id: "uuid-i1", displayId: 4 } });
      if (name === "GetGoal")
        return Promise.resolve({ goal: { id: "uuid-g1" } });
      return Promise.resolve({
        linkEntities: { success: false, error: "duplicate edge" },
      });
    });

    const result = await tools.get("update_insight")!(
      { insightId: "IN-4", linkGoalId: "GL-7" },
      authCtx,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("duplicate edge");
  });
});

describe("dismiss_signal", () => {
  it("resolves the display ID and deletes by uuid", async () => {
    const calls: Array<{ name: string; vars: unknown }> = [];
    mockExecute.mockImplementation((doc: never, vars: unknown) => {
      const name = opName(doc);
      calls.push({ name, vars });
      if (name === "GetSignal")
        return Promise.resolve({ signal: { id: "uuid-s1", displayId: 9 } });
      return Promise.resolve({ deleteSignal: true });
    });

    const parsed = parse(
      await tools.get("dismiss_signal")!(
        { signalId: "SI-9", reason: "spam" },
        authCtx,
      ),
    );

    expect(calls[1]).toEqual({
      name: "DeleteSignal",
      vars: { id: "uuid-s1" },
    });
    expect(parsed.message).toContain("SI-9");
    expect(parsed.message).toContain("permanently");
    expect(parsed.reason).toBe("spam");
  });
});
