import type { McpServerInstance } from "mcp-use/server";
import { WorkspaceSelectionRequired } from "../helpers/getUser.js";
import { ResponseError } from "../lib/openapi/squad/runtime.js";

/**
 * Type alias for the server with OAuth enabled
 */
export type OAuthServer = McpServerInstance<true>;

/**
 * Auth info from mcp-use OAuth context
 */
export type AuthInfo = {
  accessToken: string;
  payload: Record<string, unknown>;
};

/**
 * Get user ID from auth context
 */
export function getUserId(auth: AuthInfo): string {
  const sub = auth.payload?.sub;
  if (typeof sub !== "string") {
    throw new Error("User ID (sub) not found in auth token");
  }
  return sub;
}

/**
 * Standard error response format for tool errors
 */
export function toolError(message: string): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Standard success response format for tool results
 */
export function toolSuccess(data: unknown): {
  content: { type: "text"; text: string }[];
} {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

/**
 * Standard success response with pretty-printed JSON
 */
export function toolSuccessPretty(data: unknown): {
  content: { type: "text"; text: string }[];
} {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Extract a human-readable error message from an API error.
 *
 * Handles ResponseError from the generated OpenAPI client by checking
 * the HTTP status code and attempting to parse the response body.
 */
export async function formatApiError(error: unknown): Promise<string> {
  if (!(error instanceof ResponseError)) {
    return error instanceof Error ? error.message : "Unknown error";
  }

  const { status } = error.response;

  if (status === 402) {
    return "Your workspace has run out of AI credits. Please upgrade your plan or contact support.";
  }

  if (status === 401 || status === 403) {
    return "Authentication failed. Please try reconnecting.";
  }

  // Try to extract the error description from the response body
  try {
    const body: unknown = await error.response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as Record<string, unknown>).error === "object"
    ) {
      const apiError = (body as { error: Record<string, unknown> }).error;
      if (typeof apiError.description === "string") {
        return `${apiError.description} (HTTP ${status})`;
      }
    }
  } catch {
    // Body wasn't JSON or already consumed — fall through
  }

  return `API request failed (HTTP ${status})`;
}

/**
 * Format WorkspaceSelectionRequired error with available orgs/workspaces
 */
export function formatWorkspaceSelectionError(
  error: WorkspaceSelectionRequired,
): string {
  let message = error.message;
  message += `\n\nAvailable organisations:\n${error.orgs.map(o => `- ${o.name} (${o.id})`).join("\n")}`;
  if (error.workspaces) {
    message += `\n\nAvailable workspaces:\n${error.workspaces.map(w => `- ${w.name} (${w.id})`).join("\n")}`;
  }
  return message;
}

// Re-export for convenience
export { WorkspaceSelectionRequired };
