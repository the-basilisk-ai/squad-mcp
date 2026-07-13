import { z } from "zod";
import {
  fetchWorkspaceDirectory,
  getWorkspaceSelection,
  listUserOrganisations,
  setWorkspaceSelection,
} from "../helpers/getUser.js";
import { logger } from "../lib/logger.js";
import {
  formatApiError,
  getUserId,
  type OAuthServer,
  toolError,
  toolSuccess,
} from "./helpers.js";

const MIGRATION_MESSAGE =
  "This tool is temporarily unavailable while the server is rebuilt for the new Squad platform. It returns later in this release.";

/**
 * Register workspace tools with the MCP server
 */
export function registerWorkspaceTools(server: OAuthServer) {
  // List available workspaces
  server.tool(
    {
      name: "list_workspaces",
      title: "List Workspaces",
      description:
        "List all organisations and workspaces available to the current user. Use this to see what workspaces you can switch to.",
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (_params, ctx) => {
      try {
        const userId = getUserId(ctx.auth);

        const orgs = await listUserOrganisations(userId);
        if (orgs.length === 0) {
          return toolError(
            "No organisations found for this user. Please create one in the Squad app first.",
          );
        }

        const directory = await fetchWorkspaceDirectory(userId, orgs[0].id);
        const available = directory.orgs.map(org => ({
          org,
          workspaces: directory.workspaces
            .filter(ws => ws.orgId === org.id)
            .map(ws => ({ id: ws.id, name: ws.name })),
        }));
        const currentSelection = await getWorkspaceSelection(userId);

        return toolSuccess({
          currentSelection: currentSelection ?? null,
          available,
        });
      } catch (error) {
        logger.debug({ err: error, tool: "list_workspaces" }, "Tool error");
        const message = await formatApiError(error);
        return toolError(`Unable to list workspaces: ${message}`);
      }
    },
  );

  // Select workspace
  server.tool(
    {
      name: "select_workspace",
      title: "Select Workspace",
      description:
        "Select which organisation and workspace to use for subsequent operations. Required when user has access to multiple orgs/workspaces.",
      schema: z.object({
        orgId: z.string().describe("The ID of the organisation to select"),
        workspaceId: z.string().describe("The ID of the workspace to select"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params, ctx) => {
      try {
        const userId = getUserId(ctx.auth);
        const { orgId, workspaceId } = params;

        const orgs = await listUserOrganisations(userId);
        const org = orgs.find(o => o.id === orgId);
        if (!org) {
          return toolError(
            `Organisation ${orgId} not found or you don't have access to it.`,
          );
        }

        const directory = await fetchWorkspaceDirectory(userId, orgId);
        const workspace = directory.workspaces.find(
          ws => ws.id === workspaceId && ws.orgId === orgId,
        );
        if (!workspace) {
          return toolError(
            `Workspace ${workspaceId} not found in organisation ${org.name}.`,
          );
        }

        await setWorkspaceSelection(userId, orgId, workspaceId);

        return toolSuccess({
          message: `Switched to workspace "${workspace.name}" in organisation "${org.name}"`,
          org: { id: orgId, name: org.name },
          workspace: { id: workspaceId, name: workspace.name },
        });
      } catch (error) {
        logger.debug({ err: error, tool: "select_workspace" }, "Tool error");
        const message = await formatApiError(error);
        return toolError(`Unable to select workspace: ${message}`);
      }
    },
  );

  // Get Workspace
  server.tool(
    {
      name: "get_workspace",
      title: "Get Workspace Details",
      description:
        "Get details of the current workspace. Workspaces contain the project name, detailed description, and mission statement.",
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => toolError(MIGRATION_MESSAGE),
  );

  // Update Workspace
  server.tool(
    {
      name: "update_workspace",
      title: "Update Workspace",
      description:
        "Update the current workspace's details such as name, description, mission statement.",
      schema: z
        .object({
          name: z
            .string()
            .optional()
            .describe("Updated name for the workspace"),
          homepageUrl: z
            .string()
            .optional()
            .describe("Updated URL to the workspace's homepage"),
          logoUrl: z
            .string()
            .optional()
            .describe("Updated URL to the workspace's logo"),
          missionStatement: z
            .string()
            .optional()
            .describe("Updated mission statement for the workspace"),
          description: z
            .string()
            .optional()
            .describe("Updated detailed description of the workspace"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => toolError(MIGRATION_MESSAGE),
  );
}
