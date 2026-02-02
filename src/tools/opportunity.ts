import { z } from 'zod';
import { squadClient } from '../lib/clients/squad.js';
import { logger } from '../lib/logger.js';
import { getUserContext } from '../helpers/getUser.js';
import { type OAuthServer, getUserId, toolError, toolSuccess, WorkspaceSelectionRequired, formatWorkspaceSelectionError } from './helpers.js';
import {
  RelationshipAction,
  UpdateOpportunityPayloadStatusEnum,
} from '../lib/openapi/squad/models/index.js';

/**
 * Register opportunity tools with the MCP server
 */
export function registerOpportunityTools(server: OAuthServer) {
  // Create Opportunity
  server.tool(
    {
      name: 'create_opportunity',
      description: 'Create a new opportunity. An opportunity is a detailed problem statement identified for the organisation. It doesn\'t have any solutionising and simply captures an opportunity for the organisation.',
      schema: z.object({
        title: z.string().describe('A short title'),
        description: z.string().describe('A short description of the opportunity, detailing the problem statement and opportunity for the business'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const result = await squadClient(userContext).createOpportunity({
          orgId,
          workspaceId,
          createOpportunityPayload: {
            title: params.title,
            description: params.description,
            createdBy: 'user',
          },
        });

        return toolSuccess({
          id: result.id,
          title: result.title,
          message: 'Opportunity created successfully',
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'create_opportunity' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to create opportunity: ${message}`);
      }
    }
  );

  // List Opportunities
  server.tool(
    {
      name: 'list_opportunities',
      description: 'List all opportunities in the workspace. Opportunities are problem statements identified for the organisation.',
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (_params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const opportunities = await squadClient(userContext).listOpportunities({
          orgId,
          workspaceId,
        });

        if (opportunities.data.length === 0) {
          return toolSuccess({ message: 'No opportunities found.' });
        }

        // Return summaries to reduce token usage - use get_opportunity for full details
        return toolSuccess({
          count: opportunities.data.length,
          items: opportunities.data.map(o => ({
            id: o.id,
            title: o.title,
            status: o.status,
          })),
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'list_opportunities' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to list opportunities: ${message}`);
      }
    }
  );

  // Get Opportunity
  server.tool(
    {
      name: 'get_opportunity',
      description: 'Get details of a specific opportunity by ID. Opportunities are problem statements identified for the organisation.',
      schema: z.object({
        opportunityId: z.string().describe('The ID of the opportunity to retrieve'),
        relationships: z
          .array(z.enum(['solutions', 'outcomes', 'insights']))
          .optional()
          .default([])
          .describe('Relationships to include in the response. Outcomes are business objectives/goals. Solutions are proposed approaches to address opportunities. Feedback is additional information or insights related to the opportunity.'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const opportunity = await squadClient(userContext).getOpportunity({
          orgId,
          workspaceId,
          opportunityId: params.opportunityId,
          relationships: params.relationships.join(','),
        });

        return toolSuccess(opportunity);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'get_opportunity' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to get opportunity: ${message}`);
      }
    }
  );

  // Update Opportunity
  server.tool(
    {
      name: 'update_opportunity',
      description: 'Update an existing opportunity\'s details such as title, description, or status.',
      schema: z.object({
        opportunityId: z.string().describe('The ID of the opportunity to update'),
        title: z.string().optional().describe('Updated title'),
        description: z.string().optional().describe('Updated description'),
        status: z
          .enum([
            UpdateOpportunityPayloadStatusEnum.New,
            UpdateOpportunityPayloadStatusEnum.Solved,
            UpdateOpportunityPayloadStatusEnum.Planned,
            UpdateOpportunityPayloadStatusEnum.InProgress,
          ])
          .optional()
          .describe(`Updated status: ${UpdateOpportunityPayloadStatusEnum.New} hasn't been developed, ${UpdateOpportunityPayloadStatusEnum.InProgress} means we're currently building out solutions and implementing them. ${UpdateOpportunityPayloadStatusEnum.Planned} means we've finished developing the solutions and are ready to implement them. ${UpdateOpportunityPayloadStatusEnum.Solved} means we've completed the implementation and the opportunity is considered addressed.`),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;
        const { opportunityId, ...updatePayload } = params;

        const opportunity = await squadClient(userContext).updateOpportunity({
          orgId,
          workspaceId,
          opportunityId,
          updateOpportunityPayload: updatePayload,
        });

        return toolSuccess({
          id: opportunity.id,
          title: opportunity.title,
          status: opportunity.status,
          message: 'Opportunity updated successfully',
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'update_opportunity' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to update opportunity: ${message}`);
      }
    }
  );

  // Delete Opportunity
  server.tool(
    {
      name: 'delete_opportunity',
      description: 'Delete an opportunity by ID.',
      schema: z.object({
        opportunityId: z.string().describe('The ID of the opportunity to delete'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        await squadClient(userContext).deleteOpportunity({
          orgId,
          workspaceId,
          opportunityId: params.opportunityId,
        });

        return toolSuccess({ data: { id: params.opportunityId } });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'delete_opportunity' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to delete opportunity: ${message}`);
      }
    }
  );

  // Generate Solutions
  server.tool(
    {
      name: 'generate_solutions',
      description: 'Start the process of generating solutions for an opportunity. This will use Squad AI to generate new potential solutions for a given opportunity.',
      schema: z.object({
        opportunityId: z.string().describe('The ID of the opportunity to generate solutions for'),
        prompt: z.string().optional().describe('Optional prompt to guide solution generation'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        await squadClient(userContext).generateSolutions({
          orgId,
          workspaceId,
          opportunityId: params.opportunityId,
        });

        return toolSuccess({ data: { id: params.opportunityId } });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'generate_solutions' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to generate solutions: ${message}`);
      }
    }
  );

  // Manage Opportunity Relationships
  server.tool(
    {
      name: 'manage_opportunity_relationships',
      description: 'Add or remove relationships between an opportunity and other entities (solutions, outcomes, or insights).',
      schema: z.object({
        opportunityId: z.string().describe('The ID of the opportunity to manage relationships for'),
        action: z.enum(['add', 'remove']).describe('Whether to add or remove the relationships'),
        solutionIds: z.array(z.string()).optional().describe('IDs of solutions to relate to this opportunity'),
        outcomeIds: z.array(z.string()).optional().describe('IDs of outcomes to relate to this opportunity'),
        insightIds: z.array(z.string()).optional().describe('IDs of insight items to relate to this opportunity'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        await squadClient(userContext).manageOpportunityRelationships({
          orgId,
          workspaceId,
          opportunityId: params.opportunityId,
          action: params.action as RelationshipAction,
          opportunityRelationshipsPayload: {
            solutionIds: params.solutionIds || [],
            outcomeIds: params.outcomeIds || [],
            insightIds: params.insightIds || [],
          },
        });

        return toolSuccess({
          id: params.opportunityId,
          message: `Relationships ${params.action === 'add' ? 'added' : 'removed'} successfully`,
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'manage_opportunity_relationships' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to manage opportunity relationships: ${message}`);
      }
    }
  );
}
