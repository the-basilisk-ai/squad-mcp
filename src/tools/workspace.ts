import { z } from 'zod';
import { squadClient } from '../lib/clients/squad.js';
import { logger } from '../lib/logger.js';
import {
  getUserContext,
  listUserOrganisations,
  listOrgWorkspaces,
  setWorkspaceSelection,
  getWorkspaceSelection,
} from '../helpers/getUser.js';
import { type OAuthServer, getUserId, toolError, toolSuccess, WorkspaceSelectionRequired, formatWorkspaceSelectionError } from './helpers.js';

/**
 * Register workspace tools with the MCP server
 */
export function registerWorkspaceTools(server: OAuthServer) {
  // List available workspaces
  server.tool(
    {
      name: 'list_workspaces',
      description: 'List all organisations and workspaces available to the current user. Use this to see what workspaces you can switch to.',
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (_params, ctx) => {
      try {
        const userId = getUserId(ctx.auth);
        const token = ctx.auth.accessToken;

        const orgs = await listUserOrganisations(token);
        const result: Array<{
          org: { id: string; name: string };
          workspaces: Array<{ id: string; name: string }>;
        }> = [];

        for (const org of orgs) {
          const workspaces = await listOrgWorkspaces(token, org.id);
          result.push({ org, workspaces });
        }

        const currentSelection = getWorkspaceSelection(userId);

        return toolSuccess({
          currentSelection: currentSelection || null,
          available: result,
        });
      } catch (error) {
        logger.debug({ err: error, tool: 'list_workspaces' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to list workspaces: ${message}`);
      }
    }
  );

  // Select workspace
  server.tool(
    {
      name: 'select_workspace',
      description: 'Select which organisation and workspace to use for subsequent operations. Required when user has access to multiple orgs/workspaces.',
      schema: z.object({
        orgId: z.string().describe('The ID of the organisation to select'),
        workspaceId: z.string().describe('The ID of the workspace to select'),
      }),
    },
    async (params, ctx) => {
      try {
        const userId = getUserId(ctx.auth);
        const token = ctx.auth.accessToken;
        const { orgId, workspaceId } = params;

        // Verify the user has access to this org/workspace
        const orgs = await listUserOrganisations(token);
        const org = orgs.find(o => o.id === orgId);
        if (!org) {
          return toolError(`Organisation ${orgId} not found or you don't have access to it.`);
        }

        const workspaces = await listOrgWorkspaces(token, orgId);
        const workspace = workspaces.find(w => w.id === workspaceId);
        if (!workspace) {
          return toolError(`Workspace ${workspaceId} not found in organisation ${org.name}.`);
        }

        // Store the selection
        setWorkspaceSelection(userId, orgId, workspaceId);

        return toolSuccess({
          message: `Switched to workspace "${workspace.name}" in organisation "${org.name}"`,
          org: { id: orgId, name: org.name },
          workspace: { id: workspaceId, name: workspace.name },
        });
      } catch (error) {
        logger.debug({ err: error, tool: 'select_workspace' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to select workspace: ${message}`);
      }
    }
  );

  // Get Workspace
  server.tool(
    {
      name: 'get_workspace',
      description: 'Get details of the current workspace. Workspaces contain the project name, detailed description, and mission statement.',
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (_params, ctx) => {
      try {
        const userId = getUserId(ctx.auth);
        const userContext = await getUserContext(ctx.auth.accessToken, userId);
        const { orgId, workspaceId } = userContext;

        const workspace = await squadClient(userContext).getWorkspace({
          orgId,
          workspaceId,
        });

        return toolSuccess(workspace);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'get_workspace' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to retrieve workspace: ${message}`);
      }
    }
  );

  // Update Workspace
  server.tool(
    {
      name: 'update_workspace',
      description: 'Update the current workspace\'s details such as name, description, mission statement.',
      schema: z.object({
        name: z.string().optional().describe('Updated name for the workspace'),
        homepageUrl: z.string().optional().describe('Updated URL to the workspace\'s homepage'),
        logoUrl: z.string().optional().describe('Updated URL to the workspace\'s logo'),
        missionStatement: z.string().optional().describe('Updated mission statement for the workspace'),
        description: z.string().optional().describe('Updated detailed description of the workspace'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userId = getUserId(ctx.auth);
        const userContext = await getUserContext(ctx.auth.accessToken, userId);
        const { orgId, workspaceId } = userContext;

        const workspace = await squadClient(userContext).updateWorkspace({
          orgId,
          workspaceId,
          updateWorkspacePayload: params,
        });

        return toolSuccess(workspace);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'update_workspace' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to update workspace: ${message}`);
      }
    }
  );
}
