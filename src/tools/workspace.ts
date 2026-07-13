import { z } from "zod";
import {
  UpdateWorkspaceDocument,
  WorkspaceOverviewDocument,
} from "../gql/graphql.js";
import {
  fetchWorkspaceDirectory,
  getWorkspaceSelection,
  listUserOrganisations,
  setWorkspaceSelection,
} from "../helpers/getUser.js";
import { appLink, entityResponse } from "../helpers/responses.js";
import { execute } from "../lib/squad-api-client.js";
import { toolError, toolSuccess } from "./helpers.js";
import { type OAuthServer, registerTool } from "./registry.js";

export function registerWorkspaceTools(server: OAuthServer) {
  registerTool(server, {
    name: "list_workspaces",
    title: "List Workspaces",
    description:
      "List every organisation and workspace you can access, with the current selection marked. Use it when the user mentions another workspace or a tool reports that selection is required.",
    schema: z.object({}),
    scope: "read",
    handler: async (_params, tool) => {
      const orgs = await listUserOrganisations(tool.userId);
      if (orgs.length === 0) {
        return toolError(
          "No organisations found for this user. Please create one in the Squad app first.",
        );
      }

      const directory = await fetchWorkspaceDirectory(tool.userId, orgs[0].id);
      const available = directory.orgs.map(org => ({
        org: { id: org.id, name: org.name },
        workspaces: directory.workspaces
          .filter(ws => ws.orgId === org.id)
          .map(ws => ({ id: ws.id, name: ws.name })),
      }));
      const currentSelection = await getWorkspaceSelection(tool.userId);

      return toolSuccess({
        currentSelection: currentSelection
          ? {
              orgId: currentSelection.orgId,
              workspaceId: currentSelection.workspaceId,
            }
          : null,
        available,
      });
    },
  });

  registerTool(server, {
    name: "select_workspace",
    title: "Select Workspace",
    description:
      "Select which organisation and workspace subsequent tools operate on. Required when the user has access to more than one workspace.",
    schema: z.object({
      orgId: z.string().describe("The ID of the organisation to select"),
      workspaceId: z.string().describe("The ID of the workspace to select"),
    }),
    scope: "write",
    handler: async ({ orgId, workspaceId }, tool) => {
      const orgs = await listUserOrganisations(tool.userId);
      const org = orgs.find(o => o.id === orgId);
      if (!org) {
        return toolError(
          `Organisation ${orgId} not found or you don't have access to it. Call list_workspaces to see your options.`,
        );
      }

      const directory = await fetchWorkspaceDirectory(tool.userId, orgId);
      const workspace = directory.workspaces.find(
        ws => ws.id === workspaceId && ws.orgId === orgId,
      );
      if (!workspace) {
        return toolError(
          `Workspace ${workspaceId} not found in organisation ${org.name}. Call list_workspaces to see your options.`,
        );
      }

      await setWorkspaceSelection(tool.userId, {
        orgId,
        workspaceId,
        orgSlug: workspace.orgSlug,
        workspaceSlug: workspace.slug,
      });

      return toolSuccess({
        message: `Switched to workspace "${workspace.name}" in organisation "${org.name}"`,
        org: { id: orgId, name: org.name },
        workspace: { id: workspaceId, name: workspace.name },
      });
    },
  });

  registerTool(server, {
    name: "get_workspace_overview",
    title: "Get Workspace Overview",
    description:
      "One-call orientation for the current workspace: mission and description, top goals, recent signal activity, evidence-chain health, and open work counts. Call this first in a new session before other tools.",
    schema: z.object({}),
    scope: "read",
    handler: async (_params, tool) => {
      const ctx = await tool.getContext();
      const data = await execute(
        WorkspaceOverviewDocument,
        { workspaceId: ctx.workspaceId, days: 7 },
        ctx,
      );

      const workspace = data.workspaces?.[0];
      const goals = (data.goalList ?? []).map(goal => ({
        displayId: goal.displayId != null ? `GL-${goal.displayId}` : goal.id,
        title: goal.title,
        importance: goal.importance,
      }));
      const signalActivity = (data.signalActivitySummary ?? []).flatMap(row =>
        row.source ? [{ source: row.source, count: row.count ?? 0 }] : [],
      );

      const openActionCount = data.openActions?.length ?? 0;
      const pendingBriefCount = data.pendingBriefs?.length ?? 0;
      const capNote = (count: number) => (count >= 50 ? "50+" : count);

      return entityResponse(
        {
          workspace: workspace
            ? {
                name: workspace.name,
                description: workspace.description,
                missionStatement: workspace.missionStatement,
                onboardingStatus: workspace.onboardingStatus,
              }
            : { note: "Workspace details unavailable." },
          topGoals: goals.length
            ? goals
            : { note: "No goals yet — set strategy in the Squad app." },
          signalActivityLast7Days: signalActivity.length
            ? signalActivity
            : { note: "No signals captured in the last 7 days." },
          chainHealth: data.chainHealth ?? { note: "Not available." },
          openActionCount: capNote(openActionCount),
          pendingDecisionBriefCount: capNote(pendingBriefCount),
        },
        {
          link: appLink(ctx.orgSlug, ctx.workspaceSlug),
          suggestedNextTools: workspace?.missionStatement
            ? undefined
            : ["update_workspace — capture the mission statement"],
        },
      );
    },
  });

  registerTool(server, {
    name: "update_workspace",
    title: "Update Workspace",
    description:
      "Update the current workspace's name, description, mission statement or logo. Returns the updated workspace.",
    schema: z
      .object({
        name: z.string().optional().describe("Updated name for the workspace"),
        description: z
          .string()
          .optional()
          .describe("Updated detailed description of the workspace"),
        missionStatement: z
          .string()
          .optional()
          .describe("Updated mission statement for the workspace"),
        logoUrl: z
          .string()
          .optional()
          .describe("Updated https:// URL to the workspace's logo"),
      })
      .strict(),
    scope: "write",
    handler: async (params, tool) => {
      const ctx = await tool.getContext();
      const data = await execute(
        UpdateWorkspaceDocument,
        { where: { id: { eq: ctx.workspaceId } }, update: params },
        ctx,
      );

      const updated = data.updateWorkspaces?.workspaces?.[0];
      if (!updated) {
        return toolError(
          "The update did not return a workspace. Verify the change in the app.",
        );
      }

      return entityResponse(
        {
          message: "Workspace updated.",
          workspace: {
            name: updated.name,
            description: updated.description,
            missionStatement: updated.missionStatement,
            logoUrl: updated.logoUrl,
          },
        },
        { link: appLink(ctx.orgSlug, ctx.workspaceSlug, "settings") },
      );
    },
  });
}
