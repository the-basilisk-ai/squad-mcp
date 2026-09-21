import { createHash } from "node:crypto";
import type { Env, Hono } from "hono";
import registry from "../../server.json";

/**
 * SEP-2127 discovery: a Server Card at the reserved
 * `<streamable-http-url>/server-card`, plus an AI Catalog advertising it.
 *
 * Identity comes from `server.json` so the card cannot drift from the registry
 * listing. Replaceable by the SDK's `serverCardResponse` / `aiCatalogResponse`
 * once typescript-sdk#2527 lands and mcp-use picks it up.
 */

const CARD_SCHEMA =
  "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json";
const CARD_MEDIA_TYPE = "application/mcp-server-card+json";
const CARD_PATH = "/server-card";
const CATALOG_PATH = "/.well-known/ai-catalog.json";
const CATALOG_MEDIA_TYPE = "application/ai-catalog+json";
const CATALOG_SPEC_VERSION = "1.0";

// Must match what `server/discover` reports, which SEP-2127 forbids
// contradicting. Older revisions still negotiate via initialize, unadvertised.
const SUPPORTED_PROTOCOL_VERSIONS = ["2026-07-28"];

/**
 * mcp-use answers preflights before any route runs, and its default list omits
 * `If-None-Match`, the header a browser sends to revalidate the card.
 */
export const CORS_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "mcp-protocol-version",
  "mcp-method",
  "mcp-name",
  "If-None-Match",
];

// Wide-open CORS is safe here: the documents are public and read-only.
const DISCOVERY_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
  "Access-Control-Expose-Headers": "ETag",
  "Cache-Control": "public, max-age=3600",
};

type ServerCardOptions = {
  /** Path the MCP transport is mounted on, e.g. `/mcp`. */
  basePath: string;
  /** Absolute URL of the streamable-HTTP endpoint, e.g. `https://host/mcp`. */
  resource: string;
  version: string;
};

function buildServerCard({ resource, version }: ServerCardOptions) {
  return {
    $schema: CARD_SCHEMA,
    name: registry.name,
    version,
    description: registry.description,
    title: registry.title,
    websiteUrl: registry.websiteUrl,
    repository: registry.repository,
    icons: registry.icons,
    remotes: [
      {
        type: "streamable-http",
        url: resource,
        supportedProtocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
      },
    ],
  };
}

function buildAiCatalog(options: ServerCardOptions) {
  // `urn:air:{publisher}:{namespace}:{name}` is domain-anchored, so the
  // reverse-DNS namespace is read back as a domain.
  const [namespace, name] = registry.name.split("/");

  return {
    specVersion: CATALOG_SPEC_VERSION,
    entries: [
      {
        identifier: `urn:air:${namespace.split(".").reverse().join(".")}:mcp:${name}`,
        type: CARD_MEDIA_TYPE,
        url: `${options.resource}${CARD_PATH}`,
      },
    ],
  };
}

function serveDocument<E extends Env>(
  app: Hono<E>,
  path: string,
  mediaType: string,
  document: unknown,
) {
  const body = JSON.stringify(document);
  const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;

  app.get(path, c => {
    const headers = { ...DISCOVERY_HEADERS, ETag: etag };

    if (
      c.req
        .header("If-None-Match")
        ?.split(",")
        .some(tag => tag.trim() === etag)
    ) {
      return c.body(null, 304, headers);
    }
    return c.body(body, 200, { ...headers, "Content-Type": mediaType });
  });
}

export function registerServerCard<E extends Env>(
  app: Hono<E>,
  options: ServerCardOptions,
) {
  serveDocument(
    app,
    `${options.basePath}${CARD_PATH}`,
    CARD_MEDIA_TYPE,
    buildServerCard(options),
  );
  serveDocument(app, CATALOG_PATH, CATALOG_MEDIA_TYPE, buildAiCatalog(options));
}
