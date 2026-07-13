import { z } from "zod";
import {
  ActionContextDocument,
  ListActionsDocument,
  ListActionsForInsightDocument,
} from "../gql/graphql.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../helpers/cursor.js";
import { formatDisplayId } from "../helpers/display-id.js";
import {
  appLink,
  clampLimit,
  emptyResponse,
  entityResponse,
  type ListItem,
  listResponse,
} from "../helpers/responses.js";
import { execute } from "../lib/squad-api-client.js";
import { toolError } from "./helpers.js";
import { type OAuthServer, registerTool } from "./registry.js";

const ACTION_STATUSES = [
  "suggested",
  "in_progress",
  "completed",
  "dismissed",
] as const;

const CONTEXT_EVIDENCE_CAP = 8;

export function registerActionReadTools(server: OAuthServer) {
  registerTool(server, {
    name: "list_actions",
    title: "List Actions",
    description:
      "Ranked actions (what the evidence says to do next) filtered by status, assignee, priority or parent insight. Defaults to open work: suggested and in_progress, snoozed excluded. Use get_action_context before working on one.",
    schema: z.object({
      statuses: z.array(z.enum(ACTION_STATUSES)).optional(),
      assignee: z
        .string()
        .optional()
        .describe('User ID, or "me" for the authenticated user'),
      insightId: z
        .string()
        .optional()
        .describe("Scope to actions of one insight (IN-N or UUID)"),
      priority: z.array(z.enum(["P0", "P1", "P2"])).optional(),
      includeSnoozed: z.boolean().optional(),
      limit: z.number().int().optional(),
      cursor: z.string().optional(),
    }),
    scope: "read",
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const limit = clampLimit(params.limit);
      const offset = decodeOffsetCursor(params.cursor);
      const statuses = params.statuses ?? ["suggested", "in_progress"];

      const rows = params.insightId
        ? ((
            await execute(
              ListActionsForInsightDocument,
              {
                insightId: params.insightId,
                limit: limit + 1,
                offset,
                status: statuses,
                includeSnoozed: params.includeSnoozed,
              },
              ctx,
            )
          ).actionList ?? [])
        : ((
            await execute(
              ListActionsDocument,
              {
                limit: limit + 1,
                offset,
                statuses,
                assigneeUserId:
                  params.assignee === "me" ? tool.userId : params.assignee,
                includeSnoozed: params.includeSnoozed,
                priority: params.priority,
              },
              ctx,
            )
          ).actions ?? []);

      if (rows.length === 0) {
        return emptyResponse(
          "No actions match those filters.",
          "Try including more statuses, or look at list_insights for what the evidence is pointing to.",
        );
      }

      const items: ListItem[] = rows.slice(0, limit).map(a => ({
        id: a.id ?? "",
        displayId:
          a.displayId != null
            ? formatDisplayId("action", a.displayId)
            : undefined,
        title: a.title ?? "(untitled)",
        status: a.status ?? undefined,
        extra: {
          priority: a.priority ?? null,
          effort: a.effort ?? null,
          assignee: a.assignee?.displayName ?? null,
          insight:
            a.insight?.displayId != null
              ? formatDisplayId("insight", a.insight.displayId)
              : null,
          dueAt: a.dueAt ?? null,
        },
      }));

      return listResponse(items, {
        nextCursor:
          rows.length > limit ? encodeOffsetCursor(offset + limit) : undefined,
      });
    },
  });

  registerTool(server, {
    name: "get_action_context",
    title: "Get Action Context",
    description:
      "Everything needed to execute an action in one call: the action, why it exists (parent insight), the customer evidence behind it (top signals with source links), and the goals it serves. Call this before implementing or deciding on an action.",
    schema: z.object({
      actionId: z.string().describe("AC-N display ID or UUID"),
    }),
    scope: "read",
    handler: async ({ actionId }, tool) => {
      const ctx = await tool.getContext();
      const data = await execute(ActionContextDocument, { id: actionId }, ctx);

      const action = data.action;
      if (!action) {
        return toolError(
          `Action "${actionId}" not found in this workspace. Find actions with list_actions.`,
        );
      }

      const insight = action.insight;
      const allSignals = insight?.signals ?? [];
      const evidence = allSignals.slice(0, CONTEXT_EVIDENCE_CAP).map(s => ({
        displayId:
          s.displayId != null ? formatDisplayId("signal", s.displayId) : s.id,
        quote: s.contentSummary ?? s.content,
        source: s.source,
        sourceUrl: s.externalSource?.sourceUri ?? null,
        capturedAt: s.createdAt,
      }));

      return entityResponse(
        {
          action: {
            displayId:
              action.displayId != null
                ? formatDisplayId("action", action.displayId)
                : action.id,
            title: action.title,
            status: action.status,
            priority: action.priority,
            category: action.category,
            effort: action.effort,
            body: action.body,
            rationale: action.rationale,
            notes: action.notes,
            assignee: action.assignee?.displayName ?? null,
            dueAt: action.dueAt,
            outputDocument:
              action.outputDocument?.displayId != null
                ? formatDisplayId("document", action.outputDocument.displayId)
                : null,
          },
          why: insight
            ? {
                insight:
                  insight.displayId != null
                    ? formatDisplayId("insight", insight.displayId)
                    : insight.id,
                title: insight.title,
                description: insight.description,
                category: insight.category,
                combinedScore: insight.combinedScore,
                totalEvidence: insight.evidenceCount,
              }
            : { note: "No linked insight — this action stands alone." },
          evidence: evidence.length
            ? evidence
            : { note: "No supporting signals available." },
          ...(allSignals.length > CONTEXT_EVIDENCE_CAP
            ? {
                evidenceNote: `Showing ${CONTEXT_EVIDENCE_CAP} of ${allSignals.length} signals. get_entity(${insight?.displayId != null ? formatDisplayId("insight", insight.displayId) : "the insight"}, include: ["evidence"]) for more.`,
              }
            : {}),
          strategy: insight?.goals?.length
            ? insight.goals.map(g => ({
                displayId:
                  g.displayId != null
                    ? formatDisplayId("goal", g.displayId)
                    : g.id,
                title: g.title,
                importance: g.importance,
              }))
            : { note: "Not linked to a goal yet." },
        },
        {
          link: appLink(ctx.orgSlug, ctx.workspaceSlug, "actions"),
        },
      );
    },
  });
}
