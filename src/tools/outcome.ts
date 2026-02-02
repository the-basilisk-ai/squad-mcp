import { z } from 'zod';
import { squadClient } from '../lib/clients/squad.js';
import { logger } from '../lib/logger.js';
import { getUserContext } from '../helpers/getUser.js';
import { type OAuthServer, getUserId, toolError, toolSuccess, WorkspaceSelectionRequired, formatWorkspaceSelectionError } from './helpers.js';
import { RelationshipAction, type CreateOutcomePayload } from '../lib/openapi/squad/models/index.js';

/**
 * Register outcome tools with the MCP server
 */
export function registerOutcomeTools(server: OAuthServer) {
  // Create Outcome
  server.tool(
    {
      name: 'create_outcome',
      description: 'Create a new outcome. An outcome is a business objective or goal that the organization aims to achieve.',
      schema: z.object({
        title: z.string().describe('A short title for the outcome'),
        description: z.string().describe('A detailed description of the outcome'),
        priority: z.number().optional().describe('Priority level of the outcome (numeric)'),
        trend: z.number().optional().describe('Trend indicator for the outcome (numeric)'),
        analyticEvents: z.array(z.string()).optional().describe('List of analytic events associated with the outcome'),
        hideContent: z.boolean().optional().describe('Whether the outcome content should be hidden'),
        ownerId: z.string().optional().describe('ID of the outcome owner'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const outcomePayload: CreateOutcomePayload = {
          title: params.title,
          description: params.description,
          priority: params.priority ?? 0,
          trend: params.trend,
          analyticEvents: params.analyticEvents,
          ownerId: params.ownerId,
        };

        const result = await squadClient(userContext).createOutcome({
          orgId,
          workspaceId,
          createOutcomePayload: outcomePayload,
        });

        return toolSuccess(result);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'create_outcome' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to create outcome: ${message}`);
      }
    }
  );

  // List Outcomes
  server.tool(
    {
      name: 'list_outcomes',
      description: 'List all outcomes in the workspace. Outcomes are business objectives or goals that the organization aims to achieve.',
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (_params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const outcomes = await squadClient(userContext).listOutcomes({
          orgId,
          workspaceId,
        });

        if (outcomes.data.length === 0) {
          return toolSuccess({ message: 'No outcomes found.' });
        }

        return toolSuccess(outcomes);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'list_outcomes' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to list outcomes: ${message}`);
      }
    }
  );

  // Get Outcome
  server.tool(
    {
      name: 'get_outcome',
      description: 'Get details of a specific outcome by ID. Outcomes are business objectives or goals that the organization aims to achieve.',
      schema: z.object({
        outcomeId: z.string().describe('The ID of the outcome to retrieve'),
        relationships: z
          .array(z.enum(['opportunities', 'solutions', 'insights']))
          .optional()
          .default([])
          .describe('Relationships to include in the response. Opportunities are problem statements identified for the organisation. Solutions are proposed approaches to address opportunities. Feedback is additional information or insights related to the opportunity.'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const outcome = await squadClient(userContext).getOutcome({
          orgId,
          workspaceId,
          outcomeId: params.outcomeId,
          relationships: params.relationships.join(','),
        });

        return toolSuccess(outcome);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'get_outcome' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to get outcome: ${message}`);
      }
    }
  );

  // Update Outcome
  server.tool(
    {
      name: 'update_outcome',
      description: 'Update an existing outcome\'s details.',
      schema: z.object({
        outcomeId: z.string().describe('The ID of the outcome to update'),
        title: z.string().optional().describe('Updated title'),
        description: z.string().optional().describe('Updated description'),
        priority: z.number().optional().describe('Updated priority level'),
        trend: z.number().optional().describe('Updated trend indicator'),
        analyticEvents: z.array(z.string()).optional().describe('Updated list of analytic events'),
        hideContent: z.boolean().optional().describe('Whether the outcome content should be hidden'),
        ownerId: z.string().optional().describe('Updated ID of the outcome owner'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;
        const { outcomeId, ...updatePayload } = params;

        const outcome = await squadClient(userContext).updateOutcome({
          orgId,
          workspaceId,
          outcomeId,
          updateOutcomePayload: updatePayload,
        });

        return toolSuccess(outcome);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'update_outcome' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to update outcome: ${message}`);
      }
    }
  );

  // Delete Outcome
  server.tool(
    {
      name: 'delete_outcome',
      description: 'Delete an outcome by ID.',
      schema: z.object({
        outcomeId: z.string().describe('The ID of the outcome to delete'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        await squadClient(userContext).deleteOutcome({
          orgId,
          workspaceId,
          outcomeId: params.outcomeId,
        });

        return toolSuccess({ data: { id: params.outcomeId } });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'delete_outcome' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to delete outcome: ${message}`);
      }
    }
  );

  // Manage Outcome Relationships
  server.tool(
    {
      name: 'manage_outcome_relationships',
      description: 'Add or remove relationships between an outcome and opportunities for the business.',
      schema: z.object({
        outcomeId: z.string().describe('The ID of the outcome to manage relationships for'),
        action: z.enum(['add', 'remove']).describe('Whether to add or remove the relationships'),
        opportunityIds: z.array(z.string()).optional().describe('IDs of opportunities to relate to this outcome'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        await squadClient(userContext).manageOutcomeRelationships({
          orgId,
          workspaceId,
          outcomeId: params.outcomeId,
          action: params.action as RelationshipAction,
          outcomeRelationshipsPayload: {
            opportunityIds: params.opportunityIds || [],
          },
        });

        // Return updated outcome
        const updatedOutcome = await squadClient(userContext).getOutcome({
          orgId,
          workspaceId,
          outcomeId: params.outcomeId,
        });

        return toolSuccess(updatedOutcome);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'manage_outcome_relationships' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to manage outcome relationships: ${message}`);
      }
    }
  );
}
