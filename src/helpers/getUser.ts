import { WorkspaceDirectoryDocument } from "../gql/graphql.js";
import { logger } from "../lib/logger.js";
import { execute } from "../lib/squad-api-client.js";
import { kv } from "./kv.js";
import { getPropelAuthClient, getServiceToken } from "./mintToken.js";

export type UserContext = {
  /** PropelAuth org ID — the ID minted into service tokens and shown to agents. */
  orgId: string;
  workspaceId: string;
  token: string;
  orgSlug: string;
  workspaceSlug: string;
};

export type OrgInfo = {
  id: string;
  name: string;
  slug?: string;
};

export type WorkspaceInfo = {
  id: string;
  name: string;
  slug: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
};

export type WorkspaceDirectory = {
  orgs: OrgInfo[];
  workspaces: WorkspaceInfo[];
};

const SELECTION_TTL_SECONDS = 30 * 24 * 60 * 60;

const selectionKey = (userId: string) => `mcp:selection:${userId}`;

export type StoredSelection = {
  orgId: string;
  workspaceId: string;
  orgSlug: string;
  workspaceSlug: string;
};

export async function setWorkspaceSelection(
  userId: string,
  selection: StoredSelection,
): Promise<void> {
  await kv().set(
    selectionKey(userId),
    JSON.stringify(selection),
    SELECTION_TTL_SECONDS,
  );
}

export async function getWorkspaceSelection(
  userId: string,
): Promise<StoredSelection | undefined> {
  const raw = await kv().get(selectionKey(userId));
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as StoredSelection;
    if (!parsed.orgId || !parsed.workspaceId) {
      await kv().del(selectionKey(userId));
      return undefined;
    }
    return parsed;
  } catch {
    await kv().del(selectionKey(userId));
    return undefined;
  }
}

export async function clearWorkspaceSelection(userId: string): Promise<void> {
  await kv().del(selectionKey(userId));
}

/**
 * List the user's organisations from PropelAuth. This is the entry point of
 * the selection flow — it needs no backend call and yields the org IDs that
 * service tokens are minted against.
 */
export async function listUserOrganisations(
  userId: string,
): Promise<OrgInfo[]> {
  const metadata = await getPropelAuthClient().fetchUserMetadataByUserId(
    userId,
    true,
  );
  if (!metadata) {
    throw new Error("User not found in the authentication provider.");
  }
  const orgInfoById = metadata.orgIdToOrgInfo;
  const orgs = orgInfoById
    ? (Object.values(orgInfoById) as Array<{
        orgId?: string;
        orgName?: string;
      }>)
    : [];
  return orgs.flatMap(org =>
    typeof org.orgId === "string"
      ? [{ id: org.orgId, name: org.orgName ?? "Unnamed organisation" }]
      : [],
  );
}

/**
 * Fetch every organisation and workspace the user can access, in one API
 * call. The workspaces query spans all accessible organisations, so a token
 * minted for any one org is sufficient.
 */
export async function fetchWorkspaceDirectory(
  userId: string,
  anyOrgId: string,
): Promise<WorkspaceDirectory> {
  const token = await getServiceToken(userId, anyOrgId);
  const data = await execute(
    WorkspaceDirectoryDocument,
    {},
    {
      token,
      workspaceId: "",
    },
  );

  const orgByInternalId = new Map<string, OrgInfo>();
  for (const org of data.organisations ?? []) {
    if (org.id && org.propelAuthOrgId) {
      orgByInternalId.set(org.id, {
        id: org.propelAuthOrgId,
        name: org.name ?? "Unnamed organisation",
        slug: org.slug ?? undefined,
      });
    }
  }

  const workspaces: WorkspaceInfo[] = [];
  for (const ws of data.workspaces ?? []) {
    if (!ws.id) continue;
    const org = ws.organisationId
      ? orgByInternalId.get(ws.organisationId)
      : undefined;
    if (!org) {
      logger.warn(
        { workspaceId: ws.id },
        "Workspace without resolvable organisation in directory",
      );
      continue;
    }
    workspaces.push({
      id: ws.id,
      name: ws.name ?? "Unnamed workspace",
      slug: ws.slug ?? ws.id,
      orgId: org.id,
      orgName: org.name,
      orgSlug: org.slug ?? "",
    });
  }

  return { orgs: Array.from(orgByInternalId.values()), workspaces };
}

/**
 * Resolve tenant context for a tool call: stored selection first, then
 * auto-select when exactly one workspace is accessible, otherwise ask the
 * agent to call select_workspace.
 */
export const getUserContext = async (userId: string): Promise<UserContext> => {
  const stored = await getWorkspaceSelection(userId);
  if (stored) {
    return {
      orgId: stored.orgId,
      workspaceId: stored.workspaceId,
      orgSlug: stored.orgSlug,
      workspaceSlug: stored.workspaceSlug,
      token: await getServiceToken(userId, stored.orgId),
    };
  }

  const orgs = await listUserOrganisations(userId);
  if (orgs.length === 0) {
    throw new Error(
      "No organisations found for this user. Please create an organisation first.",
    );
  }

  const directory = await fetchWorkspaceDirectory(userId, orgs[0].id);
  if (directory.workspaces.length === 0) {
    throw new Error(
      "No workspaces found. Please create a workspace in the Squad app first.",
    );
  }

  if (directory.workspaces.length > 1) {
    throw new WorkspaceSelectionRequired(
      "Multiple workspaces available. Please use the select_workspace tool to choose one.",
      directory.orgs,
      directory.workspaces,
    );
  }

  const workspace = directory.workspaces[0];
  await setWorkspaceSelection(userId, {
    orgId: workspace.orgId,
    workspaceId: workspace.id,
    orgSlug: workspace.orgSlug,
    workspaceSlug: workspace.slug,
  });
  return {
    orgId: workspace.orgId,
    workspaceId: workspace.id,
    orgSlug: workspace.orgSlug,
    workspaceSlug: workspace.slug,
    token: await getServiceToken(userId, workspace.orgId),
  };
};

/**
 * Custom error thrown when user needs to select a workspace
 */
export class WorkspaceSelectionRequired extends Error {
  public orgs: OrgInfo[];
  public workspaces?: WorkspaceInfo[];

  constructor(message: string, orgs: OrgInfo[], workspaces?: WorkspaceInfo[]) {
    super(message);
    this.name = "WorkspaceSelectionRequired";
    this.orgs = orgs;
    this.workspaces = workspaces;
  }
}
