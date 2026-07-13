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

const { registerActionWriteTools } = await import("./actions-write.js");
const tools = captureTools(registerActionWriteTools);

const echoAction = {
  id: "uuid-a1",
  displayId: 12,
  title: "Fix onboarding",
  status: "completed",
};

beforeEach(() => {
  mockExecute.mockReset();
  mockGetUserContext.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("update_action_status", () => {
  it.each([
    ["start", "StartAction", { id: "uuid-a1" }],
    ["complete", "MarkActionDone", { id: "uuid-a1" }],
    ["dismiss", "DismissAction", { actionId: "uuid-a1" }],
    ["snooze", "SnoozeAction", { actionId: "uuid-a1" }],
  ])("%s resolves AC- to the uuid and calls %s", async (status, op, vars) => {
    mockExecute.mockImplementation((doc: never, v: unknown) => {
      const name = opName(doc);
      if (name === "GetAction")
        return Promise.resolve({
          action: { id: "uuid-a1", displayId: 12, notes: null },
        });
      expect(name).toBe(op);
      expect(v).toEqual(vars);
      const field = name.charAt(0).toLowerCase() + name.slice(1);
      return Promise.resolve({ [field]: echoAction });
    });

    const result = await tools.get("update_action_status")!(
      { actionId: "AC-12", status },
      authCtx,
    );
    expect(parse(result).action.displayId).toBe("AC-12");
  });

  it("appends the note to existing notes after the transition", async () => {
    const calls: Array<{ name: string; vars: unknown }> = [];
    mockExecute.mockImplementation((doc: never, vars: unknown) => {
      const name = opName(doc);
      calls.push({ name, vars });
      if (name === "GetAction")
        return Promise.resolve({
          action: { id: "uuid-a1", displayId: 12, notes: "existing" },
        });
      if (name === "MarkActionDone")
        return Promise.resolve({ markActionDone: echoAction });
      if (name === "UpdateActionNotes")
        return Promise.resolve({
          updateActionNotes: {
            ...echoAction,
            notes: "existing\n\nshipped in PR #99",
          },
        });
      throw new Error(`unexpected ${name}`);
    });

    const parsed = parse(
      await tools.get("update_action_status")!(
        { actionId: "AC-12", status: "complete", note: "shipped in PR #99" },
        authCtx,
      ),
    );

    const notesCall = calls.find(c => c.name === "UpdateActionNotes");
    expect(notesCall?.vars).toEqual({
      actionId: "uuid-a1",
      notes: "existing\n\nshipped in PR #99",
    });
    expect(parsed.action.notes).toContain("PR #99");
  });

  it("errors cleanly when the action does not exist", async () => {
    byOperation(mockExecute, { GetAction: { action: null } });
    const result = await tools.get("update_action_status")!(
      { actionId: "AC-999", status: "start" },
      authCtx,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("AC-999");
  });
});

describe("update_action", () => {
  it("requires at least one field", async () => {
    byOperation(mockExecute, {
      GetAction: { action: { id: "uuid-a1", displayId: 12, notes: null } },
    });
    const result = await tools.get("update_action")!(
      { actionId: "AC-12" },
      authCtx,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("at least one field");
  });

  it('assigns "me" to the calling user', async () => {
    mockExecute.mockImplementation((doc: never, vars: unknown) => {
      const name = opName(doc);
      if (name === "GetAction")
        return Promise.resolve({
          action: { id: "uuid-a1", displayId: 12, notes: null },
        });
      expect(name).toBe("AssignAction");
      expect(vars).toEqual({ actionId: "uuid-a1", assigneeUserId: "user-1" });
      return Promise.resolve({ assignAction: echoAction });
    });

    const result = await tools.get("update_action")!(
      { actionId: "AC-12", assignee: "me" },
      authCtx,
    );
    expect(result.isError).toBeUndefined();
  });
});
