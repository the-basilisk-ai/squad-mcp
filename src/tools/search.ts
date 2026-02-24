import { z } from "zod";
import { getUserContext } from "../helpers/getUser.js";
import { squadClient } from "../lib/clients/squad.js";
import { logger } from "../lib/logger.js";
import { SimilaritySearchRequestFiltersEnum } from "../lib/openapi/squad/models/SimilaritySearchRequest.js";
import {
  formatWorkspaceSelectionError,
  getUserId,
  type OAuthServer,
  toolError,
  toolSuccessPretty,
  WorkspaceSelectionRequired,
} from "./helpers.js";

/**
 * Register search tools with the MCP server
 */
export function registerSearchTools(server: OAuthServer) {
  // Similarity Search
  server.tool(
    {
      name: "similarity_search",
      title: "Similarity Search",
      description:
        "Perform a semantic similarity search across the workspace. This searches through knowledge documents, feedback insights, opportunities, and solutions to find content similar to your query. Each result will contain a nodeId or an id. These can be used to retrieve the full content of the entity using the get_knowledge_document, get_insight, get_opportunity, or get_solution tools.",
      schema: z.object({
        query: z.string().describe("The search query string"),
        filters: z
          .array(
            z.enum([
              SimilaritySearchRequestFiltersEnum.KnowledgeBase,
              SimilaritySearchRequestFiltersEnum.Insights,
              SimilaritySearchRequestFiltersEnum.Opportunities,
              SimilaritySearchRequestFiltersEnum.Solutions,
            ]),
          )
          .default([
            SimilaritySearchRequestFiltersEnum.KnowledgeBase,
            SimilaritySearchRequestFiltersEnum.Insights,
            SimilaritySearchRequestFiltersEnum.Opportunities,
            SimilaritySearchRequestFiltersEnum.Solutions,
          ])
          .describe(
            `Filters to apply to the search. Options are: ${SimilaritySearchRequestFiltersEnum.KnowledgeBase} for knowledge documents, ${SimilaritySearchRequestFiltersEnum.Insights} for insights, ${SimilaritySearchRequestFiltersEnum.Opportunities} for opportunities, ${SimilaritySearchRequestFiltersEnum.Solutions} for solutions.`,
          ),
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

        const results = await squadClient(userContext).similaritySearch({
          orgId,
          workspaceId,
          similaritySearchRequest: {
            query: params.query,
            filters: params.filters,
          },
        });

        return toolSuccessPretty(results);
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: "similarity_search" }, "Tool error");
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to perform similarity search: ${message}`);
      }
    },
  );
}
