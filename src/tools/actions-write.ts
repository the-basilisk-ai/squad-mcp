import { z } from "zod";
import {
  AssignActionDocument,
  DismissActionDocument,
  GetActionDocument,
  GetBriefDocument,
  GetInsightDocument,
  LinkActionDocument,
  MarkActionDoneDocument,
  SnoozeActionDocument,
  StartActionDocument,
  UpdateActionMetaDocument,
  UpdateActionNotesDocument,
} from "../gql/graphql.js";
import { formatDisplayId, parseEntityRef } from "../helpers/display-id.js";
import type { UserContext } from "../helpers/getUser.js";
import { appLink, entityResponse } from "../helpers/responses.js";
import { execute } from "../lib/squad-api-client.js";
import { toolError } from "./helpers.js";
import { type OAuthServer, registerTool } from "./registry.js";

type ActionEcho = {
  id?: string | null;
  displayId?: number | null;
  title?: string | null;
  status?: string | null;
  priority?: string | null;
  category?: string | null;
  effort?: string | null;
  notes?: string | null;
  snoozedUntil?: string | null;
  assignee?: { userId?: string | null; displayName?: string | null } | null;
};

async function resolveAction(
  actionId: string,
  ctx: UserContext,
): Promise<{ uuid: string; notes: string | null } | null> {
  const data = await execute(GetActionDocument, { id: actionId }, ctx);
  if (!data.action?.id) return null;
  return { uuid: data.action.id, notes: data.action.notes ?? null };
}

function echo(action: ActionEcho, ctx: UserContext, message: string) {
  return entityResponse(
    {
      message,
      action: {
        displayId:
          action.displayId != null
            ? formatDisplayId("action", action.displayId)
            : action.id,
        title: action.title,
        status: action.status,
        priority: action.priority,
        notes: action.notes,
        snoozedUntil: action.snoozedUntil,
        assignee: action.assignee?.displayName ?? null,
      },
    },
    { link: appLink(ctx.orgSlug, ctx.workspaceSlug, "actions") },
  );
}

export function registerActionWriteTools(server: OAuthServer) {
  registerTool(server, {
    name: "update_action_status",
    title: "Update Action Status",
    description:
      "Move an action through its lifecycle: start (pick it up), complete (done — close the loop when work ships), dismiss (won't do), or snooze. Optionally append a note recording why, e.g. the PR that shipped it.",
    schema: z.object({
      actionId: z.string().describe("AC-N display ID or UUID"),
      status: z.enum(["start", "complete", "dismiss", "snooze"]),
      note: z
        .string()
        .optional()
        .describe("Appended to the action's notes, e.g. 'shipped in PR #99'"),
    }),
    scope: "write",
    destructive: true,
    handler: async ({ actionId, status, note }, tool) => {
      const ctx = await tool.getContext();
      const resolved = await resolveAction(actionId, ctx);
      if (!resolved) {
        return toolError(
          `Action "${actionId}" not found. Find actions with list_actions.`,
        );
      }

      let action: ActionEcho | null | undefined;
      switch (status) {
        case "start":
          action = (
            await execute(StartActionDocument, { id: resolved.uuid }, ctx)
          ).startAction;
          break;
        case "complete":
          action = (
            await execute(MarkActionDoneDocument, { id: resolved.uuid }, ctx)
          ).markActionDone;
          break;
        case "dismiss":
          action = (
            await execute(
              DismissActionDocument,
              { actionId: resolved.uuid },
              ctx,
            )
          ).dismissAction;
          break;
        case "snooze":
          action = (
            await execute(
              SnoozeActionDocument,
              { actionId: resolved.uuid },
              ctx,
            )
          ).snoozeAction;
          break;
      }

      if (!action) {
        return toolError(
          `The ${status} transition was not applied — verify the action's current status with get_entity.`,
        );
      }

      if (note) {
        const combined = resolved.notes ? `${resolved.notes}\n\n${note}` : note;
        action =
          (
            await execute(
              UpdateActionNotesDocument,
              { actionId: resolved.uuid, notes: combined },
              ctx,
            )
          ).updateActionNotes ?? action;
      }

      return echo(action, ctx, `Action ${status} applied.`);
    },
  });

  registerTool(server, {
    name: "update_action",
    title: "Update Action",
    description:
      "Edit an action's priority, effort, category or notes; assign it; or link it to an insight or brief. notes replaces the whole notes field (use update_action_status's note to append).",
    schema: z.object({
      actionId: z.string().describe("AC-N display ID or UUID"),
      priority: z.enum(["P0", "P1", "P2"]).optional(),
      effort: z.enum(["low", "medium", "high"]).optional(),
      category: z
        .enum(["comms", "operational", "product", "strategic", "workspace"])
        .optional(),
      notes: z.string().optional().describe("Replaces the notes field"),
      assignee: z
        .string()
        .nullable()
        .optional()
        .describe('User ID, "me", or null to unassign'),
      linkInsightId: z.string().optional().describe("IN-N or UUID to link"),
      linkBriefId: z.string().optional().describe("BR-N to link"),
    }),
    scope: "write",
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const resolved = await resolveAction(params.actionId, ctx);
      if (!resolved) {
        return toolError(
          `Action "${params.actionId}" not found. Find actions with list_actions.`,
        );
      }
      const uuid = resolved.uuid;
      let last: ActionEcho | null = null;

      if (params.priority || params.effort || params.category) {
        last =
          (
            await execute(
              UpdateActionMetaDocument,
              {
                actionId: uuid,
                input: {
                  priority: params.priority,
                  effort: params.effort,
                  category: params.category,
                },
              },
              ctx,
            )
          ).updateAction ?? last;
      }

      if (params.notes !== undefined) {
        last =
          (
            await execute(
              UpdateActionNotesDocument,
              { actionId: uuid, notes: params.notes },
              ctx,
            )
          ).updateActionNotes ?? last;
      }

      if (params.assignee !== undefined) {
        last =
          (
            await execute(
              AssignActionDocument,
              {
                actionId: uuid,
                assigneeUserId:
                  params.assignee === "me"
                    ? tool.userId
                    : (params.assignee ?? undefined),
              },
              ctx,
            )
          ).assignAction ?? last;
      }

      if (params.linkInsightId || params.linkBriefId) {
        let insightId: string | undefined;
        let briefId: string | undefined;
        if (params.linkInsightId) {
          const insight = (
            await execute(
              GetInsightDocument,
              { id: params.linkInsightId, withEvidence: false },
              ctx,
            )
          ).insight;
          if (!insight?.id) {
            return toolError(`Insight "${params.linkInsightId}" not found.`);
          }
          insightId = insight.id;
        }
        if (params.linkBriefId) {
          const ref = parseEntityRef(params.linkBriefId);
          const brief = (
            await execute(
              GetBriefDocument,
              {
                displayId:
                  ref.kind === "display" ? ref.formatted : params.linkBriefId,
              },
              ctx,
            )
          ).brief;
          if (!brief?.id) {
            return toolError(`Brief "${params.linkBriefId}" not found.`);
          }
          briefId = brief.id;
        }
        last =
          (
            await execute(
              LinkActionDocument,
              { actionId: uuid, target: { insightId, briefId } },
              ctx,
            )
          ).linkAction ?? last;
      }

      if (!last) {
        return toolError(
          "Nothing to update — pass at least one field to change.",
        );
      }

      return echo(last, ctx, "Action updated.");
    },
  });
}
