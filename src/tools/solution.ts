import { z } from 'zod';
import { squadClient } from '../lib/clients/squad.js';
import { logger } from '../lib/logger.js';
import { getUserContext } from '../helpers/getUser.js';
import { type OAuthServer, getUserId, toolError, toolSuccess, toolSuccessPretty, WorkspaceSelectionRequired, formatWorkspaceSelectionError } from './helpers.js';
import {
  CreateSolutionPayloadStatusEnum,
  RelationshipAction,
} from '../lib/openapi/squad/models/index.js';

const statusEnum = z
  .enum([
    CreateSolutionPayloadStatusEnum.New,
    CreateSolutionPayloadStatusEnum.InDevelopment,
    CreateSolutionPayloadStatusEnum.Planned,
    CreateSolutionPayloadStatusEnum.Complete,
    CreateSolutionPayloadStatusEnum.Cancelled,
    CreateSolutionPayloadStatusEnum.Backlog,
  ])
  .optional()
  .describe(
    `Status of the solution: ${CreateSolutionPayloadStatusEnum.New} hasn't been developed, ${CreateSolutionPayloadStatusEnum.InDevelopment} means we're currently building out requirements and implementing them. ${CreateSolutionPayloadStatusEnum.Planned} means we've finished developing the solutions and are ready to implement them. ${CreateSolutionPayloadStatusEnum.Complete} means we've completed the implementation and the opportunity is considered addressed. ${CreateSolutionPayloadStatusEnum.Cancelled} means we've cancelled the implementation and the opportunity is no longer considered addressed. ${CreateSolutionPayloadStatusEnum.Backlog} means we've added this to the backlog and it will be worked on in the future.`
  );

/**
 * Register solution tools with the MCP server
 */
export function registerSolutionTools(server: OAuthServer) {
  // Create Solution
  server.tool(
    {
      name: 'create_solution',
      description: 'Create a new solution. A solution is a proposed approach to address an opportunity. The \'prd\' field should contain the complete detailed specification, while \'description\' should be a brief summary for AI context.',
      schema: z.object({
        title: z.string().describe('A short title for the solution'),
        description: z.string().describe('A brief AI-friendly summary of the solution for context and search purposes. Keep this concise.'),
        prd: z.string().describe('The complete Product Requirements Document (PRD) containing the full detailed specification, implementation plan, and requirements for this solution. This is the primary content field.'),
        pros: z.array(z.string()).describe('List of pros/benefits of this solution. This is a sentence or two max.'),
        cons: z.array(z.string()).describe('List of cons/drawbacks of this solution. This is a sentence or two max.'),
        status: statusEnum,
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const result = await squadClient(userContext).createSolution({
          orgId,
          workspaceId,
          createSolutionPayload: {
            title: params.title,
            description: params.description,
            prd: params.prd,
            pros: params.pros,
            cons: params.cons,
            status: params.status || CreateSolutionPayloadStatusEnum.New,
            createdBy: 'user',
          },
        });

        return toolSuccess({
          id: result.id,
          title: result.title,
          status: result.status,
          message: 'Solution created successfully',
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'create_solution' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to create solution: ${message}`);
      }
    }
  );

  // List Solutions
  server.tool(
    {
      name: 'list_solutions',
      description: 'List all solutions in the workspace. Solutions are proposed approaches to address opportunities.',
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (_params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const solutions = await squadClient(userContext).listSolutions({
          orgId,
          workspaceId,
        });

        if (solutions.data.length === 0) {
          return toolSuccess({ message: 'No solutions found.' });
        }

        // Return summaries to reduce token usage - use get_solution for full details
        return toolSuccess({
          count: solutions.data.length,
          items: solutions.data.map(s => ({
            id: s.id,
            title: s.title,
            status: s.status,
          })),
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'list_solutions' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to list solutions: ${message}`);
      }
    }
  );

  // Get Solution
  server.tool(
    {
      name: 'get_solution',
      description: 'Get details of a specific solution by ID.',
      schema: z.object({
        solutionId: z.string().describe('The ID of the solution to retrieve'),
        relationships: z
          .array(z.enum(['opportunities', 'outcomes', 'insights']))
          .optional()
          .default([])
          .describe('Relationships to include in the response. Opportunities are problem statements identified for the organisation. Outcomes are business objectives/goals. Feedback is additional information or insights related to the opportunity.'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const solution = await squadClient(userContext).getSolution({
          orgId,
          workspaceId,
          solutionId: params.solutionId,
        });

        return toolSuccess(solution);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'get_solution' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to get solution: ${message}`);
      }
    }
  );

  // Update Solution
  server.tool(
    {
      name: 'update_solution',
      description: 'Update an existing solution\'s details such as title, description, pros, cons, or status.',
      schema: z.object({
        solutionId: z.string().describe('The ID of the solution to update'),
        title: z.string().optional().describe('Updated title'),
        description: z.string().optional().describe('Updated brief AI-friendly summary for context and search purposes'),
        prd: z.string().optional().describe('Updated complete Product Requirements Document (PRD) containing the full detailed specification and implementation plan'),
        pros: z.array(z.string()).optional().describe('Updated list of pros/benefits'),
        cons: z.array(z.string()).optional().describe('Updated list of cons/drawbacks'),
        status: statusEnum,
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;
        const { solutionId, ...updatePayload } = params;

        const solution = await squadClient(userContext).updateSolution({
          orgId,
          workspaceId,
          solutionId,
          updateSolutionPayload: {
            ...updatePayload,
            updateTriggeredBy: 'AI',
          },
        });

        return toolSuccess({
          id: solution.id,
          title: solution.title,
          status: solution.status,
          message: 'Solution updated successfully',
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'update_solution' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to update solution: ${message}`);
      }
    }
  );

  // Delete Solution
  server.tool(
    {
      name: 'delete_solution',
      description: 'Delete a solution by ID.',
      schema: z.object({
        solutionId: z.string().describe('The ID of the solution to delete'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        await squadClient(userContext).deleteSolution({
          orgId,
          workspaceId,
          solutionId: params.solutionId,
        });

        return toolSuccess({ data: { id: params.solutionId } });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'delete_solution' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to delete solution: ${message}`);
      }
    }
  );

  // Manage Solution Relationships
  server.tool(
    {
      name: 'manage_solution_relationships',
      description: 'Add or remove relationships between a solution and other entities (opportunities).',
      schema: z.object({
        solutionId: z.string().describe('The ID of the solution to manage relationships for'),
        action: z.enum(['add', 'remove']).describe('Whether to add or remove the relationships'),
        opportunityIds: z.array(z.string()).optional().describe('IDs of opportunities to relate to this solution'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        await squadClient(userContext).manageSolutionRelationships({
          orgId,
          workspaceId,
          solutionId: params.solutionId,
          action: params.action as RelationshipAction,
          solutionRelationshipsPayload: {
            opportunityIds: params.opportunityIds || [],
          },
        });

        return toolSuccess({
          id: params.solutionId,
          message: `Relationships ${params.action === 'add' ? 'added' : 'removed'} successfully`,
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'manage_solution_relationships' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to manage solution relationships: ${message}`);
      }
    }
  );
}
