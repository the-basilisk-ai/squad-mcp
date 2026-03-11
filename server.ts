import { config } from "dotenv";
import {
  MCPServer,
  oauthCustomProvider,
  type RedisSessionStore,
  type RedisStreamManager,
  runWithContext,
} from "mcp-use/server";
import { getPropelAuthUrl } from "./src/helpers/config.js";
import { introspectToken } from "./src/helpers/oauth.js";
import { connectRedis } from "./src/helpers/redis.js";
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
const AUTH_URL = getPropelAuthUrl();
const SCOPES = ["read:workspace", "write:workspace"];

// Connect Redis if available (skipped during build — Railway internal DNS isn't reachable)
let sessionStore: RedisSessionStore | undefined;
let streamManager: RedisStreamManager | undefined;
if (process.env.REDIS_URL && !process.argv.includes("build")) {
  ({ sessionStore, streamManager } = await connectRedis());
} else if (!process.env.REDIS_URL) {
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
    authEndpoint: `${process.env.MCP_URL || BASE_URI}/oauth/authorize`,
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

// Populate AsyncLocalStorage so tool callbacks can access the Hono context (including auth).
// mountMcp() doesn't wrap transport.handleRequest() in runWithContext(), so without this
// middleware getRequestContext() returns undefined inside tool handlers.
// https://github.com/mcp-use/mcp-use/issues/1183
server.app.use("/mcp/*", async (c, next) => {
  return runWithContext(c, () => next());
});

// Health check (used by Railway for deployment readiness)
server.app.get("/health", c => c.json({ status: "ok", version: "3.0.0" }));

// Proxy the authorize endpoint to PropelAuth, forwarding all parameters including
// the RFC 8707 `resource` parameter that PropelAuth requires.
server.app.get("/oauth/authorize", c => {
  const url = new URL(`${AUTH_URL}/oauth/2.1/authorize`);
  for (const [key, value] of Object.entries(c.req.query())) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }
  return c.redirect(url.toString(), 302);
});

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
  const metadata = await response.json();
  metadata.authorization_endpoint = `${mcpUrl}/oauth/authorize`;
  return c.json(metadata);
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

// mcp-use build imports this file for type generation — skip env validation during build
if (!process.argv.includes("build")) {
  const required = [
    "PROPELAUTH_CLIENT_ID",
    "PROPELAUTH_CLIENT_SECRET",
    "PROPELAUTH_API_KEY",
  ];
  const missing = required.filter(v => !process.env[v]);
  if (missing.length > 0) {
    logger.fatal(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
}

await server.listen(PORT);
