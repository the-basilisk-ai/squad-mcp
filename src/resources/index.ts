import { GoalListDocument, WorkspaceOverviewDocument } from "../gql/graphql.js";
import { formatDisplayId } from "../helpers/display-id.js";
import {
  getUserContext,
  WorkspaceSelectionRequired,
} from "../helpers/getUser.js";
import { appLink } from "../helpers/responses.js";
import { logger } from "../lib/logger.js";
import { execute } from "../lib/squad-api-client.js";
import {
  type AuthInfo,
  formatWorkspaceSelectionError,
  getUserId,
} from "../tools/helpers.js";
import type { OAuthServer } from "../tools/registry.js";

function markdown(uri: string, text: string) {
  return { contents: [{ uri, mimeType: "text/markdown", text }] };
}

async function withContext(
  uri: string,
  auth: AuthInfo,
  render: (ctx: Awaited<ReturnType<typeof getUserContext>>) => Promise<string>,
) {
  try {
    const ctx = await getUserContext(getUserId(auth));
    return markdown(uri, await render(ctx));
  } catch (error) {
    logger.debug({ err: error, uri }, "resource read failed");
    if (error instanceof WorkspaceSelectionRequired) {
      return markdown(uri, formatWorkspaceSelectionError(error));
    }
    return markdown(
      uri,
      `This resource is unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export function registerResources(server: OAuthServer) {
  server.resource(
    {
      name: "workspace-context",
      uri: "squad://workspace/context",
      description:
        "The current workspace's mission and product context — pin this so strategy questions need no tool calls.",
      mimeType: "text/markdown",
    },
    async (ctx: { auth: AuthInfo }) =>
      withContext("squad://workspace/context", ctx.auth, async userCtx => {
        const data = await execute(
          WorkspaceOverviewDocument,
          { workspaceId: userCtx.workspaceId, days: 7 },
          userCtx,
        );
        const ws = data.workspaces?.[0];
        const goals = (data.goalList ?? [])
          .map(
            g =>
              `- **${g.displayId != null ? formatDisplayId("goal", g.displayId) : g.id}** ${g.title} (importance ${g.importance ?? "?"})`,
          )
          .join("\n");
        return `# ${ws?.name ?? "Workspace"}

**Mission:** ${ws?.missionStatement ?? "Set a mission with update_workspace."}

${ws?.description ?? ""}

## Top goals
${goals || "No goals defined yet."}

[Open in Squad](${appLink(userCtx.orgSlug, userCtx.workspaceSlug)})`;
      }),
  );

  server.resource(
    {
      name: "goals",
      uri: "squad://goals",
      description: "The workspace's strategic goals with importance rankings.",
      mimeType: "text/markdown",
    },
    async (ctx: { auth: AuthInfo }) =>
      withContext("squad://goals", ctx.auth, async userCtx => {
        const data = await execute(
          GoalListDocument,
          { limit: 50, offset: 0 },
          userCtx,
        );
        const rows = (data.goalList ?? [])
          .map(
            g =>
              `| ${g.displayId != null ? formatDisplayId("goal", g.displayId) : g.id} | ${g.title ?? ""} | ${g.importance ?? ""} |`,
          )
          .join("\n");
        return `# Goals

| ID | Title | Importance |
|----|-------|------------|
${rows || "| – | No goals yet | – |"}

Expand any goal with get_entity(GL-N).`;
      }),
  );
}
