import { z } from "zod";
import {
  AddDocumentTagDocument,
  BriefListDocument,
  CreateDocumentDocument,
  DocumentListDocument,
  DocumentTextSearchDocument,
  GenerateBriefFromActionDocument,
  GenerateBriefFromInsightDocument,
  GetActionDocument,
  GetBriefDocument,
  GetDocumentMetaDocument,
  GetInsightDocument,
  RemoveDocumentTagDocument,
  RetryBriefGenerationDocument,
  SetBriefStatusDocument,
  UpdateDocumentDocument,
} from "../gql/graphql.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../helpers/cursor.js";
import { formatDisplayId, parseEntityRef } from "../helpers/display-id.js";
import type { UserContext } from "../helpers/getUser.js";
import {
  appLink,
  asyncTriggerResponse,
  clampLimit,
  emptyResponse,
  entityResponse,
  listResponse,
} from "../helpers/responses.js";
import { execute } from "../lib/squad-api-client.js";
import { toolError } from "./helpers.js";
import { type OAuthServer, registerTool } from "./registry.js";

function normaliseTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// The platform kept the legacy "one_pager" DocumentKind alongside the new
// "brief" kind during the rename rollout, so accept either as a brief.
function isBriefKind(kind: string | null | undefined): boolean {
  return kind === "brief" || kind === "one_pager";
}

async function resolveDocumentUuid(
  documentId: string,
  ctx: UserContext,
): Promise<string | null> {
  const data = await execute(GetDocumentMetaDocument, { id: documentId }, ctx);
  return data.document?.id ?? null;
}

export function registerKnowledgeTools(server: OAuthServer) {
  registerTool(server, {
    name: "list_documents",
    title: "List Documents",
    description:
      "Browse workspace knowledge documents (and briefs) with their paths and tags. Use get_entity(DC-N) to read one as markdown.",
    schema: z.object({
      tag: z.string().optional().describe("Filter this page by tag"),
      limit: z.number().int().optional(),
      cursor: z.string().optional(),
    }),
    scope: "read",
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const limit = clampLimit(params.limit);
      const offset = decodeOffsetCursor(params.cursor);

      const data = await execute(
        DocumentListDocument,
        { limit: limit + 1, offset },
        ctx,
      );

      let rows = data.documentList ?? [];
      const hasMore = rows.length > limit;
      rows = rows.slice(0, limit);
      if (params.tag) {
        rows = rows.filter(d => d.tags?.includes(params.tag as string));
      }

      if (rows.length === 0) {
        return emptyResponse(
          params.tag
            ? `No documents on this page carry the tag "${params.tag}".`
            : "No documents yet.",
          "Create one with create_document, or search with search.",
        );
      }

      return listResponse(
        rows.map(d => ({
          id: d.id ?? "",
          displayId:
            d.displayId != null
              ? formatDisplayId(
                  isBriefKind(d.kind) ? "brief" : "document",
                  d.displayId,
                )
              : undefined,
          title: d.title ?? "(untitled)",
          type: d.kind ?? undefined,
          status: d.briefStatus ?? undefined,
          extra: {
            path: d.path ?? null,
            tags: d.tags?.join(", ") ?? null,
            updatedAt: d.updatedAt ?? null,
          },
        })),
        {
          nextCursor: hasMore ? encodeOffsetCursor(offset + limit) : undefined,
          ...(params.tag
            ? {
                note: "Tag filter applies per page; paginate for full coverage.",
              }
            : {}),
        },
      );
    },
  });

  registerTool(server, {
    name: "create_document",
    title: "Create Document",
    description:
      "Create a knowledge document from markdown (research summaries, meeting notes, analyses). A document with a near-identical title returns the existing one instead — extend it with update_document. Don't start the markdown with the title as a heading; the title renders separately.",
    schema: z.object({
      title: z.string().min(1),
      markdown: z.string().min(1),
      directoryId: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
    scope: "write",
    handler: async ({ title, markdown, directoryId, tags }, tool) => {
      const ctx = await tool.getContext();

      const search = await execute(
        DocumentTextSearchDocument,
        { search: title, limit: 5 },
        ctx,
      );
      const wanted = normaliseTitle(title);
      const duplicate = (search.documentSearch ?? []).find(
        d => d.title && normaliseTitle(d.title) === wanted,
      );
      if (duplicate) {
        return entityResponse({
          deduplicated: true,
          message:
            "A document with this title already exists — returning it instead of creating a duplicate. Use update_document to extend it.",
          document: {
            displayId:
              duplicate.displayId != null
                ? formatDisplayId(
                    isBriefKind(duplicate.kind) ? "brief" : "document",
                    duplicate.displayId,
                  )
                : duplicate.id,
            title: duplicate.title,
          },
        });
      }

      const created = (
        await execute(
          CreateDocumentDocument,
          { input: { title, content: markdown, directoryId } },
          ctx,
        )
      ).createDocument;
      if (!created?.id) return toolError("Document creation returned nothing.");

      for (const tag of tags ?? []) {
        await execute(AddDocumentTagDocument, { id: created.id, tag }, ctx);
      }

      return entityResponse(
        {
          message: "Document created.",
          document: {
            displayId:
              created.displayId != null
                ? formatDisplayId("document", created.displayId)
                : created.id,
            title: created.title,
            path: created.path,
            tags: tags ?? [],
          },
        },
        { link: appLink(ctx.orgSlug, ctx.workspaceSlug, "documents") },
      );
    },
  });

  registerTool(server, {
    name: "update_document",
    title: "Update Document",
    description:
      "Replace a document's markdown body and/or title, and manage tags. A version snapshot is created, so the previous content stays recoverable in the app.",
    schema: z.object({
      documentId: z.string().describe("DC-N display ID or UUID"),
      markdown: z.string().optional().describe("Replaces the entire body"),
      title: z.string().optional(),
      addTags: z.array(z.string()).optional(),
      removeTags: z.array(z.string()).optional(),
    }),
    scope: "write",
    destructive: true,
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const uuid = await resolveDocumentUuid(params.documentId, ctx);
      if (!uuid) return toolError(`Document "${params.documentId}" not found.`);

      const changes: string[] = [];

      if (params.markdown !== undefined || params.title !== undefined) {
        const updated = (
          await execute(
            UpdateDocumentDocument,
            {
              id: uuid,
              input: {
                content: params.markdown,
                title: params.title,
                createVersion: true,
              },
            },
            ctx,
          )
        ).updateDocument;
        if (!updated) return toolError("Document update returned nothing.");
        changes.push(
          params.markdown !== undefined ? "body replaced" : "title updated",
        );
      }

      for (const tag of params.addTags ?? []) {
        await execute(AddDocumentTagDocument, { id: uuid, tag }, ctx);
        changes.push(`tag +${tag}`);
      }
      for (const tag of params.removeTags ?? []) {
        await execute(RemoveDocumentTagDocument, { id: uuid, tag }, ctx);
        changes.push(`tag -${tag}`);
      }

      if (changes.length === 0) {
        return toolError("Nothing to update — pass at least one field.");
      }

      return entityResponse(
        {
          message: `Document updated (${changes.join(", ")}). A version snapshot preserves the previous content.`,
        },
        { link: appLink(ctx.orgSlug, ctx.workspaceSlug, "documents") },
      );
    },
  });

  registerTool(server, {
    name: "list_briefs",
    title: "List Briefs",
    description:
      "Briefs with their status (building/draft/in_review/finalised/failed) and recommendation. Read one with get_entity(BR-N).",
    schema: z.object({
      status: z
        .array(
          z.enum(["building", "draft", "in_review", "finalised", "failed"]),
        )
        .optional(),
      type: z.enum(["decision", "prd"]).optional(),
      sourceInsightId: z.string().optional().describe("IN-N or UUID"),
      limit: z.number().int().optional(),
      cursor: z.string().optional(),
    }),
    scope: "read",
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const limit = clampLimit(params.limit);
      const offset = decodeOffsetCursor(params.cursor);

      let sourceInsightId = params.sourceInsightId;
      if (sourceInsightId) {
        const ref = parseEntityRef(sourceInsightId);
        if (ref.kind === "display") {
          const insight = (
            await execute(
              GetInsightDocument,
              { id: ref.formatted, withEvidence: false },
              ctx,
            )
          ).insight;
          if (!insight?.id) {
            return toolError(`Insight "${params.sourceInsightId}" not found.`);
          }
          sourceInsightId = insight.id;
        }
      }

      const data = await execute(
        BriefListDocument,
        {
          limit: limit + 1,
          offset,
          filters: {
            briefStatus: params.status,
            briefType: params.type,
            sourceInsightId,
          },
        },
        ctx,
      );

      const rows = data.briefList ?? [];
      if (rows.length === 0) {
        return emptyResponse(
          "No briefs match.",
          "Generate one from an action or insight with generate_brief.",
        );
      }

      return listResponse(
        rows.slice(0, limit).map(d => ({
          id: d.id ?? "",
          displayId:
            d.displayId != null
              ? formatDisplayId("brief", d.displayId)
              : undefined,
          title: d.title ?? "(untitled)",
          status: d.briefStatus ?? undefined,
          type: d.briefType ?? undefined,
          extra: {
            recommendation: d.decisionRecommendation ?? null,
            sourceInsight:
              d.sourceInsight?.displayId != null
                ? formatDisplayId("insight", d.sourceInsight.displayId)
                : null,
            sourceAction:
              d.sourceAction?.displayId != null
                ? formatDisplayId("action", d.sourceAction.displayId)
                : null,
            updatedAt: d.updatedAt ?? null,
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
    name: "generate_brief",
    title: "Generate Brief",
    description:
      "Kick off AI generation of a brief from an action (AC-N) or insight (IN-N) — pass exactly one. Generation is asynchronous: poll the returned BR-N with get_entity until status moves past building. Pass retryBriefId instead to retry a failed generation.",
    schema: z.object({
      actionId: z.string().optional().describe("AC-N or UUID"),
      insightId: z.string().optional().describe("IN-N or UUID"),
      type: z.enum(["decision", "prd"]).optional(),
      retryBriefId: z
        .string()
        .optional()
        .describe("BR-N of a failed brief to retry"),
    }),
    scope: "write",
    handler: async ({ actionId, insightId, type, retryBriefId }, tool) => {
      const provided = [actionId, insightId, retryBriefId].filter(Boolean);
      if (provided.length !== 1) {
        return toolError(
          "Pass exactly one of actionId, insightId or retryBriefId.",
        );
      }
      const ctx = await tool.getContext();

      if (retryBriefId) {
        const meta = await execute(
          GetDocumentMetaDocument,
          { id: retryBriefId },
          ctx,
        );
        if (!meta.document?.id) {
          return toolError(`Brief "${retryBriefId}" not found.`);
        }
        const retried = (
          await execute(
            RetryBriefGenerationDocument,
            { briefId: meta.document.id },
            ctx,
          )
        ).retryBriefGeneration;
        return asyncTriggerResponse({
          id: meta.document.id,
          displayId:
            retried?.displayId != null
              ? formatDisplayId("brief", retried.displayId)
              : undefined,
          status: retried?.briefStatus ?? "building",
        });
      }

      if (actionId) {
        const action = (await execute(GetActionDocument, { id: actionId }, ctx))
          .action;
        if (!action?.id) return toolError(`Action "${actionId}" not found.`);
        const payload = (
          await execute(
            GenerateBriefFromActionDocument,
            { actionId: action.id, type },
            ctx,
          )
        ).generateBriefFromAction;
        if (!payload?.briefId) {
          return toolError("Brief generation did not start.");
        }
        return asyncTriggerResponse({
          id: payload.briefId,
          displayId: payload.briefDisplayId ?? undefined,
          status: "building",
          note: "Generation takes a little while; poll with get_entity.",
        });
      }

      const insight = (
        await execute(
          GetInsightDocument,
          { id: insightId as string, withEvidence: false },
          ctx,
        )
      ).insight;
      if (!insight?.id) return toolError(`Insight "${insightId}" not found.`);
      const doc = (
        await execute(
          GenerateBriefFromInsightDocument,
          { insightId: insight.id, type },
          ctx,
        )
      ).generateBriefFromInsight;
      if (!doc?.id) return toolError("Brief generation did not start.");
      return asyncTriggerResponse({
        id: doc.id,
        displayId:
          doc.displayId != null
            ? formatDisplayId("brief", doc.displayId)
            : undefined,
        status: doc.briefStatus ?? "building",
        note: "Generation takes a little while; poll with get_entity.",
      });
    },
  });

  registerTool(server, {
    name: "update_brief_status",
    title: "Update Brief Status",
    description:
      "Move a brief (BR-N) through its review lifecycle: draft, in_review, or finalised. Finalising records the decision. The building and failed states are managed by generation and can't be set here.",
    schema: z.object({
      briefId: z.string().describe("BR-N display ID or UUID"),
      status: z
        .enum(["draft", "in_review", "finalised"])
        .describe("The review status to move the brief to"),
    }),
    scope: "write",
    handler: async ({ briefId, status }, tool) => {
      const ctx = await tool.getContext();
      const ref = parseEntityRef(briefId);
      const existing = (
        await execute(
          GetBriefDocument,
          { displayId: ref.kind === "display" ? ref.formatted : briefId },
          ctx,
        )
      ).brief;
      if (!existing?.id) {
        return toolError(
          `Brief "${briefId}" not found. Find briefs with list_briefs.`,
        );
      }

      const updated = (
        await execute(
          SetBriefStatusDocument,
          { briefId: existing.id, status },
          ctx,
        )
      ).setBriefStatus;
      if (!updated) {
        return toolError(
          "The status change was not applied — check the brief with get_entity.",
        );
      }

      return entityResponse(
        {
          message: `Brief moved to ${status}.`,
          brief: {
            displayId:
              updated.displayId != null
                ? formatDisplayId("brief", updated.displayId)
                : updated.id,
            title: updated.title,
            status: updated.briefStatus,
          },
        },
        { link: appLink(ctx.orgSlug, ctx.workspaceSlug, "documents") },
      );
    },
  });
}
