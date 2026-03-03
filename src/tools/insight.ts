import { z } from "zod";
import { getUserContext } from "../helpers/getUser.js";
import { squadClient } from "../lib/clients/squad.js";
import { logger } from "../lib/logger.js";
import { CreateInsightRequestTypeEnum } from "../lib/openapi/squad/models/CreateInsightRequest.js";
import {
  formatWorkspaceSelectionError,
  getUserId,
  type OAuthServer,
  toolError,
  toolSuccess,
  WorkspaceSelectionRequired,
} from "./helpers.js";

/**
 * Register insight tools with the MCP server
 */
export function registerInsightTools(server: OAuthServer) {
  // Create Insight
  server.tool(
    {
      name: "create_insight",
      title: "Create Insight",
      description:
        "Create a new insight entry. An insight is customer-generated feedback about your product, often from reviews, surveys, or questionnaires.",
      schema: z
        .object({
          type: z
            .enum([
              CreateInsightRequestTypeEnum.Feedback,
              CreateInsightRequestTypeEnum.Bug,
              CreateInsightRequestTypeEnum.FeatureRequest,
            ])
            .describe(
              "The type of insight: 'Feedback' for customer feedback, 'Bug' for bug reports, or 'FeatureRequest' for feature requests.",
            ),
          title: z.string().describe("A brief title summarizing the insight"),
          description: z
            .string()
            .describe("A short description of the insight"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
        const { orgId, workspaceId } = userContext;

        const result = await squadClient(userContext).createInsight({
          orgId,
          workspaceId,
          createInsightRequest: {
            type: params.type,
            title: params.title,
            description: params.description,
            organisationId: orgId,
            workspaceId: workspaceId,
          },
        });

        return toolSuccess({
          id: result.id,
          title: result.title,
          type: result.type,
          message: "Insight created successfully",
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: "create_insight" }, "Tool error");
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to create insight: ${message}`);
      }
    },
  );

  // List Insights
  server.tool(
    {
      name: "list_insights",
      title: "List Insights",
      description:
        "List all insights for the workspace. These insights are gathered from various sources, created by customers, and help understand how to improve the business.",
      schema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (_params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
        const { orgId, workspaceId } = userContext;

        const insights = await squadClient(userContext).listInsights({
          orgId,
          workspaceId,
        });

        if (insights.data.length === 0) {
          return toolSuccess({ message: "No insight entries found." });
        }

        // Return summaries to reduce token usage - use get_insight for full details
        return toolSuccess({
          count: insights.data.length,
          items: insights.data.map(i => ({
            id: i.id,
            title: i.title,
            type: i.type,
          })),
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: "list_insights" }, "Tool error");
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to list insights: ${message}`);
      }
    },
  );

  // Get Insight
  server.tool(
    {
      name: "get_insight",
      title: "Get Insight Details",
      description:
        "Get details of a specific insight entry by ID. Insight entries are text documents that can be used as references or information sources.",
      schema: z.object({
        insightId: z
          .string()
          .describe("The ID of the insight entry to retrieve"),
        relationships: z
          .array(z.enum(["opportunities", "solutions", "outcomes"]))
          .optional()
          .describe("Show other entities that this insight is related to."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
        const { orgId, workspaceId } = userContext;

        // Build params conditionally
        const insight =
          params.relationships && params.relationships.length > 0
            ? await squadClient(userContext).getInsight({
                orgId,
                workspaceId,
                insightId: params.insightId,
                relationships: params.relationships.join(","),
              })
            : await squadClient(userContext).getInsight({
                orgId,
                workspaceId,
                insightId: params.insightId,
              });

        // Return summaries for relationships to reduce token usage
        return toolSuccess({
          ...insight,
          opportunities: insight.opportunities?.map((o) => ({
            id: o.id,
            title: o.title,
            status: o.status,
          })),
          solutions: insight.solutions?.map((s) => ({
            id: s.id,
            title: s.title,
            status: s.status,
          })),
          outcomes: insight.outcomes?.map((o) => ({
            id: o.id,
            title: o.title,
            priority: o.priority,
          }),
          ),
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: "get_insight" }, "Tool error");
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to get insight: ${message}`);
      }
    },
  );

  // Delete Insight
  server.tool(
    {
      name: "delete_insight",
      title: "Delete Insight",
      description: "Delete an insight entry by ID.",
      schema: z.object({
        insightId: z.string().describe("The ID of the insight entry to delete"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
        const { orgId, workspaceId } = userContext;

        const result = await squadClient(userContext).deleteInsight({
          orgId,
          workspaceId,
          insightId: params.insightId,
        });

        return toolSuccess(result);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: "delete_insight" }, "Tool error");
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to delete insight: ${message}`);
      }
    },
  );
}
