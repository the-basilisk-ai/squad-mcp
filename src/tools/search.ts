import { z } from "zod";
import {
  CommandSearchDocument,
  DocumentTextSearchDocument,
} from "../gql/graphql.js";
import { type EntityType, formatDisplayId } from "../helpers/display-id.js";
import type { UserContext } from "../helpers/getUser.js";
import {
  clampLimit,
  emptyResponse,
  type ListItem,
  listResponse,
} from "../helpers/responses.js";
import { execute } from "../lib/squad-api-client.js";
import { type OAuthServer, registerTool } from "./registry.js";

const SEARCH_TYPES = [
  "signal",
  "insight",
  "action",
  "goal",
  "document",
  "cluster",
] as const;

type SearchType = (typeof SEARCH_TYPES)[number];

/**
 * v1 executor: keyword/title search via commandSearchEntities plus document
 * text search. The semantic endpoint replaces this executor without any
 * change to the tool schema.
 */
async function keywordSearch(
  query: string,
  types: SearchType[],
  limit: number,
  ctx: UserContext,
): Promise<ListItem[]> {
  const perType = Math.max(3, Math.ceil(limit / types.length));
  const wantsDocuments = types.includes("document");

  const [command, documents] = await Promise.all([
    execute(
      CommandSearchDocument,
      { search: query, limitPerType: perType },
      ctx,
    ),
    wantsDocuments
      ? execute(
          DocumentTextSearchDocument,
          { search: query, limit: perType },
          ctx,
        )
      : Promise.resolve(undefined),
  ]);

  const items: ListItem[] = [];
  const seen = new Set<string>();

  for (const entity of command.commandSearchEntities ?? []) {
    if (!(types as readonly string[]).includes(entity.type)) continue;
    seen.add(entity.id);
    items.push({
      id: entity.id,
      displayId:
        entity.displayId != null
          ? formatDisplayId(entity.type as EntityType, entity.displayId)
          : undefined,
      title: entity.title,
      type: entity.type,
    });
  }

  for (const doc of documents?.documentSearch ?? []) {
    if (!doc.id || seen.has(doc.id)) continue;
    const type = doc.kind === "one_pager" ? "one_pager" : "document";
    items.push({
      id: doc.id,
      displayId:
        doc.displayId != null
          ? formatDisplayId(type as EntityType, doc.displayId)
          : undefined,
      title: doc.title ?? "Untitled",
      type,
    });
  }

  return items.slice(0, limit);
}

export function registerSearchTools(server: OAuthServer) {
  registerTool(server, {
    name: "search",
    title: "Search Workspace",
    description:
      "Keyword search across signals, insights, actions, goals, documents and clusters by title/content match. Returns display IDs to pass to get_entity. Use list_* tools to browse instead when you have no search term.",
    schema: z.object({
      query: z.string().min(1).describe("Search terms"),
      types: z
        .array(z.enum(SEARCH_TYPES))
        .optional()
        .describe("Restrict results to these entity types (default: all)"),
      limit: z
        .number()
        .int()
        .optional()
        .describe("Maximum results across all types (default 25, max 100)"),
    }),
    scope: "read",
    handler: async ({ query, types, limit }, tool) => {
      const ctx = await tool.getContext();
      const effectiveTypes = types?.length ? types : [...SEARCH_TYPES];
      const items = await keywordSearch(
        query,
        effectiveTypes,
        clampLimit(limit),
        ctx,
      );

      if (items.length === 0) {
        return emptyResponse(
          `No matches for "${query}".`,
          "Try broader keywords, or browse with list_clusters / list_insights.",
        );
      }

      return listResponse(items, { total: items.length });
    },
  });
}
