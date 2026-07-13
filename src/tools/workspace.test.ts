import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecute = vi.fn();
const mockGetUserContext = vi.fn();
const mockListUserOrganisations = vi.fn();
const mockFetchWorkspaceDirectory = vi.fn();
const mockGetWorkspaceSelection = vi.fn();
const mockSetWorkspaceSelection = vi.fn();

vi.mock("../lib/squad-api-client.js", async importOriginal => ({
  ...(await importOriginal<object>()),
  execute: mockExecute,
}));

vi.mock("../helpers/getUser.js", async importOriginal => ({
  ...(await importOriginal<object>()),
  getUserContext: mockGetUserContext,
  listUserOrganisations: mockListUserOrganisations,
  fetchWorkspaceDirectory: mockFetchWorkspaceDirectory,
  getWorkspaceSelection: mockGetWorkspaceSelection,
  setWorkspaceSelection: mockSetWorkspaceSelection,
}));

vi.mock("../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const { registerWorkspaceTools } = await import("./workspace.js");

type Handler = (
  params: unknown,
  ctx: unknown,
) => Promise<{ content: { text: string }[]; isError?: true }>;

const tools = new Map<string, Handler>();
registerWorkspaceTools({
  tool: (def: { name: string }, handler: Handler) => {
    tools.set(def.name, handler);
  },
} as never);

const authCtx = {
  auth: {
    accessToken: "at",
    payload: { sub: "user-1", scope: "read:workspace write:workspace" },
  },
};

const userCtx = {
  orgId: "pa-org-1",
  workspaceId: "ws-1",
  orgSlug: "acme",
  workspaceSlug: "main",
  token: "svc-jwt",
};

function parse(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  mockExecute.mockReset();
  mockGetUserContext.mockReset();
  mockListUserOrganisations.mockReset();
  mockFetchWorkspaceDirectory.mockReset();
  mockGetWorkspaceSelection.mockReset();
  mockSetWorkspaceSelection.mockReset();
  mockGetUserContext.mockResolvedValue(userCtx);
});

describe("get_workspace_overview", () => {
  it("composes all sections with display IDs and a deep link", async () => {
    mockExecute.mockResolvedValue({
      workspaces: [
        {
          name: "Main",
          description: "Desc",
          missionStatement: "Mission",
          onboardingStatus: "complete",
        },
      ],
      goalList: [
        { id: "g1", displayId: 3, title: "Reduce churn", importance: 5 },
      ],
      signalActivitySummary: [{ source: "slack", count: 12 }],
      chainHealth: { signalCount: 40, insightCount: 6 },
      openActions: [{ id: "a1" }, { id: "a2" }],
      pendingBriefs: [{ id: "d1" }],
    });

    const result = await tools.get("get_workspace_overview")!({}, authCtx);
    const parsed = parse(result);

    expect(parsed.workspace.missionStatement).toBe("Mission");
    expect(parsed.topGoals[0]).toEqual({
      displayId: "GL-3",
      title: "Reduce churn",
      importance: 5,
    });
    expect(parsed.signalActivityLast7Days).toEqual([
      { source: "slack", count: 12 },
    ]);
    expect(parsed.openActionCount).toBe(2);
    expect(parsed.pendingDecisionBriefCount).toBe(1);
    expect(parsed.link).toBe("https://app.meetsquad.ai/acme/main");
  });

  it("degrades gracefully on an empty workspace", async () => {
    mockExecute.mockResolvedValue({
      workspaces: [{ name: "Fresh", missionStatement: null }],
      goalList: [],
      signalActivitySummary: [],
      chainHealth: null,
      openActions: [],
      pendingBriefs: [],
    });

    const result = await tools.get("get_workspace_overview")!({}, authCtx);
    const parsed = parse(result);

    expect(result.isError).toBeUndefined();
    expect(parsed.topGoals.note).toMatch(/No goals yet/);
    expect(parsed.chainHealth.note).toBeDefined();
    expect(parsed.suggestedNextTools?.[0]).toContain("update_workspace");
  });
});

describe("select_workspace", () => {
  it("rejects a workspace outside the chosen org, naming list_workspaces", async () => {
    mockListUserOrganisations.mockResolvedValue([
      { id: "pa-org-1", name: "Acme" },
    ]);
    mockFetchWorkspaceDirectory.mockResolvedValue({
      orgs: [{ id: "pa-org-1", name: "Acme" }],
      workspaces: [
        {
          id: "ws-1",
          name: "Main",
          slug: "main",
          orgId: "pa-org-1",
          orgName: "Acme",
          orgSlug: "acme",
        },
      ],
    });

    const result = await tools.get("select_workspace")!(
      { orgId: "pa-org-1", workspaceId: "ws-nope" },
      authCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("list_workspaces");
    expect(mockSetWorkspaceSelection).not.toHaveBeenCalled();
  });

  it("persists a valid selection with slugs", async () => {
    mockListUserOrganisations.mockResolvedValue([
      { id: "pa-org-1", name: "Acme" },
    ]);
    mockFetchWorkspaceDirectory.mockResolvedValue({
      orgs: [{ id: "pa-org-1", name: "Acme" }],
      workspaces: [
        {
          id: "ws-1",
          name: "Main",
          slug: "main",
          orgId: "pa-org-1",
          orgName: "Acme",
          orgSlug: "acme",
        },
      ],
    });

    const result = await tools.get("select_workspace")!(
      { orgId: "pa-org-1", workspaceId: "ws-1" },
      authCtx,
    );

    expect(result.isError).toBeUndefined();
    expect(mockSetWorkspaceSelection).toHaveBeenCalledWith("user-1", {
      orgId: "pa-org-1",
      workspaceId: "ws-1",
      orgSlug: "acme",
      workspaceSlug: "main",
    });
  });
});

describe("update_workspace", () => {
  it("targets the current workspace and echoes the update", async () => {
    mockExecute.mockResolvedValue({
      updateWorkspaces: {
        workspaces: [
          {
            name: "Renamed",
            description: "D",
            missionStatement: "M",
            logoUrl: null,
          },
        ],
      },
    });

    const result = await tools.get("update_workspace")!(
      { name: "Renamed" },
      authCtx,
    );
    const parsed = parse(result);

    const [, variables] = mockExecute.mock.calls[0];
    expect(variables).toEqual({
      where: { id: { eq: "ws-1" } },
      update: { name: "Renamed" },
    });
    expect(parsed.workspace.name).toBe("Renamed");
    expect(parsed.link).toBe("https://app.meetsquad.ai/acme/main/settings");
  });
});
