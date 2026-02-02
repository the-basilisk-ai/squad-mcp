import { z } from 'zod';
import { squadClient } from '../lib/clients/squad.js';
import { logger } from '../lib/logger.js';
import { getUserContext } from '../helpers/getUser.js';
import { type OAuthServer, getUserId, toolError, toolSuccess, WorkspaceSelectionRequired, formatWorkspaceSelectionError } from './helpers.js';
import { CreateFeedbackRequestSentimentCategoryEnum } from '../lib/openapi/squad/models/CreateFeedbackRequest.js';

/**
 * Register feedback tools with the MCP server
 */
export function registerFeedbackTools(server: OAuthServer) {
  // Create Feedback
  server.tool(
    {
      name: 'create_feedback',
      description: 'Create a new feedback entry. Feedback represents raw, unprocessed feedback from users that can later be analyzed and converted into insights.',
      schema: z.object({
        content: z.string().describe('The original raw feedback content from the user'),
        source: z.string().describe('The source of the feedback (e.g., \'Typeform\', \'Slack\', \'Manual\', \'Email\', etc.)'),
        sentimentScore: z.number().min(-1).max(1).optional().describe('Sentiment score from -1 (negative) to 1 (positive)'),
        sentimentCategory: z
          .enum([
            CreateFeedbackRequestSentimentCategoryEnum.Positive,
            CreateFeedbackRequestSentimentCategoryEnum.Neutral,
            CreateFeedbackRequestSentimentCategoryEnum.Negative,
          ])
          .optional()
          .describe('Sentiment classification category: \'Positive\', \'Neutral\', or \'Negative\''),
        sentimentConfidence: z.number().min(0).max(1).optional().describe('Confidence in sentiment analysis (0-1)'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const result = await squadClient(userContext).createFeedback({
          orgId,
          workspaceId,
          createFeedbackRequest: {
            content: params.content,
            source: params.source,
            sentimentScore: params.sentimentScore,
            sentimentCategory: params.sentimentCategory,
            sentimentConfidence: params.sentimentConfidence,
          },
        });

        return toolSuccess({
          id: result.id,
          source: result.source,
          message: 'Feedback created successfully',
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'create_feedback' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to create feedback: ${message}`);
      }
    }
  );

  // List Feedback
  server.tool(
    {
      name: 'list_feedback',
      description: 'List all feedback entries in the workspace. Feedback entries are raw customer feedback that can be processed into insights.',
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (_params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const feedback = await squadClient(userContext).listFeedback({
          orgId,
          workspaceId,
        });

        if (feedback.data.length === 0) {
          return toolSuccess({ message: 'No feedback entries found.' });
        }

        // Return summaries to reduce token usage - use get_feedback for full details
        return toolSuccess({
          count: feedback.data.length,
          items: feedback.data.map(f => ({
            id: f.id,
            source: f.source,
            sentimentCategory: f.sentimentCategory,
            createdAt: f.createdAt,
          })),
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'list_feedback' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to list feedback: ${message}`);
      }
    }
  );

  // Get Feedback
  server.tool(
    {
      name: 'get_feedback',
      description: 'Get details of a specific feedback entry by ID. Feedback entries are raw customer feedback.',
      schema: z.object({
        feedbackId: z.string().describe('The ID of the feedback entry to retrieve'),
        relationships: z.enum(['insights']).optional().describe('Show insights that were generated from this feedback.'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const feedback = await squadClient(userContext).getFeedback({
          orgId,
          workspaceId,
          feedbackId: params.feedbackId,
          relationships: params.relationships,
        });

        return toolSuccess(feedback);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'get_feedback' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to get feedback: ${message}`);
      }
    }
  );

  // Delete Feedback
  server.tool(
    {
      name: 'delete_feedback',
      description: 'Delete a feedback entry by ID.',
      schema: z.object({
        feedbackId: z.string().describe('The ID of the feedback entry to delete'),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(ctx.auth.accessToken, getUserId(ctx.auth));
        const { orgId, workspaceId } = userContext;

        const result = await squadClient(userContext).deleteFeedback({
          orgId,
          workspaceId,
          feedbackId: params.feedbackId,
        });

        return toolSuccess(result);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: 'delete_feedback' }, 'Tool error');
        const message = error instanceof Error ? error.message : 'Unknown error';
        return toolError(`Unable to delete feedback: ${message}`);
      }
    }
  );
}
