import { z } from "zod";
import { IntegrationListDocument } from "../gql/graphql.js";
import { emptyResponse, listResponse } from "../helpers/responses.js";
import { execute } from "../lib/squad-api-client.js";
import { type OAuthServer, registerTool } from "./registry.js";

type TriggerHealth = {
  lastSyncedAt?: string | null;
  syncTotal?: number | null;
};

function latestSync(
  triggers: readonly TriggerHealth[] | null | undefined,
): string | null {
  const times = (triggers ?? [])
    .map(t => t.lastSyncedAt)
    .filter((t): t is string => Boolean(t));
  return times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
}

function totalSynced(
  triggers: readonly TriggerHealth[] | null | undefined,
): number {
  return (triggers ?? []).reduce((sum, t) => sum + (t.syncTotal ?? 0), 0);
}

export function registerIntegrationTools(server: OAuthServer) {
  registerTool(server, {
    name: "list_integrations",
    title: "List Integrations",
    description:
      "Connected feedback sources for this workspace and their sync health: provider, status, and each source's most recent sync time and total signals pulled. Use it to explain coverage gaps (e.g. no new signals in days) or to confirm a source is live before relying on it.",
    schema: z.object({}),
    scope: "read",
    handler: async (_params, tool) => {
      const ctx = await tool.getContext();
      const data = await execute(IntegrationListDocument, {}, ctx);
      const rows = data.integrationList ?? [];

      if (rows.length === 0) {
        return emptyResponse(
          "No integrations connected.",
          "Connect a feedback source in the Squad app to start capturing signals.",
        );
      }

      return listResponse(
        rows.map(i => ({
          id: i.id ?? "",
          title: i.name ?? i.provider ?? "(unnamed integration)",
          status: i.status ?? undefined,
          extra: {
            provider: i.provider ?? null,
            sourceCount: i.triggers?.length ?? 0,
            lastSyncedAt: latestSync(i.triggers),
            signalsPulled: totalSynced(i.triggers),
          },
        })),
      );
    },
  });
}
