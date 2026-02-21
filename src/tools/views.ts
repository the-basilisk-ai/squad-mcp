import { text, widget } from "mcp-use/server";
import { z } from "zod";
import { getSquadAppUrl } from "../helpers/config.js";
import { getUserContext } from "../helpers/getUser.js";
import { squadClient } from "../lib/clients/squad.js";
import { logger } from "../lib/logger.js";
import {
  formatWorkspaceSelectionError,
  getUserId,
  type OAuthServer,
  toolError,
  WorkspaceSelectionRequired,
} from "./helpers.js";

/**
 * A node in the entity hierarchy chain.
 */
type HierarchyNode = {
  id: string;
  type:
    | "workspace"
    | "goal"
    | "opportunity"
    | "solution"
    | "insight"
    | "feedback";
  title: string;
  description?: string;
  status?: string;
  horizon?: string;
  isRecommended?: boolean;
  insightCount?: number;
  hasUnseenInsights?: boolean;
  missionStatement?: string;
  /** Goal priority (1–5, higher = more important) */
  priority?: number;
  /** Insight type: Bug, Feedback, FeatureRequest */
  insightType?: string;
  /** Feedback source */
  source?: string;
  /** Number of direct children this entity has */
  childCount?: number;
  /** Entity type of the children */
  childType?: "goal" | "opportunity" | "solution" | "insight" | "feedback";
};

/**
 * Child summary for stacked card display.
 */
type ChildGroup = {
  type: "goal" | "opportunity" | "solution" | "insight" | "feedback";
  count: number;
  items: Array<{ id: string; title: string; status?: string }>;
};

/**
 * Full entity-in-context payload returned by the tool.
 */
type EntityContextData = {
  /** The ancestry chain from workspace (index 0) down to the focused entity (last). */
  ancestors: HierarchyNode[];
  /** The entity the user asked about. */
  focused: HierarchyNode;
  /** Direct children of the focused entity, if any. */
  children?: ChildGroup;
  /** Base URL for deep links into the Squad app (e.g. https://app.meetsquad.ai/{orgId}/{workspaceId}). */
  appBaseUrl?: string;
};

/**
 * Fetch the workspace ancestor node with goal count.
 */
async function fetchWorkspaceAncestor(
  client: ReturnType<typeof squadClient>,
  orgId: string,
  workspaceId: string,
): Promise<HierarchyNode> {
  const [workspaceResp, outcomes] = await Promise.all([
    client.getWorkspace({ orgId, workspaceId }),
    client.listGoals({ orgId, workspaceId }),
  ]);
  const workspace = workspaceResp.data;
  return {
    id: workspace.id,
    type: "workspace",
    title: workspace.name,
    missionStatement: workspace.missionStatement,
    childCount: outcomes.data.length,
    childType: "goal",
  };
}

/**
 * Fetch a goal ancestor node from its ID, with opportunity count.
 */
async function fetchGoalAncestor(
  client: ReturnType<typeof squadClient>,
  orgId: string,
  workspaceId: string,
  goalId: string,
): Promise<HierarchyNode> {
  const goal = (
    await client.getGoal({
      orgId,
      workspaceId,
      outcomeId: goalId,
      relationships: "opportunities",
    })
  ).data;
  return {
    id: goal.id,
    type: "goal",
    title: goal.title,
    priority: goal.priority,
    childCount: goal.opportunities?.length ?? 0,
    childType: "opportunity",
  };
}

/**
 * Walk up from a solution to build the full hierarchy.
 */
async function buildSolutionContext(
  client: ReturnType<typeof squadClient>,
  orgId: string,
  workspaceId: string,
  solutionId: string,
): Promise<EntityContextData> {
  const solution = (
    await client.getSolution({
      orgId,
      workspaceId,
      solutionId,
      relationships: "opportunities,outcomes",
    })
  ).data;

  const isRecommended =
    solution.createdBy === "generated" &&
    solution.createdAt === solution.updatedAt;

  const focused: HierarchyNode = {
    id: solution.id,
    type: "solution",
    title: solution.title,
    description: solution.description,
    status: solution.status,
    horizon: solution.horizon,
    isRecommended,
  };

  const ancestors: HierarchyNode[] = [];

  // Walk up: opportunity (include solutions for child count)
  const parentOpp = solution.opportunities?.[0];
  if (parentOpp) {
    const opp = (
      await client.getOpportunity({
        orgId,
        workspaceId,
        opportunityId: parentOpp.id,
        relationships: "outcomes,solutions,insights",
      })
    ).data;
    ancestors.unshift({
      id: opp.id,
      type: "opportunity",
      title: opp.title,
      status: opp.status,
      insightCount: opp.insights?.length ?? 0,
      hasUnseenInsights: opp.hasUnseenInsights,
      childCount: opp.solutions?.length ?? 0,
      childType: "solution",
    });

    // Walk up: goal
    const parentGoal = opp.outcomes?.[0];
    if (parentGoal) {
      ancestors.unshift(
        await fetchGoalAncestor(client, orgId, workspaceId, parentGoal.id),
      );
    }
  } else {
    // Try goal directly from solution's outcomes
    const parentGoal = solution.outcomes?.[0];
    if (parentGoal) {
      ancestors.unshift(
        await fetchGoalAncestor(client, orgId, workspaceId, parentGoal.id),
      );
    }
  }

  // Walk up: workspace
  ancestors.unshift(await fetchWorkspaceAncestor(client, orgId, workspaceId));

  return { ancestors, focused };
}

/**
 * Walk up from an opportunity to build the full hierarchy.
 */
async function buildOpportunityContext(
  client: ReturnType<typeof squadClient>,
  orgId: string,
  workspaceId: string,
  opportunityId: string,
): Promise<EntityContextData> {
  const opp = (
    await client.getOpportunity({
      orgId,
      workspaceId,
      opportunityId,
      relationships: "solutions,outcomes,insights",
    })
  ).data;

  const focused: HierarchyNode = {
    id: opp.id,
    type: "opportunity",
    title: opp.title,
    description: opp.description,
    status: opp.status,
    insightCount: opp.insights?.length ?? 0,
    hasUnseenInsights: opp.hasUnseenInsights,
  };

  const ancestors: HierarchyNode[] = [];

  // Walk up: goal
  const parentGoal = opp.outcomes?.[0];
  if (parentGoal) {
    ancestors.unshift(
      await fetchGoalAncestor(client, orgId, workspaceId, parentGoal.id),
    );
  }

  // Walk up: workspace
  ancestors.unshift(await fetchWorkspaceAncestor(client, orgId, workspaceId));

  // Children: solutions
  const solutions = opp.solutions || [];
  const children: ChildGroup | undefined =
    solutions.length > 0
      ? {
          type: "solution",
          count: solutions.length,
          items: solutions
            .slice(0, 4)
            .map((s: { id: string; title: string; status: string }) => ({
              id: s.id,
              title: s.title,
              status: s.status,
            })),
        }
      : undefined;

  return { ancestors, focused, children };
}

/**
 * Walk up from a goal to build the full hierarchy.
 */
async function buildGoalContext(
  client: ReturnType<typeof squadClient>,
  orgId: string,
  workspaceId: string,
  goalId: string,
): Promise<EntityContextData> {
  const goal = (
    await client.getGoal({
      orgId,
      workspaceId,
      outcomeId: goalId,
      relationships: "opportunities",
    })
  ).data;

  const focused: HierarchyNode = {
    id: goal.id,
    type: "goal",
    title: goal.title,
    description: goal.description,
    priority: goal.priority,
  };

  // Walk up: workspace
  const ancestors: HierarchyNode[] = [
    await fetchWorkspaceAncestor(client, orgId, workspaceId),
  ];

  // Children: opportunities
  const opportunities = goal.opportunities || [];
  const children: ChildGroup | undefined =
    opportunities.length > 0
      ? {
          type: "opportunity",
          count: opportunities.length,
          items: opportunities
            .slice(0, 4)
            .map((o: { id: string; title: string; status: string }) => ({
              id: o.id,
              title: o.title,
              status: o.status,
            })),
        }
      : undefined;

  return { ancestors, focused, children };
}

/**
 * Build context for a workspace (top-level).
 */
async function buildWorkspaceContext(
  client: ReturnType<typeof squadClient>,
  orgId: string,
  workspaceId: string,
): Promise<EntityContextData> {
  const [workspaceResp, outcomes] = await Promise.all([
    client.getWorkspace({ orgId, workspaceId }),
    client.listGoals({ orgId, workspaceId }),
  ]);
  const workspace = workspaceResp.data;

  const focused: HierarchyNode = {
    id: workspace.id,
    type: "workspace",
    title: workspace.name,
    description: workspace.description,
    missionStatement: workspace.missionStatement,
  };

  const goals = outcomes.data || [];
  const children: ChildGroup | undefined =
    goals.length > 0
      ? {
          type: "goal",
          count: goals.length,
          items: goals.slice(0, 4).map((g: { id: string; title: string }) => ({
            id: g.id,
            title: g.title,
          })),
        }
      : undefined;

  return { ancestors: [], focused, children };
}

/**
 * Walk up from an insight to build the hierarchy (starts from opportunity).
 */
async function buildInsightContext(
  client: ReturnType<typeof squadClient>,
  orgId: string,
  workspaceId: string,
  insightId: string,
): Promise<EntityContextData> {
  const insight = (
    await client.getInsight({
      orgId,
      workspaceId,
      insightId,
      relationships: "opportunities,feedback",
    })
  ).data;

  const focused: HierarchyNode = {
    id: insight.id,
    type: "insight",
    title: insight.title,
    description: insight.description,
    insightType: insight.type,
  };

  const ancestors: HierarchyNode[] = [];

  // Walk up: opportunity → goal → workspace
  const parentOpp = insight.opportunities?.[0];
  if (parentOpp) {
    const opp = (
      await client.getOpportunity({
        orgId,
        workspaceId,
        opportunityId: parentOpp.id,
        relationships: "outcomes,solutions,insights",
      })
    ).data;
    ancestors.unshift({
      id: opp.id,
      type: "opportunity",
      title: opp.title,
      status: opp.status,
      insightCount: opp.insights?.length ?? 0,
      hasUnseenInsights: opp.hasUnseenInsights,
      childCount: opp.solutions?.length ?? 0,
      childType: "solution",
    });

    // Walk up: goal
    const parentGoal = opp.outcomes?.[0];
    if (parentGoal) {
      ancestors.unshift(
        await fetchGoalAncestor(client, orgId, workspaceId, parentGoal.id),
      );
    }
  }

  // Walk up: workspace
  ancestors.unshift(await fetchWorkspaceAncestor(client, orgId, workspaceId));

  // Children: feedback count only (no items for performance)
  const feedbackItems = insight.feedback || [];
  const children: ChildGroup | undefined =
    feedbackItems.length > 0
      ? { type: "feedback", count: feedbackItems.length, items: [] }
      : undefined;

  return { ancestors, focused, children };
}

/**
 * Walk up from feedback to build the hierarchy (insight → opportunity).
 */
async function buildFeedbackContext(
  client: ReturnType<typeof squadClient>,
  orgId: string,
  workspaceId: string,
  feedbackId: string,
): Promise<EntityContextData> {
  const feedback = (
    await client.getFeedback({
      orgId,
      workspaceId,
      feedbackId,
      relationships: "insights",
    })
  ).data;

  const title =
    feedback.title ||
    (feedback.content?.length > 80
      ? `${feedback.content.slice(0, 80)}…`
      : feedback.content) ||
    "(Untitled feedback)";

  const focused: HierarchyNode = {
    id: feedback.id,
    type: "feedback",
    title,
    description: feedback.content,
    source: feedback.source,
  };

  const ancestors: HierarchyNode[] = [];

  // Walk up: insight → opportunity → goal → workspace
  const parentInsight = feedback.insights?.[0];
  if (parentInsight) {
    const insight = (
      await client.getInsight({
        orgId,
        workspaceId,
        insightId: parentInsight.id,
        relationships: "opportunities",
      })
    ).data;
    ancestors.unshift({
      id: insight.id,
      type: "insight",
      title: insight.title,
      insightType: insight.type,
    });

    const parentOpp = insight.opportunities?.[0];
    if (parentOpp) {
      const opp = (
        await client.getOpportunity({
          orgId,
          workspaceId,
          opportunityId: parentOpp.id,
          relationships: "outcomes,insights",
        })
      ).data;
      ancestors.unshift({
        id: opp.id,
        type: "opportunity",
        title: opp.title,
        status: opp.status,
        insightCount: opp.insights?.length ?? 0,
        hasUnseenInsights: opp.hasUnseenInsights,
      });

      // Walk up: goal
      const parentGoal = opp.outcomes?.[0];
      if (parentGoal) {
        ancestors.unshift(
          await fetchGoalAncestor(client, orgId, workspaceId, parentGoal.id),
        );
      }
    }
  }

  // Walk up: workspace
  ancestors.unshift(await fetchWorkspaceAncestor(client, orgId, workspaceId));

  return { ancestors, focused };
}

const TYPE_PLURALS: Record<string, string> = {
  goal: "Goals",
  opportunity: "Opportunities",
  solution: "Solutions",
  insight: "Insights",
  feedback: "Feedback",
};

const STATUS_LABELS: Record<string, string> = {
  New: "New",
  InProgress: "In Progress",
  InDevelopment: "In Development",
  Planned: "Planned",
  Complete: "Complete",
  Solved: "Solved",
  Live: "Live",
  Done: "Done",
  Parked: "Parked",
  Cancelled: "Cancelled",
  Backlog: "Backlog",
  FeatureRequest: "Feature Request",
  Bug: "Bug",
  Feedback: "Feedback",
};

/**
 * Format entity context data as human-readable text for non-UI MCP clients.
 */
function formatHierarchyText(data: EntityContextData): string {
  const lines: string[] = [];
  const indent = "  ";

  for (const ancestor of data.ancestors) {
    const label =
      ancestor.type.charAt(0).toUpperCase() + ancestor.type.slice(1);
    const parts: string[] = [];
    if (ancestor.status)
      parts.push(STATUS_LABELS[ancestor.status] || ancestor.status);
    if (ancestor.type === "goal" && ancestor.priority)
      parts.push(`Importance: ${ancestor.priority}/5`);
    const suffix = parts.length > 0 ? ` (${parts.join(", ")})` : "";
    lines.push(`${label}: ${ancestor.title}${suffix}`);
  }

  const focusedLabel =
    data.focused.type.charAt(0).toUpperCase() + data.focused.type.slice(1);
  const focusedParts: string[] = [];
  if (data.focused.status)
    focusedParts.push(
      STATUS_LABELS[data.focused.status] || data.focused.status,
    );
  if (data.focused.type === "goal" && data.focused.priority)
    focusedParts.push(`Importance: ${data.focused.priority}/5`);
  const focusedSuffix =
    focusedParts.length > 0 ? ` (${focusedParts.join(", ")})` : "";
  lines.push(`→ ${focusedLabel}: ${data.focused.title}${focusedSuffix}`);

  if (data.focused.description) {
    lines.push(`${indent}${data.focused.description}`);
  }

  if (data.children) {
    const label =
      data.children.count !== 1
        ? (TYPE_PLURALS[data.children.type] ?? `${data.children.type}s`)
        : data.children.type.charAt(0).toUpperCase() +
          data.children.type.slice(1);
    lines.push(`${indent}${data.children.count} ${label}`);
  }

  if (data.appBaseUrl && data.focused.type !== "workspace") {
    const section =
      data.focused.type === "insight" || data.focused.type === "feedback"
        ? "insights"
        : "strategy";
    const url = `${data.appBaseUrl}/${section}?p=${data.focused.type}&i=${data.focused.id}`;
    lines.push(`\nView in Squad: ${url}`);
  }

  return lines.join("\n");
}

/**
 * Register view tools with the MCP server
 */
export function registerViewTools(server: OAuthServer) {
  server.tool(
    {
      name: "view_strategy_context",
      title: "View Strategy Context",
      description:
        "Show an entity in its product strategy tree — displays the entity, its parent chain, and direct children in a rich visual UI. " +
        "ALWAYS use this tool when the user asks about strategy, prioritisation, reasoning, context, positioning, or 'why' behind any entity. " +
        "Use it when the user asks questions like 'what's the strategy behind X', 'why is this a P1', " +
        "'how does this fit in', 'what's above/below this', or wants to present/display/show an entity to someone. " +
        "Prefer this over individual get_ tools whenever strategy, context, explanation, or orientation is the goal.",
      schema: z.object({
        entityType: z
          .enum([
            "workspace",
            "goal",
            "opportunity",
            "solution",
            "insight",
            "feedback",
          ])
          .describe("The type of entity to view"),
        entityId: z
          .string()
          .optional()
          .describe(
            "The ID of the entity to view. Not required for workspace (uses current workspace).",
          ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
      widget: {
        name: "view-strategy-context",
        invoking: "Loading entity context...",
        invoked: "Entity context ready",
      },
    },
    async (params, ctx) => {
      try {
        const userContext = await getUserContext(
          ctx.auth.accessToken,
          getUserId(ctx.auth),
        );
        const { orgId, workspaceId } = userContext;
        const client = squadClient(userContext);

        let data: EntityContextData;

        switch (params.entityType) {
          case "solution": {
            if (!params.entityId) {
              return toolError("entityId is required for solution");
            }
            data = await buildSolutionContext(
              client,
              orgId,
              workspaceId,
              params.entityId,
            );
            break;
          }
          case "opportunity": {
            if (!params.entityId) {
              return toolError("entityId is required for opportunity");
            }
            data = await buildOpportunityContext(
              client,
              orgId,
              workspaceId,
              params.entityId,
            );
            break;
          }
          case "goal": {
            if (!params.entityId) {
              return toolError("entityId is required for goal");
            }
            data = await buildGoalContext(
              client,
              orgId,
              workspaceId,
              params.entityId,
            );
            break;
          }
          case "workspace": {
            data = await buildWorkspaceContext(client, orgId, workspaceId);
            break;
          }
          case "insight": {
            if (!params.entityId) {
              return toolError("entityId is required for insight");
            }
            data = await buildInsightContext(
              client,
              orgId,
              workspaceId,
              params.entityId,
            );
            break;
          }
          case "feedback": {
            if (!params.entityId) {
              return toolError("entityId is required for feedback");
            }
            data = await buildFeedbackContext(
              client,
              orgId,
              workspaceId,
              params.entityId,
            );
            break;
          }
        }

        data.appBaseUrl = `${getSquadAppUrl()}/${orgId}/${workspaceId}`;

        // Use mcp-use widget() helper — the framework handles:
        // - Unique resource URI generation (matching the registered template)
        // - Dual-protocol _meta (MCP Apps + ChatGPT Apps SDK)
        // - structuredContent for ChatGPT (window.openai.toolOutput)
        return widget({
          props: data as unknown as Record<string, unknown>,
          output: text(formatHierarchyText(data)),
        });
      } catch (error) {
        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }
        logger.debug(
          { err: error, tool: "view_strategy_context" },
          "Tool error",
        );
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return toolError(`Unable to view entity in context: ${message}`);
      }
    },
  );
}
