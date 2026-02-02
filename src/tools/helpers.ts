import type { McpServerInstance } from 'mcp-use/server';
import { WorkspaceSelectionRequired } from '../helpers/getUser.js';

/**
 * Type alias for the server with OAuth enabled
 */
export type OAuthServer = McpServerInstance<true>;

/**
 * Auth info from mcp-use OAuth context
 */
export interface AuthInfo {
  accessToken: string;
  payload: Record<string, unknown>;
}

/**
 * Get user ID from auth context
 */
export function getUserId(auth: AuthInfo): string {
  const sub = auth.payload?.sub;
  if (typeof sub !== 'string') {
    throw new Error('User ID (sub) not found in auth token');
  }
  return sub;
}

/**
 * Standard error response format for tool errors
 */
export function toolError(message: string): { content: { type: 'text'; text: string }[]; isError: true } {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Standard success response format for tool results
 */
export function toolSuccess(data: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

/**
 * Standard success response with pretty-printed JSON
 */
export function toolSuccessPretty(data: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Format WorkspaceSelectionRequired error with available orgs/workspaces
 */
export function formatWorkspaceSelectionError(error: WorkspaceSelectionRequired): string {
  let message = error.message;
  message += `\n\nAvailable organisations:\n${error.orgs.map(o => `- ${o.name} (${o.id})`).join('\n')}`;
  if (error.workspaces) {
    message += `\n\nAvailable workspaces:\n${error.workspaces.map(w => `- ${w.name} (${w.id})`).join('\n')}`;
  }
  return message;
}

// Re-export for convenience
export { WorkspaceSelectionRequired };
