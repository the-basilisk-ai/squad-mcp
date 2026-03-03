import { config } from "dotenv";
import {
  MCPServer,
  oauthCustomProvider,
  RedisSessionStore,
  RedisStreamManager,
} from "mcp-use/server";
import { createClient } from "redis";
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

function isValidIntrospectionResult(
  data: unknown,
): data is IntrospectionResult {
  if (typeof data !== "object" || data === null) return false;
  return typeof (data as Record<string, unknown>).active === "boolean";
}

async function introspectToken(token: string): Promise<IntrospectionResult> {
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

  return data;
}

const redisUrl = process.env.REDIS_URL;

let sessionStore: RedisSessionStore | undefined;
let streamManager: RedisStreamManager | undefined;

if (redisUrl) {
  const redis = createClient({ url: redisUrl });
  const pubSubRedis = redis.duplicate();

  await redis.connect();
  await pubSubRedis.connect();

  sessionStore = new RedisSessionStore({ client: redis, defaultTTL: 3600 });
  streamManager = new RedisStreamManager({
    client: redis,
    pubSubClient: pubSubRedis,
  });

  logger.info("Redis session store connected");
} else {
  logger.warn("REDIS_URL not set, using in-memory sessions (not deploy-safe)");
}

const server = new MCPServer({
  name: "squad-mcp",
  version: "3.0.0",
  description:
    "Squad AI MCP Server - Product discovery and opportunity management tools",
  baseUrl: process.env.MCP_URL || BASE_URI,
  sessionStore,
  streamManager,
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

// Health check (used by Railway for deployment readiness)
server.app.get("/health", c => c.json({ status: "ok", version: "3.0.0" }));

// PropelAuth serves OAuth metadata at a non-standard path (/oauth/2.1 suffix).
// Proxy it at the standard path so MCP clients can discover registration_endpoint.
const mcpUrl = process.env.MCP_URL || BASE_URI;
server.app.get("/.well-known/oauth-authorization-server", async c => {
  const response = await fetch(
    `${AUTH_URL}/.well-known/oauth-authorization-server/oauth/2.1`,
  );
  if (!response.ok) {
    return c.json({ error: "Failed to fetch auth server metadata" }, 502);
  }
  return c.json(await response.json());
});

// Protected resource metadata must point authorization_servers to our server
// so clients discover our proxied /.well-known/oauth-authorization-server.
for (const path of [
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/mcp",
  "/mcp/.well-known/oauth-protected-resource",
]) {
  server.app.get(path, c =>
    c.json({
      resource: `${mcpUrl}/mcp`,
      authorization_servers: [mcpUrl],
      scopes_supported: SCOPES,
    }),
  );
}

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

if (!CLIENT_ID || !CLIENT_SECRET || !process.env.PROPELAUTH_API_KEY) {
  logger.fatal(
    "Missing required environment variables: PROPELAUTH_CLIENT_ID, PROPELAUTH_CLIENT_SECRET, and PROPELAUTH_API_KEY",
  );
  process.exit(1);
}

server.listen(PORT);
