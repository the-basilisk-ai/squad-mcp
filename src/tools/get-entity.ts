import { z } from "zod";
import {
  ClusterListDocument,
  GetActionDocument,
  GetClusterDocument,
  GetDocumentMarkdownDocument,
  GetDocumentMetaDocument,
  GetGoalDocument,
  GetInsightDocument,
  GetOnePagerDocument,
  GetSignalDocument,
  ResearchQuestionListDocument,
} from "../gql/graphql.js";
import {
  type EntityRef,
  type EntityType,
  formatDisplayId,
  parseEntityRef,
} from "../helpers/display-id.js";
import type { UserContext } from "../helpers/getUser.js";
import { appLink, entityResponse } from "../helpers/responses.js";
import { execute } from "../lib/squad-api-client.js";
import { toolError } from "./helpers.js";
import { type OAuthServer, registerTool } from "./registry.js";

const VALID_INCLUDES: Partial<Record<EntityType, string[]>> = {
  insight: ["evidence"],
};

const EVIDENCE_CAP = 10;

type Fetched = { type: EntityType; data: Record<string, unknown> } | null;

function fmt(type: EntityType, displayId: unknown, fallback: unknown): string {
  return typeof displayId === "number"
    ? formatDisplayId(type, displayId)
    : String(fallback);
}

async function fetchByType(
  type: EntityType,
  id: string,
  ctx: UserContext,
  withEvidence: boolean,
): Promise<Fetched> {
  switch (type) {
    case "signal": {
      const data = await execute(GetSignalDocument, { id }, ctx);
      return data.signal
        ? { type, data: data.signal as Record<string, unknown> }
        : null;
    }
    case "insight": {
      const data = await execute(GetInsightDocument, { id, withEvidence }, ctx);
      return data.insight
        ? { type, data: data.insight as Record<string, unknown> }
        : null;
    }
    case "action": {
      const data = await execute(GetActionDocument, { id }, ctx);
      return data.action
        ? { type, data: data.action as Record<string, unknown> }
        : null;
    }
    case "goal": {
      const data = await execute(GetGoalDocument, { id }, ctx);
      return data.goal
        ? { type, data: data.goal as Record<string, unknown> }
        : null;
    }
    case "document": {
      const meta = await execute(GetDocumentMetaDocument, { id }, ctx);
      if (!meta.document?.id) return null;
      const markdown = await execute(
        GetDocumentMarkdownDocument,
        { documentId: meta.document.id },
        ctx,
      );
      return {
        type,
        data: {
          ...(meta.document as Record<string, unknown>),
          markdown: markdown.documentMarkdownExport,
        },
      };
    }
    case "one_pager": {
      const data = await execute(GetOnePagerDocument, { displayId: id }, ctx);
      return data.onePager
        ? { type, data: data.onePager as Record<string, unknown> }
        : null;
    }
    case "research_question": {
      const data = await execute(
        ResearchQuestionListDocument,
        { limit: 100 },
        ctx,
      );
      const wanted = parseEntityRef(id);
      const match = (data.researchQuestionList ?? []).find(rq =>
        wanted.kind === "display"
          ? rq.displayId === wanted.displayId
          : rq.id === id,
      );
      return match ? { type, data: match as Record<string, unknown> } : null;
    }
    case "cluster": {
      const direct = await execute(GetClusterDocument, { id }, ctx).catch(
        () => undefined,
      );
      if (direct?.cluster) {
        return { type, data: direct.cluster as Record<string, unknown> };
      }
      const wanted = parseEntityRef(id);
      if (wanted.kind !== "display") return null;
      const list = await execute(
        ClusterListDocument,
        { limit: 100, requireLabel: false },
        ctx,
      );
      const match = (list.clusterList ?? []).find(
        c => c.displayId === wanted.displayId,
      );
      if (!match?.id) return null;
      const full = await execute(GetClusterDocument, { id: match.id }, ctx);
      return full.cluster
        ? { type, data: full.cluster as Record<string, unknown> }
        : null;
    }
  }
}

/** UUID inputs carry no type; probe the likely types in order. */
const UUID_PROBE_ORDER: EntityType[] = [
  "action",
  "insight",
  "signal",
  "goal",
  "document",
];

async function resolve(
  ref: EntityRef,
  rawId: string,
  ctx: UserContext,
  withEvidence: boolean,
): Promise<Fetched> {
  if (ref.kind === "display") {
    return fetchByType(ref.type, ref.formatted, ctx, withEvidence);
  }
  for (const type of UUID_PROBE_ORDER) {
    const found = await fetchByType(type, rawId, ctx, withEvidence).catch(
      () => null,
    );
    if (found) return found;
  }
  return null;
}

function shape(found: NonNullable<Fetched>, ctx: UserContext) {
  const { type, data } = found;
  const displayId = fmt(type, data.displayId, data.id);

  const sectionPath: Record<EntityType, string> = {
    signal: "signals",
    insight: "insights",
    action: "actions",
    goal: "goals",
    document: "documents",
    one_pager: "one-pagers",
    research_question: "goals",
    cluster: "signals",
  };

  const body: Record<string, unknown> = {
    entityType: type,
    ...data,
    displayId,
  };

  if (type === "insight" && Array.isArray(data.signals)) {
    const all = data.signals as Array<Record<string, unknown>>;
    body.signals = all.slice(0, EVIDENCE_CAP);
    if (all.length > EVIDENCE_CAP) {
      body.evidenceNote = `Showing ${EVIDENCE_CAP} of ${all.length} supporting signals.`;
    }
  }
  if (type === "cluster" && Array.isArray(data.signals)) {
    const all = data.signals as Array<Record<string, unknown>>;
    body.signals = all.slice(0, 15);
    if (all.length > 15) {
      body.memberNote = `Showing 15 of ${all.length} member signals.`;
    }
  }

  return entityResponse(body, {
    link: appLink(ctx.orgSlug, ctx.workspaceSlug, sectionPath[type]),
  });
}

export function registerEntityTools(server: OAuthServer) {
  registerTool(server, {
    name: "get_entity",
    title: "Get Entity",
    description:
      'Fetch any workspace entity by display ID (SI-1 signal, IN-1 insight, AC-1 action, GL-1 goal, OP-1 decision brief, DC-1 document, RQ-1 research question, CL-1 cluster) or UUID. Documents return markdown. Pass include: ["evidence"] on insights for supporting signals with source links. Also the way to check on async work (brief generation, research).',
    schema: z.object({
      id: z.string().describe("Display ID (e.g. AC-12) or UUID of the entity"),
      include: z
        .array(z.string())
        .optional()
        .describe('Optional expansions. Insights support ["evidence"].'),
    }),
    scope: "read",
    handler: async ({ id, include = [] }, tool) => {
      const ref = parseEntityRef(id);

      if (include.length > 0) {
        const type = ref.kind === "display" ? ref.type : undefined;
        const allowed = type ? (VALID_INCLUDES[type] ?? []) : [];
        const invalid = include.filter(i => !allowed.includes(i));
        if (invalid.length > 0) {
          return toolError(
            type
              ? `include ${JSON.stringify(invalid)} not supported for ${type}. Valid: ${JSON.stringify(allowed)}.`
              : "include is only supported with display IDs (the type determines valid expansions).",
          );
        }
      }

      const ctx = await tool.getContext();
      const withEvidence = include.includes("evidence");
      const found = await resolve(ref, id, ctx, withEvidence);

      if (!found) {
        return toolError(
          `No entity found for "${id}" in this workspace. Check the ID, or find it with search.`,
        );
      }

      return shape(found, ctx);
    },
  });
}
