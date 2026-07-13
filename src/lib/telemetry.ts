import { PostHogMCP } from "@posthog/mcp";
import { logger } from "./logger.js";

let client: PostHogMCP | null = null;

/**
 * Emits PostHog's canonical $mcp_* events so the MCP Analytics dashboard,
 * sessions explorer and query-mcp-* tooling work without custom insights.
 * mcp-use is a custom Hono dispatcher, so we use the PostHogMCP client
 * (instrument() only wraps raw @modelcontextprotocol/sdk servers).
 */
export function initTelemetry(): void {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    logger.warn({}, "POSTHOG_API_KEY not set — tool-call telemetry disabled");
    return;
  }
  client = new PostHogMCP(apiKey, {
    host: process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com",
    flushAt: 20,
    flushInterval: 10_000,
  });
}

export type ToolCallEvent = {
  tool: string;
  userId: string;
  orgId?: string;
  workspaceId?: string;
  durationMs: number;
  ok: boolean;
  error?: unknown;
};

export function captureToolCall(event: ToolCallEvent): void {
  if (!client) return;
  const groups: Record<string, string> = {};
  if (event.orgId) groups.organisation = event.orgId;
  if (event.workspaceId) groups.workspace = event.workspaceId;
  client.captureToolCall({
    toolName: event.tool,
    distinctId: event.userId,
    durationMs: event.durationMs,
    isError: !event.ok,
    ...(event.error !== undefined ? { error: event.error } : {}),
    ...(Object.keys(groups).length ? { groups } : {}),
  });
}

export async function shutdownTelemetry(): Promise<void> {
  await client?.shutdown().catch(() => undefined);
  client = null;
}

export function setTelemetryClientForTests(fake: PostHogMCP | null): void {
  client = fake;
}
