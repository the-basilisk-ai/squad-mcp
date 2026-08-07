import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mockIntrospect = vi.fn();

vi.mock("./helpers/oauth.js", () => ({ introspectToken: mockIntrospect }));
vi.mock("./lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("./lib/telemetry.js", () => ({ captureToolCall: vi.fn() }));

const { MCPServer } = await import("mcp-use");
const { squadOAuthProvider } = await import("./helpers/oauth-provider.js");
const { registerTool } = await import("./tools/registry.js");
const { toolSuccess } = await import("./tools/helpers.js");

const ORIGIN = "http://localhost:3333";
const RESOURCE = `${ORIGIN}/mcp`;
const PROTOCOL = "2026-07-28";

/** What the tool callback saw, so the auth wiring can be asserted. */
let seen: { userId: string; scopes?: string[] } | undefined;

function buildServer() {
  const server = new MCPServer({
    name: "squad-mcp-test",
    version: "4.0.0",
    basePath: "/mcp",
    oauth: squadOAuthProvider({
      authUrl: "https://auth.test",
      resource: RESOURCE,
      scopes: ["read:workspace", "write:workspace"],
    }),
  });

  registerTool(server, {
    name: "whoami",
    title: "Who Am I",
    description: "Echoes the authenticated identity.",
    schema: z.object({}),
    scope: "read",
    handler: async (_params, tool) => {
      seen = { userId: tool.userId, scopes: tool.auth.scopes };
      return toolSuccess({ userId: tool.userId });
    },
  });

  registerTool(server, {
    name: "write_thing",
    title: "Write Thing",
    description: "Requires the write scope.",
    schema: z.object({}),
    scope: "write",
    handler: async () => toolSuccess({ written: true }),
  });

  return server;
}

// The 2026-07-28 revision requires a per-request envelope in `params._meta`
// plus Mcp-Method (and Mcp-Name for a tool call) mirroring the body.
function call(
  method: string,
  params: Record<string, unknown> = {},
  { token, name }: { token?: string; name?: string } = {},
) {
  return new Request(RESOURCE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL,
      "Mcp-Method": method,
      ...(name ? { "Mcp-Name": name } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/client-info": {
            name: "squad-mcp-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/protocolVersion": PROTOCOL,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

const ACTIVE_TOKEN = {
  active: true,
  sub: "user-1",
  email: "pm@example.com",
  scope: "read:workspace write:workspace",
  client_id: "client-1",
};

beforeEach(() => {
  seen = undefined;
  mockIntrospect.mockReset();
  mockIntrospect.mockResolvedValue({
    ...ACTIVE_TOKEN,
    exp: Math.floor(Date.now() / 1000) + 600,
  });
});

describe("MCP endpoint authentication", () => {
  it("refuses an unauthenticated call and points at the resource metadata", async () => {
    const response = await buildServer().fetch(call("tools/list"));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      "/.well-known/oauth-protected-resource/mcp",
    );
    expect(mockIntrospect).not.toHaveBeenCalled();
  });

  it("refuses a token the authorization server reports as inactive", async () => {
    mockIntrospect.mockResolvedValue({ active: false });

    const response = await buildServer().fetch(
      call("tools/list", {}, { token: "dead" }),
    );

    expect(response.status).toBe(401);
    expect(mockIntrospect).toHaveBeenCalledWith("dead");
  });

  it("lists the registered tools for a valid token", async () => {
    const response = await buildServer().fetch(
      call("tools/list", {}, { token: "good" }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "whoami",
      "write_thing",
    ]);
  });
});

describe("tool calls", () => {
  it("runs with the identity and scopes mapped from the token", async () => {
    const response = await buildServer().fetch(
      call(
        "tools/call",
        { name: "whoami", arguments: {} },
        { token: "good", name: "whoami" },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.parse(body.result.content[0].text)).toEqual({
      userId: "user-1",
    });
    expect(seen).toEqual({
      userId: "user-1",
      scopes: ["read:workspace", "write:workspace"],
    });
  });

  it("refuses a write tool when the token carries only read scope", async () => {
    mockIntrospect.mockResolvedValue({
      ...ACTIVE_TOKEN,
      scope: "read:workspace",
      exp: Math.floor(Date.now() / 1000) + 600,
    });

    const response = await buildServer().fetch(
      call(
        "tools/call",
        { name: "write_thing", arguments: {} },
        { token: "read-only", name: "write_thing" },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("write:workspace");
  });
});

describe("OAuth discovery", () => {
  it("serves protected-resource metadata naming PropelAuth", async () => {
    const response = await buildServer().fetch(
      new Request(`${ORIGIN}/.well-known/oauth-protected-resource/mcp`),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: RESOURCE,
      authorization_servers: ["https://auth.test/oauth/2.1"],
    });
  });
});
