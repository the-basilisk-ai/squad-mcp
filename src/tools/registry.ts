import type { z } from "zod";
import {
  clearWorkspaceSelection,
  getUserContext,
  getWorkspaceSelection,
  type UserContext,
} from "../helpers/getUser.js";
import { logger } from "../lib/logger.js";
import { SquadApiError } from "../lib/squad-api-client.js";
import { captureToolCall } from "../lib/telemetry.js";
import {
  type AuthInfo,
  formatApiError,
  formatWorkspaceSelectionError,
  getUserId,
  type OAuthServer,
  toolError,
  WorkspaceSelectionRequired,
} from "./helpers.js";

export type { OAuthServer } from "./helpers.js";

export type ToolScope = "read" | "write";

export type ToolContext = {
  userId: string;
  auth: AuthInfo;
  getContext: () => Promise<UserContext>;
};

type ToolResultShape = {
  content: { type: "text"; text: string }[];
  isError?: true;
};

export type ToolDefinition<S extends z.ZodType> = {
  name: string;
  title: string;
  description: string;
  schema: S;
  scope: ToolScope;
  destructive?: boolean;
  handler: (params: z.infer<S>, tool: ToolContext) => Promise<ToolResultShape>;
};

function extractScopes(auth: AuthInfo): string[] | undefined {
  const scope = auth.payload?.scope;
  if (typeof scope === "string") return scope.split(/\s+/).filter(Boolean);
  if (Array.isArray(scope)) return scope.filter(s => typeof s === "string");
  return undefined;
}

/**
 * Single registration path for every tool: annotations from scope,
 * central error formatting, workspace-selection recovery, and telemetry.
 */
export function registerTool<S extends z.ZodType>(
  server: OAuthServer,
  def: ToolDefinition<S>,
): void {
  server.tool(
    {
      name: def.name,
      title: def.title,
      description: def.description,
      schema: def.schema,
      annotations: {
        readOnlyHint: def.scope === "read",
        destructiveHint: def.destructive ?? false,
        openWorldHint: false,
      },
    },
    async (params, ctx) => {
      const started = Date.now();
      let userId: string;
      try {
        userId = getUserId(ctx.auth);
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : "Not authenticated",
        );
      }

      if (def.scope === "write") {
        const scopes = extractScopes(ctx.auth);
        if (scopes && !scopes.includes("write:workspace")) {
          return toolError(
            "This session's token does not include the write:workspace scope, so this tool is unavailable. Reconnect with write access to use it.",
          );
        }
      }

      let resolvedContext: UserContext | undefined;
      const getContext = async () => {
        resolvedContext ??= await getUserContext(userId);
        return resolvedContext;
      };
      const telemetry = (
        ok: boolean,
        extra: Partial<Parameters<typeof captureToolCall>[0]> = {},
      ) =>
        captureToolCall({
          tool: def.name,
          userId,
          orgId: resolvedContext?.orgId,
          workspaceId: resolvedContext?.workspaceId,
          durationMs: Date.now() - started,
          ok,
          ...extra,
        });

      try {
        const result = await def.handler(params as z.infer<S>, {
          userId,
          auth: ctx.auth,
          getContext,
        });
        logger.debug(
          { tool: def.name, ms: Date.now() - started, ok: !result.isError },
          "tool call",
        );
        telemetry(!result.isError);
        return result;
      } catch (error) {
        logger.debug(
          { err: error, tool: def.name, ms: Date.now() - started },
          "tool call failed",
        );
        telemetry(false, { error });

        if (error instanceof WorkspaceSelectionRequired) {
          return toolError(formatWorkspaceSelectionError(error));
        }

        if (error instanceof SquadApiError && error.status === 403) {
          const stored = await getWorkspaceSelection(userId);
          if (stored) {
            await clearWorkspaceSelection(userId);
            return toolError(
              "Your access to the selected workspace has changed, so the selection was cleared. Call list_workspaces and select_workspace, then retry.",
            );
          }
        }

        return toolError(await formatApiError(error));
      }
    },
  );
}
