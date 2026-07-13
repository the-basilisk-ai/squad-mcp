import { z } from "zod";
import {
  CreateGoalDocument,
  DeleteSignalDocument,
  GetGoalDocument,
  GetInsightDocument,
  GetSignalDocument,
  LinkEntitiesDocument,
  UnlinkEntitiesDocument,
  UpdateGoalDocument,
  UpdateInsightMetaDocument,
} from "../gql/graphql.js";
import { formatDisplayId } from "../helpers/display-id.js";
import type { UserContext } from "../helpers/getUser.js";
import { appLink, entityResponse } from "../helpers/responses.js";
import { execute } from "../lib/squad-api-client.js";
import { toolError } from "./helpers.js";
import { type OAuthServer, registerTool } from "./registry.js";

async function resolveGoalUuid(
  goalId: string,
  ctx: UserContext,
): Promise<string | null> {
  const data = await execute(GetGoalDocument, { id: goalId }, ctx);
  return data.goal?.id ?? null;
}

export function registerStrategyWriteTools(server: OAuthServer) {
  registerTool(server, {
    name: "create_goal",
    title: "Create Goal",
    description:
      "Create a strategic goal. Goals frame which insights matter; importance (1–5) drives ranking.",
    schema: z.object({
      title: z.string().min(1),
      description: z
        .string()
        .min(1)
        .describe("What success looks like and why it matters"),
      importance: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe("1–5, default 3"),
    }),
    scope: "write",
    handler: async ({ title, description, importance }, tool) => {
      const ctx = await tool.getContext();
      const data = await execute(
        CreateGoalDocument,
        { input: { title, content: description, importance: importance ?? 3 } },
        ctx,
      );
      const goal = data.createGoal;
      if (!goal) return toolError("Goal creation returned nothing.");

      return entityResponse(
        {
          message: "Goal created.",
          goal: {
            displayId:
              goal.displayId != null
                ? formatDisplayId("goal", goal.displayId)
                : goal.id,
            title: goal.title,
            importance: goal.importance,
          },
        },
        {
          link: appLink(ctx.orgSlug, ctx.workspaceSlug, "goals"),
          suggestedNextTools: [
            "create_research_question — capture what we don't know yet about this goal",
          ],
        },
      );
    },
  });

  registerTool(server, {
    name: "update_goal",
    title: "Update Goal",
    description:
      "Update a goal's title, description or importance. A version snapshot is kept.",
    schema: z.object({
      goalId: z.string().describe("GL-N display ID or UUID"),
      title: z.string().optional(),
      description: z.string().optional(),
      importance: z.number().int().min(1).max(5).optional(),
    }),
    scope: "write",
    handler: async ({ goalId, title, description, importance }, tool) => {
      const ctx = await tool.getContext();
      const uuid = await resolveGoalUuid(goalId, ctx);
      if (!uuid) return toolError(`Goal "${goalId}" not found.`);

      const data = await execute(
        UpdateGoalDocument,
        {
          id: uuid,
          input: {
            title,
            content: description,
            importance,
            createVersion: true,
          },
        },
        ctx,
      );
      const goal = data.updateGoal;
      if (!goal) return toolError("Goal update returned nothing.");

      return entityResponse(
        {
          message: "Goal updated.",
          goal: {
            displayId:
              goal.displayId != null
                ? formatDisplayId("goal", goal.displayId)
                : goal.id,
            title: goal.title,
            importance: goal.importance,
          },
        },
        { link: appLink(ctx.orgSlug, ctx.workspaceSlug, "goals") },
      );
    },
  });

  registerTool(server, {
    name: "update_insight",
    title: "Update Insight",
    description:
      "Curate an insight: set category or status, and link/unlink the goal it supports. Insight titles and descriptions are pipeline-generated and not editable.",
    schema: z.object({
      insightId: z.string().describe("IN-N display ID or UUID"),
      category: z.string().optional(),
      status: z.string().optional(),
      linkGoalId: z
        .string()
        .optional()
        .describe("GL-N or UUID to link as supported goal"),
      unlinkGoalId: z.string().optional().describe("GL-N or UUID to unlink"),
    }),
    scope: "write",
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const insight = (
        await execute(
          GetInsightDocument,
          { id: params.insightId, withEvidence: false },
          ctx,
        )
      ).insight;
      if (!insight?.id)
        return toolError(`Insight "${params.insightId}" not found.`);

      const notes: string[] = [];

      if (params.category || params.status) {
        await execute(
          UpdateInsightMetaDocument,
          {
            id: insight.id,
            input: { category: params.category, status: params.status },
          },
          ctx,
        );
        notes.push("metadata updated");
      }

      const edgeInput = (goalUuid: string) => ({
        sourceType: "Insight" as const,
        sourceId: insight.id as string,
        targetType: "Goal" as const,
        targetId: goalUuid,
        edgeLabel: "SUPPORTS_GOAL" as const,
      });

      if (params.linkGoalId) {
        const goalUuid = await resolveGoalUuid(params.linkGoalId, ctx);
        if (!goalUuid)
          return toolError(`Goal "${params.linkGoalId}" not found.`);
        const result = await execute(
          LinkEntitiesDocument,
          { input: edgeInput(goalUuid) },
          ctx,
        );
        if (!result.linkEntities?.success) {
          return toolError(
            `Goal link failed: ${result.linkEntities?.error ?? "unknown error"}`,
          );
        }
        notes.push("goal linked");
      }

      if (params.unlinkGoalId) {
        const goalUuid = await resolveGoalUuid(params.unlinkGoalId, ctx);
        if (!goalUuid)
          return toolError(`Goal "${params.unlinkGoalId}" not found.`);
        const result = await execute(
          UnlinkEntitiesDocument,
          { input: edgeInput(goalUuid) },
          ctx,
        );
        if (!result.unlinkEntities?.success) {
          return toolError(
            `Goal unlink failed: ${result.unlinkEntities?.error ?? "unknown error"}`,
          );
        }
        notes.push("goal unlinked");
      }

      if (notes.length === 0) {
        return toolError("Nothing to update — pass at least one field.");
      }

      return entityResponse(
        {
          message: `Insight updated (${notes.join(", ")}).`,
          insight: {
            displayId:
              insight.displayId != null
                ? formatDisplayId("insight", insight.displayId)
                : insight.id,
            title: insight.title,
          },
        },
        { link: appLink(ctx.orgSlug, ctx.workspaceSlug, "insights") },
      );
    },
  });

  registerTool(server, {
    name: "dismiss_signal",
    title: "Dismiss Signal",
    description:
      "Permanently remove a signal from the workspace (noise, spam, or mis-ingested content). This deletes it — it cannot be recovered.",
    schema: z.object({
      signalId: z.string().describe("SI-N display ID or UUID"),
      reason: z
        .string()
        .optional()
        .describe("Why it's being removed (recorded in the response)"),
    }),
    scope: "write",
    destructive: true,
    handler: async ({ signalId, reason }, tool) => {
      const ctx = await tool.getContext();
      const signal = (await execute(GetSignalDocument, { id: signalId }, ctx))
        .signal;
      if (!signal?.id) return toolError(`Signal "${signalId}" not found.`);

      const result = await execute(
        DeleteSignalDocument,
        { id: signal.id },
        ctx,
      );
      if (!result.deleteSignal) {
        return toolError("The signal could not be removed.");
      }

      return entityResponse({
        message: `Signal ${
          signal.displayId != null
            ? formatDisplayId("signal", signal.displayId)
            : signal.id
        } permanently removed.`,
        ...(reason ? { reason } : {}),
      });
    },
  });
}
