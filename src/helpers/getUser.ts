import { z } from "zod";
import { squadClient } from "../lib/clients/squad.js";
import { logger } from "../lib/logger.js";

export type UserContext = {
  orgId: string;
  workspaceId: string;
  token: string;
};

export type OrgInfo = {
  id: string;
  name: string;
};

export type WorkspaceInfo = {
  id: string;
  name: string;
};

/**
 * In-memory workspace selection cache with LRU eviction and TTL.
 *
 * LIMITATION: This cache is not shared across server instances.
 * For horizontal scaling, consider using Redis or another shared store.
 * Users will need to re-select their workspace after server restarts
 * or when load-balanced to a different instance.
 */
const WORKSPACE_CACHE_MAX_SIZE = 10000;
const WORKSPACE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type WorkspaceEntry = {
  orgId: string;
  workspaceId: string;
  lastAccessed: number;
};

const workspaceSelections = new Map<string, WorkspaceEntry>();

/**
 * Evict oldest entries if cache is full
 */
function evictOldestEntries(): void {
  if (workspaceSelections.size < WORKSPACE_CACHE_MAX_SIZE) {
    return;
  }

  // Find entries to evict (oldest 10%)
  const entries = Array.from(workspaceSelections.entries());
  entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

  const evictCount = Math.ceil(WORKSPACE_CACHE_MAX_SIZE * 0.1);
  for (let i = 0; i < evictCount && i < entries.length; i++) {
    workspaceSelections.delete(entries[i][0]);
  }

  logger.debug({ evicted: evictCount }, 'Evicted oldest workspace selections from cache');
}

/**
 * Remove expired entries (called periodically)
 */
function removeExpiredEntries(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];

  // Collect expired keys first
  for (const [userId, entry] of workspaceSelections.entries()) {
    if (now - entry.lastAccessed > WORKSPACE_CACHE_TTL_MS) {
      expiredKeys.push(userId);
    }
  }

  // Then delete them
  for (const key of expiredKeys) {
    workspaceSelections.delete(key);
  }

  if (expiredKeys.length > 0) {
    logger.debug({ expired: expiredKeys.length }, 'Removed expired workspace selections from cache');
  }
}

// Run cleanup every hour
setInterval(removeExpiredEntries, 60 * 60 * 1000);

/**
 * Store workspace selection for a user
 */
export function setWorkspaceSelection(userId: string, orgId: string, workspaceId: string): void {
  evictOldestEntries();
  workspaceSelections.set(userId, {
    orgId,
    workspaceId,
    lastAccessed: Date.now(),
  });
}

/**
 * Get stored workspace selection for a user
 */
export function getWorkspaceSelection(userId: string): { orgId: string; workspaceId: string } | undefined {
  const entry = workspaceSelections.get(userId);
  if (!entry) {
    return undefined;
  }

  // Check if expired
  if (Date.now() - entry.lastAccessed > WORKSPACE_CACHE_TTL_MS) {
    workspaceSelections.delete(userId);
    return undefined;
  }

  // Update last accessed time (LRU)
  entry.lastAccessed = Date.now();
  return { orgId: entry.orgId, workspaceId: entry.workspaceId };
}

/**
 * Clear workspace selection for a user
 */
export function clearWorkspaceSelection(userId: string): void {
  workspaceSelections.delete(userId);
}

/**
 * List all organisations accessible to the user
 */
export async function listUserOrganisations(accessToken: string): Promise<OrgInfo[]> {
  try {
    const client = squadClient({ token: accessToken });
    const response = await client.listOrganisations();
    return response.data.map(org => ({
      id: org.id,
      name: org.name,
    }));
  } catch (error) {
    logger.error({ err: error }, 'Failed to list organisations');
    throw error;
  }
}

/**
 * List all workspaces in an organisation
 */
export async function listOrgWorkspaces(accessToken: string, orgId: string): Promise<WorkspaceInfo[]> {
  try {
    const client = squadClient({ token: accessToken });
    const response = await client.listWorkspaces({ orgId });
    return response.data.map(ws => ({
      id: ws.id,
      name: ws.name,
    }));
  } catch (error) {
    logger.error({ err: error, orgId }, 'Failed to list workspaces');
    throw error;
  }
}

/**
 * Get user context for OAuth users.
 * Uses list orgs/workspaces endpoints and stored selection.
 *
 * @param accessToken - OAuth access token
 * @param userId - User ID from OAuth token (sub claim)
 * @returns User context with orgId, workspaceId, and token
 */
export const getUserContext = async (
  accessToken: string,
  userId: string
): Promise<UserContext> => {
  // Check if user has a stored workspace selection
  const storedSelection = getWorkspaceSelection(userId);
  if (storedSelection) {
    return {
      orgId: storedSelection.orgId,
      workspaceId: storedSelection.workspaceId,
      token: accessToken,
    };
  }

  // No stored selection - try to auto-select if user has only one org/workspace
  const orgs = await listUserOrganisations(accessToken);

  if (orgs.length === 0) {
    throw new Error('No organisations found for this user. Please create an organisation first.');
  }

  if (orgs.length > 1) {
    throw new WorkspaceSelectionRequired(
      'Multiple organisations found. Please use the select_workspace tool to choose one.',
      orgs
    );
  }

  // Single org - check workspaces
  const orgId = orgs[0].id;
  const workspaces = await listOrgWorkspaces(accessToken, orgId);

  if (workspaces.length === 0) {
    throw new Error(`No workspaces found in organisation "${orgs[0].name}". Please create a workspace first.`);
  }

  if (workspaces.length > 1) {
    throw new WorkspaceSelectionRequired(
      'Multiple workspaces found. Please use the select_workspace tool to choose one.',
      orgs,
      workspaces
    );
  }

  // Single org with single workspace - auto-select and store
  const workspaceId = workspaces[0].id;
  setWorkspaceSelection(userId, orgId, workspaceId);

  return { orgId, workspaceId, token: accessToken };
};

/**
 * Custom error thrown when user needs to select a workspace
 */
export class WorkspaceSelectionRequired extends Error {
  public orgs: OrgInfo[];
  public workspaces?: WorkspaceInfo[];

  constructor(message: string, orgs: OrgInfo[], workspaces?: WorkspaceInfo[]) {
    super(message);
    this.name = 'WorkspaceSelectionRequired';
    this.orgs = orgs;
    this.workspaces = workspaces;
  }
}

export const chatToolHelperSchema = ({
  defaultInProgressText = "Thinking...",
  defaultCompletedText = "Done",
}: {
  defaultInProgressText?: string;
  defaultCompletedText?: string;
}) =>
  z.object({
    inProgressText: z
      .string()
      .optional()
      .default(defaultInProgressText)
      .describe("Text to display while the tool is in progress"),
    completedText: z
      .string()
      .optional()
      .default(defaultCompletedText)
      .describe("Text to display when the tool has completed"),
  });
