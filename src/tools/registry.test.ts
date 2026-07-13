import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { SquadApiError } from "../lib/squad-api-client.js";

const mockGetUserContext = vi.fn();
const mockGetWorkspaceSelection = vi.fn();
const mockClearWorkspaceSelection = vi.fn();

vi.mock("../helpers/getUser.js", async importOriginal => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    getUserContext: mockGetUserContext,
    getWorkspaceSelection: mockGetWorkspaceSelection,
    clearWorkspaceSelection: mockClearWorkspaceSelection,
  };
});

vi.mock("../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const { WorkspaceSelectionRequired } = await import("../helpers/getUser.js");
const { registerTool } = await import("./registry.js");

type Captured = {
  def: {
    name: string;
    annotations: Record<string, boolean>;
  };
  handler: (
    params: unknown,
    ctx: unknown,
  ) => Promise<{
    content: { text: string }[];
    isError?: true;
  }>;
};

function fakeServer() {
  const captured: Captured[] = [];
  return {
    server: {
      tool: (def: Captured["def"], handler: Captured["handler"]) => {
        captured.push({ def, handler });
      },
    },
    captured,
  };
}

const authCtx = (scope?: string) => ({
  auth: {
    accessToken: "at",
    payload: { sub: "user-1", ...(scope ? { scope } : {}) },
  },
});

beforeEach(() => {
  mockGetUserContext.mockReset();
  mockGetWorkspaceSelection.mockReset();
  mockClearWorkspaceSelection.mockReset();
});

describe("registerTool", () => {
  it("derives annotations from scope and passes results through", async () => {
    const { server, captured } = fakeServer();
    registerTool(server as never, {
      name: "list_things",
      title: "List Things",
      description: "d",
      schema: z.object({}),
      scope: "read",
      handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
    });

    expect(captured[0].def.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    });
    const result = await captured[0].handler({}, authCtx());
    expect(result.content[0].text).toBe("ok");
  });

  it("blocks write tools when the token lacks write:workspace", async () => {
    const { server, captured } = fakeServer();
    const handler = vi.fn();
    registerTool(server as never, {
      name: "update_thing",
      title: "Update",
      description: "d",
      schema: z.object({}),
      scope: "write",
      handler,
    });

    const result = await captured[0].handler(
      {},
      authCtx("read:workspace openid"),
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("write:workspace");
    expect(handler).not.toHaveBeenCalled();
  });

  it("formats WorkspaceSelectionRequired with the available options", async () => {
    const { server, captured } = fakeServer();
    registerTool(server as never, {
      name: "read_thing",
      title: "Read",
      description: "d",
      schema: z.object({}),
      scope: "read",
      handler: async () => {
        throw new WorkspaceSelectionRequired(
          "Pick one.",
          [{ id: "org-1", name: "Acme" }],
          [
            {
              id: "ws-1",
              name: "Main",
              slug: "main",
              orgId: "org-1",
              orgName: "Acme",
              orgSlug: "acme",
            },
          ],
        );
      },
    });

    const result = await captured[0].handler({}, authCtx());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Acme (org-1)");
    expect(result.content[0].text).toContain("Main (ws-1)");
  });

  it("clears a stale selection on backend 403 and instructs recovery", async () => {
    const { server, captured } = fakeServer();
    mockGetWorkspaceSelection.mockResolvedValue({
      orgId: "org-1",
      workspaceId: "ws-1",
      orgSlug: "acme",
      workspaceSlug: "main",
    });
    registerTool(server as never, {
      name: "read_thing",
      title: "Read",
      description: "d",
      schema: z.object({}),
      scope: "read",
      handler: async () => {
        throw new SquadApiError("Authentication failed.", 403);
      },
    });

    const result = await captured[0].handler({}, authCtx());
    expect(mockClearWorkspaceSelection).toHaveBeenCalledWith("user-1");
    expect(result.content[0].text).toContain("select_workspace");
  });
});
