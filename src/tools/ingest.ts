import { z } from "zod";
import { entityResponse } from "../helpers/responses.js";
import { type IngestItem, ingestSignals } from "../lib/ingest-client.js";
import { type OAuthServer, registerTool } from "./registry.js";

const MAX_BATCH = 50;

const SignalInput = z.object({
  content: z
    .string()
    .min(1)
    .describe("The feedback verbatim or a faithful summary"),
  source: z
    .string()
    .optional()
    .describe(
      "Where it came from, e.g. zendesk, intercom, slack, gong, manual (default: api)",
    ),
  title: z.string().optional(),
  sourceUrl: z.string().optional().describe("Link back to the original"),
  author: z.string().optional().describe("Who said it (name or handle)"),
  occurredAt: z.string().optional().describe("ISO-8601 time of the feedback"),
  strength: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("How strong a signal this is (0–1, default 0.5)"),
});

export function registerIngestTools(server: OAuthServer) {
  registerTool(server, {
    name: "ingest_signal",
    title: "Ingest Signal",
    description:
      "Pipe user feedback into the evidence chain (1–50 items). Content is deduplicated semantically server-side, then clustered and distilled into insights asynchronously. For a single item, consider find_similar_signals or search first to see if it's already known.",
    schema: z.object({
      signals: z.array(SignalInput).min(1).max(MAX_BATCH),
    }),
    scope: "write",
    handler: async ({ signals }, tool) => {
      const ctx = await tool.getContext();

      const items: IngestItem[] = signals.map(s => {
        const metadata: Record<string, string> = {};
        if (s.sourceUrl) metadata.sourceUrl = s.sourceUrl;
        if (s.author) metadata.author = s.author;
        if (s.occurredAt) metadata.occurredAt = s.occurredAt;
        return {
          content: s.content,
          title: s.title,
          source: s.source ?? "api",
          strength: s.strength,
          ...(Object.keys(metadata).length ? { metadata } : {}),
        };
      });

      const result = await ingestSignals(items, ctx);

      return entityResponse({
        created: result.created,
        signalIds: result.ids,
        ...(result.errors?.length ? { itemErrors: result.errors } : {}),
        note: "Duplicates are merged into existing signals. Clustering and insight extraction run asynchronously; check get_activity or list_signals shortly.",
      });
    },
  });
}
