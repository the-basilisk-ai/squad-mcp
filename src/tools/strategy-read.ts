import { z } from "zod";
import { ActivityStreamDocument, GoalListDocument } from "../gql/graphql.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../helpers/cursor.js";
import { formatDisplayId } from "../helpers/display-id.js";
import {
  clampLimit,
  emptyResponse,
  listResponse,
} from "../helpers/responses.js";
import { execute } from "../lib/squad-api-client.js";
import { type OAuthServer, registerTool } from "./registry.js";

export function registerStrategyReadTools(server: OAuthServer) {
  registerTool(server, {
    name: "list_goals",
    title: "List Goals",
    description:
      "Strategic goals ordered by importance. Use get_entity(GL-N) for a goal's supporting insights.",
    schema: z.object({
      minImportance: z.number().int().optional(),
      limit: z.number().int().optional(),
      cursor: z.string().optional(),
    }),
    scope: "read",
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const limit = clampLimit(params.limit);
      const offset = decodeOffsetCursor(params.cursor);

      const data = await execute(
        GoalListDocument,
        { limit: limit + 1, offset, minImportance: params.minImportance },
        ctx,
      );

      const rows = data.goalList ?? [];
      if (rows.length === 0) {
        return emptyResponse(
          "No goals defined yet.",
          "Goals frame everything else — set them in the Squad app.",
        );
      }

      return listResponse(
        rows.slice(0, limit).map(g => ({
          id: g.id ?? "",
          displayId:
            g.displayId != null
              ? formatDisplayId("goal", g.displayId)
              : undefined,
          title: g.title ?? "(untitled)",
          extra: {
            importance: g.importance ?? null,
            updatedAt: g.updatedAt ?? null,
          },
        })),
        {
          nextCursor:
            rows.length > limit
              ? encodeOffsetCursor(offset + limit)
              : undefined,
        },
      );
    },
  });

  registerTool(server, {
    name: "get_activity",
    title: "Get Activity",
    description:
      "The workspace change feed (humans and Squad agents), newest first — 'what happened since I last looked?'. Filter by entity type, actor type or agent; paginate with the cursor.",
    schema: z.object({
      entityTypes: z
        .array(z.string())
        .optional()
        .describe("e.g. signal, insight, action, goal, document"),
      actorType: z
        .enum(["human", "agent"])
        .optional()
        .describe("Only human or only agent activity"),
      agentId: z.string().optional(),
      limit: z.number().int().optional(),
      cursor: z.string().optional(),
    }),
    scope: "read",
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const data = await execute(
        ActivityStreamDocument,
        {
          first: clampLimit(params.limit),
          after: params.cursor,
          entityType: params.entityTypes,
          actorType: params.actorType ? [params.actorType] : undefined,
          agentId: params.agentId,
        },
        ctx,
      );

      const feed = data.activityStream;
      const events = feed?.events ?? [];
      if (events.length === 0) {
        return emptyResponse("No activity matches those filters.");
      }

      const items = events.flatMap(e =>
        e.id
          ? [
              {
                id: e.id,
                title: `${e.actorUser?.displayName ?? e.agentName ?? e.actorType ?? "unknown"} ${e.action ?? "changed"} ${e.entityType ?? "entity"}`,
                type: e.entityType ?? undefined,
                extra: {
                  action: e.action ?? null,
                  actorType: e.actorType ?? null,
                  agentName: e.agentName ?? null,
                  entityId: e.entityId ?? null,
                  at: e.createdAt ?? null,
                },
              },
            ]
          : [],
      );

      return listResponse(items, {
        nextCursor:
          feed?.hasNextPage && feed.endCursor ? feed.endCursor : undefined,
      });
    },
  });
}
