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
  logger.warn(
    {},
    "REDIS_URL not set, using in-memory sessions (not deploy-safe)",
  );
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
    issuer: `${AUTH_URL}/oauth/2.1`,
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

// Populate AsyncLocalStorage so tool callbacks can access the Hono context (including auth).
// mountMcp() doesn't wrap transport.handleRequest() in runWithContext(), so without this
// middleware getRequestContext() returns undefined inside tool handlers.
// https://github.com/mcp-use/mcp-use/issues/1183
server.app.use("/mcp/*", async (c, next) => {
  return runWithContext(c, () => next());
});

// Health check (used by Railway for deployment readiness)
server.app.get("/health", c => c.json({ status: "ok", version: "3.0.0" }));

// PropelAuth serves metadata at /.well-known/oauth-authorization-server/oauth/2.1
// (RFC 8414 path-suffix form, matching its issuer https://auth.meetsquad.ai/oauth/2.1).
// We proxy it at the standard path on our origin so legacy clients that hit our
// /.well-known/oauth-authorization-server keep working — mcp-use auto-mounts a
// default handler at this path that builds the wrong upstream URL, so we override.
server.app.get("/.well-known/oauth-authorization-server", async c => {
  const response = await fetch(
    `${AUTH_URL}/.well-known/oauth-authorization-server/oauth/2.1`,
  );
  if (!response.ok) {
    return c.json({ error: "Failed to fetch auth server metadata" }, 502);
  }
  return c.json(await response.json());
});

// OpenAI Apps Challenge verification
server.app.get("/.well-known/openai-apps-challenge", c =>
  c.text("ywfOLPwG3Z3bK1EX5FLG2ho27wlOPA9bUkpewskLD90"),
);

// Strict MCP clients (Smithery) discover via protected-resource metadata and
// follow authorization_servers to PropelAuth directly — where issuer matches
// the discovery URL via RFC 8414 path-suffix.
const mcpUrl = process.env.MCP_URL || BASE_URI;
for (const path of [
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/mcp",
  "/mcp/.well-known/oauth-protected-resource",
]) {
  server.app.get(path, c =>
    c.json({
      resource: `${mcpUrl}/mcp`,
      authorization_servers: [`${AUTH_URL}/oauth/2.1`],
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
