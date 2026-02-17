import { z } from "zod";
import { getUserContext } from "../helpers/getUser.js";
import { squadClient } from "../lib/clients/squad.js";
import { logger } from "../lib/logger.js";
import {
  CreateSolutionPayloadStatusEnum,
  PrioritiseSolutionsRequestTriggeredByEnum,
  type RelationshipAction,
} from "../lib/openapi/squad/models/index.js";
import {
  formatWorkspaceSelectionError,
  getUserId,
  type OAuthServer,
  toolError,
  toolSuccess,
  WorkspaceSelectionRequired,
} from "./helpers.js";

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
    `Status of the solution: ${CreateSolutionPayloadStatusEnum.New} hasn't been developed, ${CreateSolutionPayloadStatusEnum.InDevelopment} means we're currently building out requirements and implementing them. ${CreateSolutionPayloadStatusEnum.Planned} means we've finished developing the solutions and are ready to implement them. ${CreateSolutionPayloadStatusEnum.Complete} means we've completed the implementation and the opportunity is considered addressed. ${CreateSolutionPayloadStatusEnum.Cancelled} means we've cancelled the implementation and the opportunity is no longer considered addressed. ${CreateSolutionPayloadStatusEnum.Backlog} means we've added this to the backlog and it will be worked on in the future.`,
  );

/**
 * Register solution tools with the MCP server
 */
export function registerSolutionTools(server: OAuthServer) {
  // Create Solution
  server.tool(
    {
      name: "create_solution",
      title: "Create Solution",
      description:
        "Create a new solution. A solution is a proposed approach to address an opportunity. The 'prd' field should contain the complete detailed specification, while 'description' should be a brief summary for AI context.",
      schema: z.object({
        title: z.string().describe("A short title for the solution"),
        description: z
          .string()
          .describe(
            "A brief AI-friendly summary of the solution for context and search purposes. Keep this concise.",
          ),
        prd: z
          .string()
          .describe(
            "The complete Product Requirements Document (PRD) containing the full detailed specification, implementation plan, and requirements for this solution. This is the primary content field.",
          ),
        pros: z
          .array(z.string())
          .describe(
            "List of pros/benefits of this solution. This is a sentence or two max.",
          ),
        cons: z
          .array(z.string())
          .describe(
            "List of cons/drawbacks of this solution. This is a sentence or two max.",
          ),
        status: statusEnum,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
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
            createdBy: "user",
          },
        });

        return toolSuccess({
          id: result.id,
          title: result.title,
          status: result.status,
          message: "Solution created successfully",
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: "create_solution" }, "Tool error");
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to create solution: ${message}`);
      }
    },
  );

  // List Solutions
  server.tool(
    {
      name: "list_solutions",
      title: "List Solutions",
      description:
        "List all solutions in the workspace. Solutions are proposed approaches to address opportunities.",
      schema: z.object({
        filter: z
          .enum(["roadmap", "recommended"])
          .optional()
          .describe(
            "Filter solutions: 'roadmap' returns built solutions (user-created or edited), 'recommended' returns AI-generated suggestions not yet acted on. Omit to return all.",
          ),
        horizon: z
          .enum(["now", "next", "later"])
          .optional()
          .describe(
            "Filter by time horizon: 'now' for current work, 'next' for upcoming, 'later' for future.",
          ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
        const { orgId, workspaceId } = userContext;

        const built =
          params.filter === "roadmap"
            ? "true"
            : params.filter === "recommended"
              ? "false"
              : undefined;

        const solutions = await squadClient(userContext).listSolutions({
          orgId,
          workspaceId,
          built: built as "true" | "false" | undefined,
          horizon: params.horizon as "now" | "next" | "later" | undefined,
        });

        if (solutions.data.length === 0) {
          return toolSuccess({ message: "No solutions found." });
        }

        // Return summaries to reduce token usage - use get_solution for full details
        return toolSuccess({
          count: solutions.data.length,
          items: solutions.data.map((s, i) => ({
            id: s.id,
            title: s.title,
            status: s.status,
            ...(params.filter === "roadmap"
              ? { priority: i + 1, horizon: s.horizon }
              : {}),
          })),
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: "list_solutions" }, "Tool error");
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to list solutions: ${message}`);
      }
    },
  );

  // Get Solution
  server.tool(
    {
      name: "get_solution",
      title: "Get Solution Details",
      description: "Get details of a specific solution by ID.",
      schema: z.object({
        solutionId: z.string().describe("The ID of the solution to retrieve"),
        relationships: z
          .array(z.enum(["opportunities", "outcomes", "insights"]))
          .optional()
          .default([])
          .describe(
            "Relationships to include in the response. Opportunities are problem statements identified for the organisation. Outcomes are business objectives/goals. Feedback is additional information or insights related to the opportunity.",
          ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
        const { orgId, workspaceId } = userContext;

        const solution = await squadClient(userContext).getSolution({
          orgId,
          workspaceId,
          solutionId: params.solutionId,
          relationships: params.relationships.join(","),
        });

        // Return summaries for relationships to reduce token usage
        return toolSuccess({
          ...solution,
          opportunities: solution.opportunities?.map(
            (o: { id: string; title: string; status: string }) => ({
              id: o.id,
              title: o.title,
              status: o.status,
            }),
          ),
          outcomes: solution.outcomes?.map(
            (o: { id: string; title: string; priority: number }) => ({
              id: o.id,
              title: o.title,
              priority: o.priority,
            }),
          ),
          insights: solution.insights?.map(
            (i: { id: string; title: string; type: string }) => ({
              id: i.id,
              title: i.title,
              type: i.type,
            }),
          ),
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: "get_solution" }, "Tool error");
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to get solution: ${message}`);
      }
    },
  );

  // Update Solution
  server.tool(
    {
      name: "update_solution",
      title: "Update Solution",
      description:
        "Update an existing solution's details such as title, description, pros, cons, or status.",
      schema: z.object({
        solutionId: z.string().describe("The ID of the solution to update"),
        title: z.string().optional().describe("Updated title"),
        description: z
          .string()
          .optional()
          .describe(
            "Updated brief AI-friendly summary for context and search purposes",
          ),
        prd: z
          .string()
          .optional()
          .describe(
            "Updated complete Product Requirements Document (PRD) containing the full detailed specification and implementation plan",
          ),
        pros: z
          .array(z.string())
          .optional()
          .describe("Updated list of pros/benefits"),
        cons: z
          .array(z.string())
          .optional()
          .describe("Updated list of cons/drawbacks"),
        status: statusEnum,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
        const { orgId, workspaceId } = userContext;
        const { solutionId, ...updatePayload } = params;

        const solution = await squadClient(userContext).updateSolution({
          orgId,
          workspaceId,
          solutionId,
          updateSolutionPayload: {
            ...updatePayload,
            updateTriggeredBy: "AI",
          },
        });

        return toolSuccess({
          id: solution.id,
          title: solution.title,
          status: solution.status,
          message: "Solution updated successfully",
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug({ err: error, tool: "update_solution" }, "Tool error");
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to update solution: ${message}`);
      }
    },
  );

  // Delete Solution
  server.tool(
    {
      name: "delete_solution",
      title: "Delete Solution",
      description: "Delete a solution by ID.",
      schema: z.object({
        solutionId: z.string().describe("The ID of the solution to delete"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
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
        logger.debug({ err: error, tool: "delete_solution" }, "Tool error");
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to delete solution: ${message}`);
      }
    },
  );

  // Manage Solution Relationships
  server.tool(
    {
      name: "manage_solution_relationships",
      title: "Manage Solution Relationships",
      description:
        "Add or remove relationships between a solution and other entities (opportunities).",
      schema: z.object({
        solutionId: z
          .string()
          .describe("The ID of the solution to manage relationships for"),
        action: z
          .enum(["add", "remove"])
          .describe("Whether to add or remove the relationships"),
        opportunityIds: z
          .array(z.string())
          .optional()
          .describe("IDs of opportunities to relate to this solution"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
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
          message: `Relationships ${params.action === "add" ? "added" : "removed"} successfully`,
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug(
          { err: error, tool: "manage_solution_relationships" },
          "Tool error",
        );
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to manage solution relationships: ${message}`);
      }
    },
  );

  // Prioritise Solutions
  server.tool(
    {
      name: "prioritise_solutions",
      title: "Prioritise Solutions",
      description:
        "Reorder the priority of solutions by moving them before a specified solution. This changes the display order of solutions in the workspace.",
      schema: z.object({
        solutionIds: z
          .array(z.string())
          .describe("List of solution IDs to move"),
        beforeId: z
          .string()
          .nullable()
          .describe(
            "ID of the solution before which to place the solutions, or null to place at the end",
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
        const { orgId, workspaceId } = userContext;

        await squadClient(userContext).prioritiseSolutions({
          orgId,
          workspaceId,
          prioritiseSolutionsRequest: {
            solutionIds: params.solutionIds,
            beforeId: params.beforeId,
            triggeredBy: PrioritiseSolutionsRequestTriggeredByEnum.Ai,
          },
        });

        return toolSuccess({
          solutionIds: params.solutionIds,
          message: "Solutions prioritised successfully",
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug(
          { err: error, tool: "prioritise_solutions" },
          "Tool error",
        );
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to prioritise solutions: ${message}`);
      }
    },
  );
}
