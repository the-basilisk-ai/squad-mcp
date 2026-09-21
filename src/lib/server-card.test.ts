import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import registry from "../../server.json";
import { CORS_ALLOWED_HEADERS, registerServerCard } from "./server-card.js";

const mockIntrospect = vi.fn();
vi.mock("../helpers/oauth.js", () => ({ introspectToken: mockIntrospect }));
vi.mock("../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

mockIntrospect.mockResolvedValue({
  active: true,
  sub: "user-1",
  scope: "read:workspace",
  client_id: "client-1",
  exp: Math.floor(Date.now() / 1000) + 600,
});

const ORIGIN = "http://localhost:3232";
const BASE_PATH = "/mcp";
const RESOURCE = `${ORIGIN}${BASE_PATH}`;
const CARD_PATH = `${BASE_PATH}/server-card`;
const VERSION = "4.1.5";
const PROTOCOL = "2026-07-28";

/** The transport may answer as SSE, so unwrap a `data:` frame if present. */
function parseJsonRpc(body: string): unknown {
  const line = body.split("\n").find(l => l.startsWith("data:"));
  return JSON.parse(line ? line.slice(5) : body);
}

function buildApp() {
  const app = new Hono();
  registerServerCard(app, {
    basePath: BASE_PATH,
    resource: RESOURCE,
    version: VERSION,
  });
  return app;
}

describe("server card", () => {
  it("serves the card at the reserved location", async () => {
    const res = await buildApp().request(CARD_PATH);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/mcp-server-card+json",
    );
    await expect(res.json()).resolves.toMatchObject({
      $schema:
        "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
      name: registry.name,
      title: registry.title,
      description: registry.description,
      websiteUrl: registry.websiteUrl,
      repository: registry.repository,
      icons: registry.icons,
      version: VERSION,
      remotes: [
        {
          type: "streamable-http",
          url: RESOURCE,
          supportedProtocolVersions: expect.arrayContaining(["2026-07-28"]),
        },
      ],
    });
  });

  it("keeps the card within the schema's field constraints", async () => {
    const card = (await (await buildApp().request(CARD_PATH)).json()) as {
      name: string;
      description: string;
      title: string;
    };

    // Reverse-DNS namespace, exactly one slash.
    expect(card.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
    expect(card.description.length).toBeGreaterThan(0);
    expect(card.description.length).toBeLessThanOrEqual(100);
    expect(card.title.length).toBeLessThanOrEqual(100);
  });

  it("sends the CORS and caching headers browser clients need", async () => {
    const res = await buildApp().request(CARD_PATH);

    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toBe("GET");
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "Content-Type, If-None-Match",
    );
    expect(res.headers.get("access-control-expose-headers")).toBe("ETag");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("etag")).toMatch(/^".+"$/);
  });

  it("revalidates with 304 when the client already has the card", async () => {
    const app = buildApp();
    const etag = (await app.request(CARD_PATH)).headers.get("etag") as string;

    const res = await app.request(CARD_PATH, {
      headers: { "If-None-Match": `"stale", ${etag}` },
    });

    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe(etag);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    await expect(res.text()).resolves.toBe("");
  });

  it("serves a 200 when the client's validator is stale", async () => {
    const res = await buildApp().request(CARD_PATH, {
      headers: { "If-None-Match": '"stale"' },
    });

    expect(res.status).toBe(200);
  });

  it("carries no credentials", async () => {
    const body = await (await buildApp().request(CARD_PATH)).text();

    expect(body).not.toMatch(/authorization|secret|token|password/i);
  });
});

describe("AI catalog", () => {
  it("advertises the card from the well-known path", async () => {
    const res = await buildApp().request("/.well-known/ai-catalog.json");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/ai-catalog+json");
    await expect(res.json()).resolves.toEqual({
      specVersion: "1.0",
      entries: [
        {
          identifier: "urn:air:meetsquad.ai:mcp:squad",
          type: "application/mcp-server-card+json",
          url: `${RESOURCE}/server-card`,
        },
      ],
    });
  });

  it("revalidates with 304", async () => {
    const app = buildApp();
    const path = "/.well-known/ai-catalog.json";
    const etag = (await app.request(path)).headers.get("etag") as string;

    const res = await app.request(path, { headers: { "If-None-Match": etag } });

    expect(res.status).toBe(304);
  });
});

describe("discovery on a live server", () => {
  async function buildLiveServer() {
    const { MCPServer } = await import("mcp-use");
    const { squadOAuthProvider } = await import("../helpers/oauth-provider.js");

    const server = new MCPServer({
      name: "squad-mcp-test",
      version: VERSION,
      basePath: BASE_PATH,
      cors: { origin: "*", allowedHeaders: CORS_ALLOWED_HEADERS },
      oauth: squadOAuthProvider({
        authUrl: "https://auth.test",
        resource: RESOURCE,
        scopes: ["read:workspace"],
      }),
    });
    registerServerCard(server.app, {
      basePath: BASE_PATH,
      resource: RESOURCE,
      version: VERSION,
    });
    return server;
  }

  it("serves the card without authentication", async () => {
    const server = await buildLiveServer();

    const res = await server.fetch(new Request(`${ORIGIN}${CARD_PATH}`));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/mcp-server-card+json",
    );
  });

  // SEP-2127 forbids the card contradicting server/discover. Pinning them here
  // means a mcp-use bump fails loudly instead of drifting.
  it("advertises exactly the versions server/discover reports", async () => {
    const server = await buildLiveServer();
    const card = (await (
      await server.fetch(new Request(`${ORIGIN}${CARD_PATH}`))
    ).json()) as { remotes: { supportedProtocolVersions: string[] }[] };

    const res = await server.fetch(
      new Request(RESOURCE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: "Bearer good",
          "MCP-Protocol-Version": PROTOCOL,
          "Mcp-Method": "server/discover",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "server/discover",
          params: {
            _meta: {
              "io.modelcontextprotocol/client-info": {
                name: "sep2127-check",
                version: "1.0.0",
              },
              "io.modelcontextprotocol/protocolVersion": PROTOCOL,
              "io.modelcontextprotocol/clientCapabilities": {},
            },
          },
        }),
      }),
    );
    const discovered = parseJsonRpc(await res.text()) as {
      result: { supportedVersions: string[] };
    };

    expect(card.remotes[0].supportedProtocolVersions).toEqual(
      discovered.result.supportedVersions,
    );
  });

  // The route's own CORS headers never run for a preflight, so the framework's
  // allow-list is what decides this.
  it("allows If-None-Match through the CORS preflight", async () => {
    const server = await buildLiveServer();

    const res = await server.fetch(
      new Request(`${ORIGIN}${CARD_PATH}`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://example.com",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "if-none-match",
        },
      }),
    );

    expect(res.headers.get("access-control-allow-headers")).toContain(
      "If-None-Match",
    );
  });
});
