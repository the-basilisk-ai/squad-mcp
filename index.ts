import { config } from "dotenv";
import { MCPServer, oauthCustomProvider } from "mcp-use/server";
import { getPropelAuthUrl } from "./src/helpers/config.js";
import { logger } from "./src/lib/logger.js";
import { registerFeedbackTools } from "./src/tools/feedback.js";
import { registerGoalTools } from "./src/tools/goal.js";
import { registerInsightTools } from "./src/tools/insight.js";
import { registerKnowledgeTools } from "./src/tools/knowledge.js";
import { registerOpportunityTools } from "./src/tools/opportunity.js";
import { registerSearchTools } from "./src/tools/search.js";
import { registerSolutionTools } from "./src/tools/solution.js";
import { registerViewTools } from "./src/tools/views.js";
import { registerWorkspaceTools } from "./src/tools/workspace.js";

config();

const PORT = parseInt(process.env.PORT || "3232", 10);
const BASE_URI = process.env.BASE_URI || `http://localhost:${PORT}`;
const CLIENT_ID = process.env.PROPELAUTH_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.PROPELAUTH_CLIENT_SECRET ?? "";
const AUTH_URL = getPropelAuthUrl();
const SCOPES = ["read:workspace", "write:workspace"];

const introspectionCredentials = Buffer.from(
  `${CLIENT_ID}:${CLIENT_SECRET}`,
).toString("base64");

type IntrospectionResult = {
  active: boolean;
  sub?: string;
  email?: string;
  exp?: number;
  iat?: number;
  scope?: string;
  client_id?: string;
  token_type?: string;
};

const INTROSPECTION_CACHE_TTL_MS = 60 * 1000;
const INTROSPECTION_CACHE_MAX_SIZE = 1000;

type CachedIntrospection = {
  result: IntrospectionResult;
  cachedAt: number;
};

const introspectionCache = new Map<string, CachedIntrospection>();

function getCachedIntrospection(
  token: string,
): IntrospectionResult | undefined {
  const cached = introspectionCache.get(token);
  if (!cached) return undefined;

  if (Date.now() - cached.cachedAt > INTROSPECTION_CACHE_TTL_MS) {
    introspectionCache.delete(token);
    return undefined;
  }

  return cached.result;
}

function cacheIntrospection(token: string, result: IntrospectionResult): void {
  if (introspectionCache.size >= INTROSPECTION_CACHE_MAX_SIZE) {
    const entries = Array.from(introspectionCache.entries());
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const evictCount = Math.ceil(INTROSPECTION_CACHE_MAX_SIZE * 0.1);
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      introspectionCache.delete(entries[i][0]);
    }
  }

  introspectionCache.set(token, { result, cachedAt: Date.now() });
}

function isValidIntrospectionResult(
  data: unknown,
): data is IntrospectionResult {
  if (typeof data !== "object" || data === null) return false;
  return typeof (data as Record<string, unknown>).active === "boolean";
}

async function introspectToken(token: string): Promise<IntrospectionResult> {
  const cached = getCachedIntrospection(token);
  if (cached) return cached;

  const response = await fetch(`${AUTH_URL}/oauth/2.1/introspect`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${introspectionCredentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token }),
  });

  if (!response.ok) {
    throw new Error(
      `Introspection failed: ${response.status} ${response.statusText}`,
    );
  }

  const data: unknown = await response.json();

  if (!isValidIntrospectionResult(data)) {
    throw new Error(
      'Invalid introspection response: missing or invalid "active" field',
    );
  }

  if (data.active) {
    cacheIntrospection(token, data);
  }

  return data;
}

const server = new MCPServer({
  name: "squad-mcp",
  version: "3.0.0",
  description:
    "Squad AI MCP Server - Product discovery and opportunity management tools",
  baseUrl: process.env.MCP_URL || BASE_URI,
  oauth: oauthCustomProvider({
    issuer: AUTH_URL,
    jwksUrl: `${AUTH_URL}/.well-known/jwks.json`,
    authEndpoint: `${AUTH_URL}/oauth/2.1/authorize`,
    tokenEndpoint: `${AUTH_URL}/oauth/2.1/token`,
    scopesSupported: SCOPES,
    grantTypesSupported: ["authorization_code", "refresh_token"],
    verifyToken: async (token: string) => {
      if (token.startsWith("Bearer ")) {
        token = token.substring(7);
      }

      const result = await introspectToken(token);

      if (!result.active) {
        throw new Error("Token is not active");
      }

      return { payload: result };
    },
    getUserInfo: payload => {
      if (typeof payload.sub !== "string") {
        throw new Error('Token missing required "sub" claim');
      }
      return {
        userId: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
      };
    },
  }),
});

// OAuth discovery proxies – registered before listen() to take precedence over mcp-use's built-in handlers.
// PropelAuth only serves metadata at /.well-known/oauth-authorization-server/oauth/2.1 (returns 404
// at the standard path), so we proxy it and rewrite endpoints to point through our server.
const SERVER_BASE = process.env.MCP_URL || BASE_URI;

server.app.get("/.well-known/oauth-authorization-server", async c => {
  try {
    const response = await fetch(
      `${AUTH_URL}/.well-known/oauth-authorization-server/oauth/2.1`,
    );
    if (!response.ok) {
      return c.json({ error: "Failed to fetch OAuth metadata" }, 502);
    }
    const metadata = await response.json();
    // Rewrite issuer to our server so clients discover our proxied endpoints
    metadata.issuer = SERVER_BASE;
    metadata.authorization_endpoint = `${SERVER_BASE}/authorize`;
    metadata.token_endpoint = `${SERVER_BASE}/token`;
    return c.json(metadata);
  } catch {
    return c.json({ error: "Service unavailable" }, 503);
  }
});

// Protected resource metadata – point authorization_servers to our server (not PropelAuth directly)
// so clients discover our /.well-known/oauth-authorization-server proxy
for (const path of [
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/mcp",
]) {
  server.app.get(path, c =>
    c.json({
      resource: path.endsWith("/mcp") ? `${SERVER_BASE}/mcp` : SERVER_BASE,
      authorization_servers: [SERVER_BASE],
      bearer_methods_supported: ["header"],
      scopes_supported: SCOPES,
    }),
  );
}

// Authorize proxy – mcp-use's built-in /authorize doesn't forward the `resource` parameter
// that PropelAuth requires (RFC 8707). Pass all query params through.
server.app.get("/authorize", c => {
  const authUrl = new URL(`${AUTH_URL}/oauth/2.1/authorize`);
  for (const [key, value] of Object.entries(c.req.query())) {
    authUrl.searchParams.set(key, value);
  }
  return c.redirect(authUrl.toString(), 302);
});

// Health check (used by Railway for deployment readiness)
server.app.get("/health", c => c.json({ status: "ok", version: "3.0.0" }));

// Register tools
registerWorkspaceTools(server);
registerOpportunityTools(server);
registerSolutionTools(server);
registerGoalTools(server);
registerKnowledgeTools(server);
registerFeedbackTools(server);
registerInsightTools(server);
registerSearchTools(server);
registerViewTools(server);

if (!CLIENT_ID || !CLIENT_SECRET) {
  logger.fatal(
    "Missing required environment variables: PROPELAUTH_CLIENT_ID and PROPELAUTH_CLIENT_SECRET",
  );
  process.exit(1);
}

server.listen(PORT);
