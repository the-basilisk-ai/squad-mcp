import { z } from "zod";
import type { OAuthServer } from "../tools/registry.js";

export type PromptSpec = {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  build: (args: Record<string, string | undefined>) => string;
};

export const PROMPTS: PromptSpec[] = [
  {
    name: "triage-feedback",
    description:
      "Capture a piece of user feedback into Squad: check for duplicates, ingest it, and report where it landed.",
    schema: z.object({
      feedback_text: z.string().describe("The feedback, verbatim"),
      source: z
        .string()
        .optional()
        .describe("Where it came from (zendesk, slack, call, …)"),
    }),
    build: args => `Triage this piece of user feedback into Squad:

"""
${args.feedback_text}
"""
${args.source ? `Source: ${args.source}` : ""}

Steps:
1. Call get_workspace_overview if you have not oriented in this session.
2. Call search with the feedback's key phrases to see whether this theme is already known.
3. Call ingest_signal with the feedback (source: ${args.source ?? "the most accurate source value"}, plus sourceUrl/author when known).
4. If the search surfaced a closely related signal, also call find_similar_signals on it to gauge how widespread the theme is.
5. Report back with: the new SI- ID, whether it was deduplicated into an existing signal, and any related insights (IN- IDs) the user should know about.

Cite every entity with its display ID.`,
  },
  {
    name: "weekly-product-review",
    description:
      "A PM's weekly review: what changed, what the evidence says, and what needs deciding.",
    schema: z.object({
      since: z
        .string()
        .optional()
        .describe("ISO date to review from (default: 7 days ago)"),
    }),
    build:
      args => `Run my weekly product review${args.since ? ` covering changes since ${args.since}` : " for the last 7 days"}.

Steps:
1. get_workspace_overview for the current state (goals, signal activity, chain health, open counts).
2. get_activity${args.since ? ` with since-aware paging (events newer than ${args.since})` : ""} to see what changed — note what Squad's agents did versus humans.
3. list_insights sorted by score for the strongest current evidence; for the top 2–3, get_entity with include ["evidence"] to ground them in real quotes.
4. list_actions for open work, and list_one_pagers with status ["draft", "in_review"] for briefs awaiting a decision.
5. Synthesise a review with sections: What changed, What the evidence says (with SI-/IN- citations), Decisions waiting (OP- briefs and top actions), and Suggested focus for next week.

Keep it under a page. Cite display IDs throughout and include the workspace link.`,
  },
  {
    name: "draft-decision-brief",
    description:
      "Generate a decision brief from an action or insight and walk it to a readable draft.",
    schema: z.object({
      id: z.string().describe("AC-N action or IN-N insight to brief"),
    }),
    build: args => `Draft a decision brief for ${args.id}.

Steps:
1. If ${args.id} is an action, call get_action_context to understand it and its evidence; if it is an insight, call get_entity with include ["evidence"].
2. Call generate_one_pager for ${args.id}.
3. Poll get_entity on the returned OP- ID until its status moves past building (wait a moment between polls).
4. Read the finished brief and present: the recommendation, the strongest evidence behind it (quoted, with SI- citations), and any gaps worth a research question (create_research_question if the user agrees).

Include the OP- ID and deep link so the user can open it in Squad.`,
  },
  {
    name: "ground-this-ticket",
    description:
      "For coding agents: pull the customer evidence behind a piece of work before building it.",
    schema: z.object({
      topic_or_id: z
        .string()
        .describe("An AC-N action ID, or a topic to search for"),
    }),
    build:
      args => `Ground the following work in Squad's customer evidence before implementing: ${args.topic_or_id}

Steps:
1. If "${args.topic_or_id}" is an AC- ID, call get_action_context. Otherwise call search for it and follow the best match (get_action_context for actions, get_entity with include ["evidence"] for insights).
2. Produce an implementation context block containing: what to build and why, the customer quotes that justify it (with SI- IDs and source links), the goals it serves (GL- IDs), and explicit acceptance hints implied by the evidence.
3. Remind the user (or yourself) to close the loop after shipping: update_action_status with status complete and a note referencing the PR.

Everything in the context block must trace to a cited display ID.`,
  },
];

export function registerPrompts(server: OAuthServer) {
  for (const spec of PROMPTS) {
    server.prompt(
      {
        name: spec.name,
        description: spec.description,
        schema: spec.schema,
      },
      async (params: Record<string, string | undefined>) => ({
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: spec.build(params ?? {}) },
          },
        ],
      }),
    );
  }
}
