import { getSquadApiUrl } from "../helpers/config.js";
import type { UserContext } from "../helpers/getUser.js";
import { SquadApiError } from "./squad-api-client.js";

export type IngestItem = {
  content: string;
  title?: string;
  source?: string;
  strength?: number;
  metadata?: Record<string, string | number | boolean>;
};

export type IngestResult = {
  success: boolean;
  created: number;
  ids: string[];
  errors?: string[];
};

/**
 * POST to the REST ingest route with the user's service token and the
 * selected workspace. Requires the platform to accept JWT ingest
 * (squidge PR #459); until that deploys the route returns 401.
 */
export async function ingestSignals(
  items: IngestItem[],
  ctx: UserContext,
): Promise<IngestResult> {
  const response = await fetch(`${getSquadApiUrl()}/api/v1/signals`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ctx.token}`,
      "x-workspace-id": ctx.workspaceId,
    },
    body: JSON.stringify({ signals: items }),
  });

  const body = (await response.json().catch(() => undefined)) as
    | (IngestResult & { error?: string })
    | undefined;

  if (!response.ok) {
    throw new SquadApiError(
      body?.error ?? `Signal ingest failed (HTTP ${response.status})`,
      response.status,
    );
  }
  if (!body) {
    throw new SquadApiError("Signal ingest returned an empty response.");
  }
  return body;
}
