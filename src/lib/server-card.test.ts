import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import registry from "../../server.json";
import { registerServerCard } from "./server-card.js";

vi.mock("../helpers/oauth.js", () => ({ introspectToken: vi.fn() }));

const ORIGIN = "http://localhost:3232";
const BASE_PATH = "/mcp";
const RESOURCE = `${ORIGIN}${BASE_PATH}`;
const CARD_PATH = `${BASE_PATH}/server-card`;
const VERSION = "4.1.5";

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
  it("serves the card without authentication", async () => {
    const { MCPServer } = await import("mcp-use");
    const { squadOAuthProvider } = await import("../helpers/oauth-provider.js");

    const server = new MCPServer({
      name: "squad-mcp-test",
      version: VERSION,
      basePath: BASE_PATH,
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

    const res = await server.fetch(new Request(`${ORIGIN}${CARD_PATH}`));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/mcp-server-card+json",
    );
  });
});
