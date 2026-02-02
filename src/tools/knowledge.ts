import { z } from 'zod';
import { squadClient } from '../lib/clients/squad.js';
import { logger } from '../lib/logger.js';
import { getUserContext } from '../helpers/getUser.js';
import { type OAuthServer, getUserId, toolError, toolSuccess, WorkspaceSelectionRequired, formatWorkspaceSelectionError } from './helpers.js';

/**
 * Register knowledge tools with the MCP server
 */
export function registerKnowledgeTools(server: OAuthServer) {
  // Create Knowledge
  server.tool(
    {
      name: 'create_knowledge',
      description: 'Create a new knowledge entry. Knowledge entries are text documents that can be used as references or information sources.',
      schema: z.object({
        title: z.string().describe('A short title for the knowledge'),
        description: z.string().describe('A short summary of the knowledge content'),
        content: z.string().describe('The full content of the knowledge'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const result = await squadClient(userContext).createKnowledge({
          orgId,
          workspaceId,
          createKnowledgePayload: {
            title: params.title,
            description: params.description,
            content: params.content,
          },
        });

        return toolSuccess(result);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'create_knowledge_document' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to create knowledge: ${message}`);
      }
    }
  );

  // List Knowledge
  server.tool(
    {
      name: 'list_knowledge',
      description: 'List all knowledge entries in the workspace. Knowledge entries are text documents that can be used as references or information sources. List only shows the available items and a short description for the actual knowledge use the get by id call.',
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (_params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const knowledge = await squadClient(userContext).listKnowledge({
          orgId,
          workspaceId,
        });

        if (knowledge.data.length === 0) {
          return toolSuccess({ message: 'No knowledge entries found.' });
        }

        return toolSuccess(knowledge);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'list_knowledge_documents' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to list knowledge: ${message}`);
      }
    }
  );

  // Get Knowledge
  server.tool(
    {
      name: 'get_knowledge',
      description: 'Get details of a specific knowledge entry by ID. Knowledge entries are text documents that can be used as references or information sources.',
      schema: z.object({
        knowledgeId: z.string().describe('The ID of the knowledge entry to retrieve'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const knowledge = await squadClient(userContext).getKnowledge({
          orgId,
          workspaceId,
          knowledgeId: params.knowledgeId,
        });

        return toolSuccess(knowledge);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'get_knowledge_document' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to get knowledge: ${message}`);
      }
    }
  );

  // Delete Knowledge
  server.tool(
    {
      name: 'delete_knowledge',
      description: 'Delete a knowledge entry by ID.',
      schema: z.object({
        knowledgeId: z.string().describe('The ID of the knowledge entry to delete'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const result = await squadClient(userContext).deleteKnowledge({
          orgId,
          workspaceId,
          knowledgeId: params.knowledgeId,
        });

        return toolSuccess(result);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'delete_knowledge_document' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to delete knowledge: ${message}`);
      }
    }
  );
}
