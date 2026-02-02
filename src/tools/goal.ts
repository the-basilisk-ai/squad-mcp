import { z } from 'zod';
import { squadClient } from '../lib/clients/squad.js';
import { logger } from '../lib/logger.js';
import { getUserContext } from '../helpers/getUser.js';
import { type OAuthServer, getUserId, toolError, toolSuccess, WorkspaceSelectionRequired, formatWorkspaceSelectionError } from './helpers.js';
import { RelationshipAction, type CreateOutcomePayload } from '../lib/openapi/squad/models/index.js';

/**
 * Register goal tools with the MCP server
 * Note: "Goal" is the user-facing term for what the API calls "Outcome"
 */
export function registerGoalTools(server: OAuthServer) {
  // Create Goal
  server.tool(
    {
      name: 'create_goal',
      description: 'Create a new goal. A goal is a business objective that the organization aims to achieve.',
      schema: z.object({
        title: z.string().describe('A short title for the goal'),
        description: z.string().describe('A detailed description of the goal'),
        priority: z.number().optional().describe('Priority level of the goal (numeric)'),
        trend: z.number().optional().describe('Trend indicator for the goal (numeric)'),
        analyticEvents: z.array(z.string()).optional().describe('List of analytic events associated with the goal'),
        hideContent: z.boolean().optional().describe('Whether the goal content should be hidden'),
        ownerId: z.string().optional().describe('ID of the goal owner'),
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

        return toolSuccess({
          id: result.id,
          title: result.title,
          message: 'Goal created successfully',
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'create_goal' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to create goal: ${message}`);
      }
    }
  );

  // List Goals
  server.tool(
    {
      name: 'list_goals',
      description: 'List all goals in the workspace. Goals are business objectives that the organization aims to achieve.',
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
          return toolSuccess({ message: 'No goals found.' });
        }

        // Return summaries to reduce token usage - use get_goal for full details
        return toolSuccess({
          count: outcomes.data.length,
          items: outcomes.data.map(o => ({
            id: o.id,
            title: o.title,
            priority: o.priority,
          })),
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'list_goals' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to list goals: ${message}`);
      }
    }
  );

  // Get Goal
  server.tool(
    {
      name: 'get_goal',
      description: 'Get details of a specific goal by ID. Goals are business objectives that the organization aims to achieve.',
      schema: z.object({
        goalId: z.string().describe('The ID of the goal to retrieve'),
        relationships: z
          .array(z.enum(['opportunities', 'solutions', 'insights']))
          .optional()
          .default([])
          .describe('Relationships to include in the response. Opportunities are problem statements identified for the organisation. Solutions are proposed approaches to address opportunities. Insights are additional information related to the opportunity.'),
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
          outcomeId: params.goalId,
          relationships: params.relationships.join(','),
        });

        return toolSuccess(outcome);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'get_goal' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to get goal: ${message}`);
      }
    }
  );

  // Update Goal
  server.tool(
    {
      name: 'update_goal',
      description: 'Update an existing goal\'s details.',
      schema: z.object({
        goalId: z.string().describe('The ID of the goal to update'),
        title: z.string().optional().describe('Updated title'),
        description: z.string().optional().describe('Updated description'),
        priority: z.number().optional().describe('Updated priority level'),
        trend: z.number().optional().describe('Updated trend indicator'),
        analyticEvents: z.array(z.string()).optional().describe('Updated list of analytic events'),
        hideContent: z.boolean().optional().describe('Whether the goal content should be hidden'),
        ownerId: z.string().optional().describe('Updated ID of the goal owner'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;
        const { goalId, ...updatePayload } = params;

        const outcome = await squadClient(userContext).updateOutcome({
          orgId,
          workspaceId,
          outcomeId: goalId,
          updateOutcomePayload: updatePayload,
        });

        return toolSuccess({
          id: outcome.id,
          title: outcome.title,
          message: 'Goal updated successfully',
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'update_goal' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to update goal: ${message}`);
      }
    }
  );

  // Delete Goal
  server.tool(
    {
      name: 'delete_goal',
      description: 'Delete a goal by ID.',
      schema: z.object({
        goalId: z.string().describe('The ID of the goal to delete'),
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
          outcomeId: params.goalId,
        });

        return toolSuccess({ data: { id: params.goalId } });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'delete_goal' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to delete goal: ${message}`);
      }
    }
  );

  // Manage Goal Relationships
  server.tool(
    {
      name: 'manage_goal_relationships',
      description: 'Add or remove relationships between a goal and opportunities for the business.',
      schema: z.object({
        goalId: z.string().describe('The ID of the goal to manage relationships for'),
        action: z.enum(['add', 'remove']).describe('Whether to add or remove the relationships'),
        opportunityIds: z.array(z.string()).optional().describe('IDs of opportunities to relate to this goal'),
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
          outcomeId: params.goalId,
          action: params.action as RelationshipAction,
          outcomeRelationshipsPayload: {
            opportunityIds: params.opportunityIds || [],
          },
        });

        return toolSuccess({
          id: params.goalId,
          message: `Relationships ${params.action === 'add' ? 'added' : 'removed'} successfully`,
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'manage_goal_relationships' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to manage goal relationships: ${message}`);
      }
    }
  );
}
