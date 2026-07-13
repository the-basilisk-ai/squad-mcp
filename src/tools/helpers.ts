import type { McpServerInstance } from "mcp-use/server";
import { WorkspaceSelectionRequired } from "../helpers/getUser.js";

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
 * Status-aware handling (402 credits, 401/403 reconnect) returns with the
 * GraphQL client in M1 Task 04; until then this is a plain message pass-through.
 */
export async function formatApiError(error: unknown): Promise<string> {
  return error instanceof Error ? error.message : "Unknown error";
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
    message += `\n\nAvailable workspaces:\n${error.workspaces.map(w => `- ${w.name} (${w.id}) in ${w.orgName} (${w.orgId})`).join("\n")}`;
  }
  return message;
}

// Re-export for convenience
export { WorkspaceSelectionRequired };
