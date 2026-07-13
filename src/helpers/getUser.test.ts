import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryKv, setKvForTests } from "./kv.js";

const mockFetchUserMetadata = vi.fn();
const mockGetServiceToken = vi.fn();
const mockExecute = vi.fn();

vi.mock("./mintToken.js", () => ({
  getPropelAuthClient: () => ({
    fetchUserMetadataByUserId: mockFetchUserMetadata,
  }),
  getServiceToken: mockGetServiceToken,
}));

vi.mock("../lib/squad-api-client.js", () => ({
  execute: mockExecute,
}));

vi.mock("../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const {
  fetchWorkspaceDirectory,
  getUserContext,
  getWorkspaceSelection,
  WorkspaceSelectionRequired,
} = await import("./getUser.js");

const oneOrgMetadata = {
  orgIdToOrgInfo: {
    "pa-org-1": { orgId: "pa-org-1", orgName: "Acme" },
  },
};

function directoryResponse(workspaces: Array<Record<string, unknown>>) {
  return {
    organisations: [
      {
        id: "int-org-1",
        name: "Acme",
        slug: "acme",
        propelAuthOrgId: "pa-org-1",
      },
    ],
    workspaces,
  };
}

beforeEach(() => {
  setKvForTests(new MemoryKv());
  mockFetchUserMetadata.mockReset();
  mockGetServiceToken.mockReset();
  mockExecute.mockReset();
  mockGetServiceToken.mockResolvedValue("svc-jwt");
});

describe("getUserContext", () => {
  it("auto-selects and persists when exactly one workspace exists", async () => {
    mockFetchUserMetadata.mockResolvedValue(oneOrgMetadata);
    mockExecute.mockResolvedValue(
      directoryResponse([
        { id: "ws-1", name: "Main", slug: "main", organisationId: "int-org-1" },
      ]),
    );

    const ctx = await getUserContext("user-1");

    expect(ctx).toEqual({
      orgId: "pa-org-1",
      workspaceId: "ws-1",
      orgSlug: "acme",
      workspaceSlug: "main",
      token: "svc-jwt",
    });
    expect(mockGetServiceToken).toHaveBeenCalledWith("user-1", "pa-org-1");
    await expect(getWorkspaceSelection("user-1")).resolves.toEqual({
      orgId: "pa-org-1",
      workspaceId: "ws-1",
      orgSlug: "acme",
      workspaceSlug: "main",
    });
  });

  it("honours a stored selection without listing orgs", async () => {
    mockFetchUserMetadata.mockResolvedValue(oneOrgMetadata);
    mockExecute.mockResolvedValue(
      directoryResponse([
        { id: "ws-1", name: "Main", organisationId: "int-org-1" },
      ]),
    );
    await getUserContext("user-2");

    mockFetchUserMetadata.mockReset();
    mockExecute.mockReset();

    const ctx = await getUserContext("user-2");
    expect(ctx.workspaceId).toBe("ws-1");
    expect(mockFetchUserMetadata).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("throws WorkspaceSelectionRequired listing all options when several workspaces exist", async () => {
    mockFetchUserMetadata.mockResolvedValue(oneOrgMetadata);
    mockExecute.mockResolvedValue(
      directoryResponse([
        { id: "ws-1", name: "Main", organisationId: "int-org-1" },
        { id: "ws-2", name: "Sandbox", organisationId: "int-org-1" },
      ]),
    );

    const error = await getUserContext("user-3").then(
      () => {
        throw new Error("expected selection-required");
      },
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(WorkspaceSelectionRequired);
    const selection = error as InstanceType<typeof WorkspaceSelectionRequired>;
    expect(selection.orgs).toEqual([
      { id: "pa-org-1", name: "Acme", slug: "acme" },
    ]);
    expect(selection.workspaces?.map(w => w.id)).toEqual(["ws-1", "ws-2"]);
    expect(selection.workspaces?.[0].orgId).toBe("pa-org-1");
  });
});

describe("fetchWorkspaceDirectory", () => {
  it("maps workspaces onto PropelAuth org IDs and drops unresolvable ones", async () => {
    mockExecute.mockResolvedValue({
      organisations: [
        {
          id: "int-org-1",
          name: "Acme",
          slug: "acme",
          propelAuthOrgId: "pa-org-1",
        },
      ],
      workspaces: [
        { id: "ws-1", name: "Main", slug: "main", organisationId: "int-org-1" },
        { id: "ws-x", name: "Orphan", organisationId: "int-org-unknown" },
      ],
    });

    const directory = await fetchWorkspaceDirectory("user-1", "pa-org-1");

    expect(directory.workspaces).toEqual([
      {
        id: "ws-1",
        name: "Main",
        slug: "main",
        orgId: "pa-org-1",
        orgName: "Acme",
        orgSlug: "acme",
      },
    ]);
    const executeCtx = mockExecute.mock.calls[0][2];
    expect(executeCtx).toEqual({ token: "svc-jwt", workspaceId: "" });
  });
});
