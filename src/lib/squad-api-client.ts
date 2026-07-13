import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { print } from "graphql";
import { getSquadGraphqlUrl } from "../helpers/config.js";
import { logger } from "./logger.js";

export type ApiContext = {
  token: string;
  workspaceId: string;
};

export class SquadApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SquadApiError";
  }
}

function statusMessage(status: number): string {
  if (status === 402) {
    return "Your workspace has run out of AI credits. Please purchase flex credits or upgrade your plan.";
  }
  if (status === 401 || status === 403) {
    return "Authentication failed. Please try reconnecting.";
  }
  return `API request failed (HTTP ${status})`;
}

/**
 * Execute a typed GraphQL operation against the Squad platform API.
 *
 * Attaches the per-user service token and workspace header. No retries —
 * tool handlers surface errors to the calling agent, which decides.
 */
export async function execute<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
  ctx: ApiContext,
): Promise<TResult> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${ctx.token}`,
  };
  if (ctx.workspaceId) {
    headers["x-workspace-id"] = ctx.workspaceId;
  }

  const response = await fetch(getSquadGraphqlUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify({ query: print(document), variables }),
  });

  if (!response.ok) {
    logger.debug({ status: response.status }, "Squad API request failed");
    throw new SquadApiError(statusMessage(response.status), response.status);
  }

  const body = (await response.json()) as {
    data?: TResult;
    errors?: Array<{ message: string }>;
  };

  if (body.errors?.length) {
    const message = body.errors.map(e => e.message).join("; ");
    logger.debug({ message }, "Squad API returned GraphQL errors");
    throw new SquadApiError(message);
  }

  if (body.data === undefined || body.data === null) {
    throw new SquadApiError("Squad API returned an empty response.");
  }

  return body.data;
}
