import { z } from "zod";
import {
  CreateResearchQuestionDocument,
  GetGoalDocument,
  ResearchQuestionListDocument,
} from "../gql/graphql.js";
import { formatDisplayId, parseEntityRef } from "../helpers/display-id.js";
import { appLink, entityResponse } from "../helpers/responses.js";
import { execute } from "../lib/squad-api-client.js";
import { toolError } from "./helpers.js";
import { type OAuthServer, registerTool } from "./registry.js";

function normalise(question: string): Set<string> {
  return new Set(
    question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 2),
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const w of a) if (b.has(w)) overlap++;
  return overlap / Math.min(a.size, b.size);
}

const DUP_THRESHOLD = 0.8;

export function registerResearchWriteTools(server: OAuthServer) {
  registerTool(server, {
    name: "create_research_question",
    title: "Create Research Question",
    description:
      "File a knowledge gap ('we don't actually know why…'). Near-duplicate questions return the existing one instead of creating a second. The platform tracks evidence sufficiency as signals accumulate.",
    schema: z.object({
      question: z.string().min(8),
      goalId: z
        .string()
        .optional()
        .describe("GL-N or UUID this question serves"),
      category: z.string().optional(),
      rationale: z.string().optional().describe("Why answering this matters"),
    }),
    scope: "write",
    handler: async ({ question, goalId, category, rationale }, tool) => {
      const ctx = await tool.getContext();

      const existing =
        (await execute(ResearchQuestionListDocument, { limit: 100 }, ctx))
          .researchQuestionList ?? [];
      const wanted = normalise(question);
      const duplicate = existing.find(
        rq =>
          rq.question &&
          similarity(wanted, normalise(rq.question)) >= DUP_THRESHOLD,
      );
      if (duplicate) {
        return entityResponse({
          deduplicated: true,
          message:
            "A near-identical research question already exists — returning it instead of creating a duplicate.",
          researchQuestion: {
            displayId:
              duplicate.displayId != null
                ? formatDisplayId("research_question", duplicate.displayId)
                : duplicate.id,
            question: duplicate.question,
            sufficiencyStatus: duplicate.sufficiencyStatus,
          },
        });
      }

      let goalUuid: string | undefined;
      if (goalId) {
        const ref = parseEntityRef(goalId);
        if (ref.kind === "display") {
          const goal = (
            await execute(GetGoalDocument, { id: ref.formatted }, ctx)
          ).goal;
          if (!goal?.id) return toolError(`Goal "${goalId}" not found.`);
          goalUuid = goal.id;
        } else {
          goalUuid = goalId;
        }
      }

      const created = (
        await execute(
          CreateResearchQuestionDocument,
          { question, goalId: goalUuid, category, rationale },
          ctx,
        )
      ).createResearchQuestion;
      if (!created)
        return toolError("Research question creation returned nothing.");

      return entityResponse(
        {
          message: "Research question created.",
          researchQuestion: {
            displayId:
              created.displayId != null
                ? formatDisplayId("research_question", created.displayId)
                : created.id,
            question: created.question,
            sufficiencyStatus: created.sufficiencyStatus,
          },
          note: "Sufficiency updates automatically as related signals arrive; check back with list_research_questions.",
        },
        { link: appLink(ctx.orgSlug, ctx.workspaceSlug, "goals") },
      );
    },
  });
}
