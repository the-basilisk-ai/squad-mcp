import { z } from "zod";
import {
  ClusterListDocument,
  GetClusterDocument,
  GetSignalRelatedDocument,
  GoalInsightsDocument,
  InsightListDocument,
  SignalListDocument,
} from "../gql/graphql.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../helpers/cursor.js";
import { formatDisplayId } from "../helpers/display-id.js";
import {
  INSIGHT_CATEGORIES,
  INSIGHT_STATUSES,
  SIGNAL_SOURCES,
  SIGNAL_TYPES,
} from "../helpers/enums.js";
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

export function registerEvidenceTools(server: OAuthServer) {
  registerTool(server, {
    name: "list_signals",
    title: "List Signals",
    description:
      "Browse raw feedback signals with filters for source, type, sentiment, cluster and date range. Dismissed signals are excluded unless includeDismissed is set. Rows are summaries; use get_entity(SI-N) for full content.",
    schema: z.object({
      source: z.enum(SIGNAL_SOURCES).optional(),
      signalType: z.enum(SIGNAL_TYPES).optional(),
      sentiment: z
        .enum(["positive", "neutral", "negative", "mixed"])
        .optional(),
      clusterId: z.string().optional().describe("Cluster UUID to filter by"),
      since: z.string().optional().describe("ISO-8601 datetime lower bound"),
      until: z.string().optional().describe("ISO-8601 datetime upper bound"),
      includeDismissed: z.boolean().optional(),
      limit: z.number().int().optional(),
      cursor: z.string().optional(),
    }),
    scope: "read",
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const limit = clampLimit(params.limit);
      const offset = decodeOffsetCursor(params.cursor);

      const data = await execute(
        SignalListDocument,
        {
          limit: limit + 1,
          offset,
          source: params.source,
          signalType: params.signalType,
          sentiment: params.sentiment,
          clusterId: params.clusterId,
          createdAfter: params.since,
          createdBefore: params.until,
          status: params.includeDismissed ? undefined : ["active", "stale"],
        },
        ctx,
      );

      const rows = data.signalList ?? [];
      const items: ListItem[] = rows.slice(0, limit).map(s => ({
        id: s.id ?? "",
        displayId:
          s.displayId != null
            ? formatDisplayId("signal", s.displayId)
            : undefined,
        title: s.contentSummary ?? "(no summary)",
        status: s.status ?? undefined,
        type: s.signalType ?? undefined,
        extra: {
          source: s.source ?? null,
          sentiment: s.sentiment ?? null,
          occurrences: s.occurrenceCount ?? null,
          cluster: s.cluster?.label ?? null,
          createdAt: s.createdAt ?? null,
        },
      }));

      if (items.length === 0) {
        return emptyResponse(
          "No signals match those filters.",
          "Loosen the filters, or ingest feedback once write tools ship.",
        );
      }

      return listResponse(items, {
        nextCursor:
          rows.length > limit ? encodeOffsetCursor(offset + limit) : undefined,
      });
    },
  });

  registerTool(server, {
    name: "find_similar_signals",
    title: "Find Similar Signals",
    description:
      "Semantically related signals for a given signal (SI-N or UUID) — 'has anyone else said this?'. Useful before ingesting potentially duplicate feedback.",
    schema: z.object({
      signalId: z.string().describe("SI-N display ID or UUID"),
      limit: z.number().int().optional().describe("Default 5, max 20"),
    }),
    scope: "read",
    handler: async ({ signalId, limit }, tool) => {
      const ctx = await tool.getContext();
      const data = await execute(
        GetSignalRelatedDocument,
        { id: signalId, limit: Math.min(limit ?? 5, 20) },
        ctx,
      );

      if (!data.signal) {
        return toolError(`Signal "${signalId}" not found in this workspace.`);
      }

      const related = data.signal.relatedSignals ?? [];
      if (related.length === 0) {
        return emptyResponse("No similar signals found.");
      }

      return listResponse(
        related.map(s => ({
          id: s.id ?? "",
          displayId:
            s.displayId != null
              ? formatDisplayId("signal", s.displayId)
              : undefined,
          title: s.contentSummary ?? "(no summary)",
          type: s.signalType ?? undefined,
          extra: { source: s.source ?? null, strength: s.strength ?? null },
        })),
      );
    },
  });

  registerTool(server, {
    name: "list_clusters",
    title: "List Clusters",
    description:
      "Browse signal clusters (recurring themes in feedback) with sizes and labels. Use get_cluster for members and linked insights.",
    schema: z.object({
      signalType: z.enum(SIGNAL_TYPES).optional(),
      includeUnlabeled: z.boolean().optional(),
      limit: z.number().int().optional(),
      cursor: z.string().optional(),
    }),
    scope: "read",
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const limit = clampLimit(params.limit);
      const offset = decodeOffsetCursor(params.cursor);

      const data = await execute(
        ClusterListDocument,
        {
          limit: limit + 1,
          offset,
          signalType: params.signalType,
          requireLabel: !params.includeUnlabeled,
        },
        ctx,
      );

      const rows = data.clusterList ?? [];
      if (rows.length === 0) {
        return emptyResponse(
          "No clusters yet.",
          "Clusters form as signals accumulate; check list_signals.",
        );
      }

      return listResponse(
        rows.slice(0, limit).map(c => ({
          id: c.id ?? "",
          displayId:
            c.displayId != null
              ? formatDisplayId("cluster", c.displayId)
              : undefined,
          title: c.label ?? "(unlabeled)",
          type: c.signalType ?? undefined,
          counts: { members: c.memberCount ?? 0 },
          extra: {
            cohesion: c.cohesionScore ?? null,
            updatedAt: c.updatedAt ?? null,
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
    name: "get_cluster",
    title: "Get Cluster",
    description:
      "A cluster's label, stats, member signals (capped) and linked insights. Pass the cluster UUID or CL-N from list_clusters.",
    schema: z.object({
      clusterId: z.string().describe("Cluster UUID or CL-N display ID"),
    }),
    scope: "read",
    handler: async ({ clusterId }, tool) => {
      const ctx = await tool.getContext();
      const data = await execute(GetClusterDocument, { id: clusterId }, ctx);

      if (!data.cluster) {
        return toolError(`Cluster "${clusterId}" not found in this workspace.`);
      }

      const c = data.cluster;
      const members = c.signals ?? [];
      return entityResponse(
        {
          entityType: "cluster",
          displayId:
            c.displayId != null
              ? formatDisplayId("cluster", c.displayId)
              : c.id,
          label: c.label,
          signalType: c.signalType,
          memberCount: c.memberCount,
          cohesionScore: c.cohesionScore,
          labelConfidence: c.labelConfidence,
          memberSignals: members.slice(0, 15).map(s => ({
            displayId:
              s.displayId != null
                ? formatDisplayId("signal", s.displayId)
                : s.id,
            summary: s.contentSummary,
            source: s.source,
          })),
          ...(members.length > 15
            ? { memberNote: `Showing 15 of ${members.length} member signals.` }
            : {}),
          linkedInsights: (c.linkedInsights ?? []).map(i => ({
            displayId:
              i.displayId != null
                ? formatDisplayId("insight", i.displayId)
                : i.id,
            title: i.title,
            combinedScore: i.combinedScore,
          })),
        },
        { link: appLink(ctx.orgSlug, ctx.workspaceSlug, "signals") },
      );
    },
  });

  registerTool(server, {
    name: "list_insights",
    title: "List Insights",
    description:
      'Browse distilled insights ranked by combined score, with category/score/status filters or scoped to a goal. Use get_entity(IN-N, include: ["evidence"]) for the supporting signals.',
    schema: z.object({
      goalId: z.string().optional().describe("GL-N or UUID to scope by goal"),
      category: z
        .enum(INSIGHT_CATEGORIES)
        .optional()
        .describe(
          "Filter by category: pain_point, feature_request, positive_signal, trend, or risk",
        ),
      minScore: z.number().optional().describe("Minimum combined score"),
      status: z
        .enum(INSIGHT_STATUSES)
        .optional()
        .describe("Filter by status: active, stale, archived, or resolved"),
      limit: z.number().int().optional(),
      cursor: z.string().optional(),
    }),
    scope: "read",
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const limit = clampLimit(params.limit);

      if (params.goalId) {
        const data = await execute(
          GoalInsightsDocument,
          { goalId: params.goalId },
          ctx,
        );
        if (!data.goal) {
          return toolError(`Goal "${params.goalId}" not found.`);
        }
        const rows = (data.goal.insights ?? []).slice(0, limit);
        if (rows.length === 0) {
          return emptyResponse("No insights support this goal yet.");
        }
        return listResponse(
          rows.map(i => ({
            id: i.id ?? "",
            displayId:
              i.displayId != null
                ? formatDisplayId("insight", i.displayId)
                : undefined,
            title: i.title ?? "(untitled)",
            status: i.status ?? undefined,
            type: i.category ?? undefined,
            counts: { evidence: i.evidenceCount ?? 0 },
            extra: { combinedScore: i.combinedScore ?? null },
          })),
        );
      }

      const offset = decodeOffsetCursor(params.cursor);
      const data = await execute(
        InsightListDocument,
        {
          limit: limit + 1,
          offset,
          category: params.category,
          minCombinedScore: params.minScore,
          status: params.status,
        },
        ctx,
      );

      const rows = data.insightList ?? [];
      if (rows.length === 0) {
        return emptyResponse(
          "No insights match those filters.",
          "Insights appear as the pipeline distils signals; see list_clusters for themes.",
        );
      }

      return listResponse(
        rows.slice(0, limit).map(i => ({
          id: i.id ?? "",
          displayId:
            i.displayId != null
              ? formatDisplayId("insight", i.displayId)
              : undefined,
          title: i.title ?? "(untitled)",
          status: i.status ?? undefined,
          type: i.category ?? undefined,
          counts: {
            evidence: i.evidenceCount ?? 0,
            goals: i.goalCount ?? 0,
          },
          extra: { combinedScore: i.combinedScore ?? null },
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
}
