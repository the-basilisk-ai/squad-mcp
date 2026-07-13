import { getSquadAppUrl } from "./config.js";

/**
 * Response builders every tool must use (see ADR-006 in the plan):
 * trimmed list rows, cursor pagination, deep links, async-trigger contract.
 */

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: true;
};

export type ListItem = {
  id: string;
  displayId?: string;
  title: string;
  status?: string;
  type?: string;
  counts?: Record<string, number>;
  link?: string;
  /** Short extra fields a list legitimately needs (source, snippet, …). */
  extra?: Record<string, string | number | boolean | null>;
};

const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export function clampLimit(limit: number | undefined): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

function text(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function listResponse(
  items: ListItem[],
  opts: { nextCursor?: string; total?: number; note?: string } = {},
): ToolResult {
  return text({
    items,
    ...(opts.nextCursor ? { nextCursor: opts.nextCursor } : {}),
    ...(opts.total !== undefined ? { total: opts.total } : {}),
    ...(opts.note ? { note: opts.note } : {}),
  });
}

export function entityResponse(
  entity: Record<string, unknown>,
  opts: { link?: string; suggestedNextTools?: string[] } = {},
): ToolResult {
  return text({
    ...entity,
    ...(opts.link ? { link: opts.link } : {}),
    ...(opts.suggestedNextTools?.length
      ? { suggestedNextTools: opts.suggestedNextTools }
      : {}),
  });
}

export function asyncTriggerResponse(opts: {
  id: string;
  displayId?: string;
  status: string;
  checkWith?: string;
  note?: string;
}): ToolResult {
  return text({
    id: opts.id,
    ...(opts.displayId ? { displayId: opts.displayId } : {}),
    status: opts.status,
    checkWith: opts.checkWith ?? "get_entity",
    ...(opts.note ? { note: opts.note } : {}),
  });
}

export function emptyResponse(
  message: string,
  suggestion?: string,
): ToolResult {
  return text({
    items: [],
    message,
    ...(suggestion ? { suggestion } : {}),
  });
}

/**
 * Deep link into the web app. Routes are slug-based:
 * {app}/{orgSlug}/{workspaceSlug}/{path}
 */
export function appLink(
  orgSlug: string,
  workspaceSlug: string,
  path = "",
): string {
  const suffix = path ? `/${path.replace(/^\//, "")}` : "";
  return `${getSquadAppUrl()}/${orgSlug}/${workspaceSlug}${suffix}`;
}
