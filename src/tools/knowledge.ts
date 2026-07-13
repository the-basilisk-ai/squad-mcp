import { z } from "zod";
import {
  AddDocumentTagDocument,
  CreateDocumentDocument,
  DocumentListDocument,
  DocumentTextSearchDocument,
  GenerateOnePagerFromActionDocument,
  GenerateOnePagerFromInsightDocument,
  GetActionDocument,
  GetDocumentMetaDocument,
  GetInsightDocument,
  OnePagerListDocument,
  RemoveDocumentTagDocument,
  RetryOnePagerGenerationDocument,
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
      "Browse workspace knowledge documents (and decision briefs) with their paths and tags. Use get_entity(DC-N) to read one as markdown.",
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
                  d.kind === "one_pager" ? "one_pager" : "document",
                  d.displayId,
                )
              : undefined,
          title: d.title ?? "(untitled)",
          type: d.kind ?? undefined,
          status: d.onePagerStatus ?? undefined,
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
                    duplicate.kind === "one_pager" ? "one_pager" : "document",
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
    name: "list_one_pagers",
    title: "List Decision Briefs",
    description:
      "Decision briefs (one-pagers) with their status (building/draft/in_review/finalised/failed) and recommendation. Read one with get_entity(OP-N).",
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
        OnePagerListDocument,
        {
          limit: limit + 1,
          offset,
          filters: {
            onePagerStatus: params.status,
            onePagerType: params.type,
            sourceInsightId,
          },
        },
        ctx,
      );

      const rows = data.onePagerList ?? [];
      if (rows.length === 0) {
        return emptyResponse(
          "No decision briefs match.",
          "Generate one from an action or insight with generate_one_pager.",
        );
      }

      return listResponse(
        rows.slice(0, limit).map(d => ({
          id: d.id ?? "",
          displayId:
            d.displayId != null
              ? formatDisplayId("one_pager", d.displayId)
              : undefined,
          title: d.title ?? "(untitled)",
          status: d.onePagerStatus ?? undefined,
          type: d.onePagerType ?? undefined,
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
    name: "generate_one_pager",
    title: "Generate Decision Brief",
    description:
      "Kick off AI generation of a decision brief from an action (AC-N) or insight (IN-N) — pass exactly one. Generation is asynchronous: poll the returned OP-N with get_entity until status moves past building. Pass retryOnePagerId instead to retry a failed generation.",
    schema: z.object({
      actionId: z.string().optional().describe("AC-N or UUID"),
      insightId: z.string().optional().describe("IN-N or UUID"),
      type: z.enum(["decision", "prd"]).optional(),
      retryOnePagerId: z
        .string()
        .optional()
        .describe("OP-N of a failed brief to retry"),
    }),
    scope: "write",
    handler: async ({ actionId, insightId, type, retryOnePagerId }, tool) => {
      const provided = [actionId, insightId, retryOnePagerId].filter(Boolean);
      if (provided.length !== 1) {
        return toolError(
          "Pass exactly one of actionId, insightId or retryOnePagerId.",
        );
      }
      const ctx = await tool.getContext();

      if (retryOnePagerId) {
        const meta = await execute(
          GetDocumentMetaDocument,
          { id: retryOnePagerId },
          ctx,
        );
        if (!meta.document?.id) {
          return toolError(`Decision brief "${retryOnePagerId}" not found.`);
        }
        const retried = (
          await execute(
            RetryOnePagerGenerationDocument,
            { onePagerId: meta.document.id },
            ctx,
          )
        ).retryOnePagerGeneration;
        return asyncTriggerResponse({
          id: meta.document.id,
          displayId:
            retried?.displayId != null
              ? formatDisplayId("one_pager", retried.displayId)
              : undefined,
          status: retried?.onePagerStatus ?? "building",
        });
      }

      if (actionId) {
        const action = (await execute(GetActionDocument, { id: actionId }, ctx))
          .action;
        if (!action?.id) return toolError(`Action "${actionId}" not found.`);
        const payload = (
          await execute(
            GenerateOnePagerFromActionDocument,
            { actionId: action.id, type },
            ctx,
          )
        ).generateOnePagerFromAction;
        if (!payload?.onePagerId) {
          return toolError("Brief generation did not start.");
        }
        return asyncTriggerResponse({
          id: payload.onePagerId,
          displayId: payload.onePagerDisplayId ?? undefined,
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
          GenerateOnePagerFromInsightDocument,
          { insightId: insight.id, type },
          ctx,
        )
      ).generateOnePagerFromInsight;
      if (!doc?.id) return toolError("Brief generation did not start.");
      return asyncTriggerResponse({
        id: doc.id,
        displayId:
          doc.displayId != null
            ? formatDisplayId("one_pager", doc.displayId)
            : undefined,
        status: doc.onePagerStatus ?? "building",
        note: "Generation takes a little while; poll with get_entity.",
      });
    },
  });
}
