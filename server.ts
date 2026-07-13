import { config } from "dotenv";
import {
  MCPServer,
  oauthCustomProvider,
  type RedisSessionStore,
  type RedisStreamManager,
  runWithContext,
} from "mcp-use/server";
import { getPropelAuthUrl } from "./src/helpers/config.js";
import { initKv } from "./src/helpers/kv.js";
import { introspectToken } from "./src/helpers/oauth.js";
import { connectRedis } from "./src/helpers/redis.js";
import { logger } from "./src/lib/logger.js";
import { registerActionReadTools } from "./src/tools/actions-read.js";
import { registerActionWriteTools } from "./src/tools/actions-write.js";
import { registerEvidenceTools } from "./src/tools/evidence.js";
import { registerEntityTools } from "./src/tools/get-entity.js";
import { registerIngestTools } from "./src/tools/ingest.js";
import { registerKnowledgeTools } from "./src/tools/knowledge.js";
import { registerResearchWriteTools } from "./src/tools/research-write.js";
import { registerSearchTools } from "./src/tools/search.js";
import { registerStrategyReadTools } from "./src/tools/strategy-read.js";
import { registerStrategyWriteTools } from "./src/tools/strategy-write.js";
import { registerWorkspaceTools } from "./src/tools/workspace.js";

config();

const PORT = parseInt(process.env.PORT || "3232", 10);
const BASE_URI = process.env.BASE_URI || `http://localhost:${PORT}`;
const AUTH_URL = getPropelAuthUrl();
const SCOPES = ["read:workspace", "write:workspace", "openid", "email"];

// Connect Redis if available (skipped during build — Railway internal DNS isn't reachable)
let sessionStore: RedisSessionStore | undefined;
let streamManager: RedisStreamManager | undefined;
if (process.env.REDIS_URL && !process.argv.includes("build")) {
  ({ sessionStore, streamManager } = await connectRedis());
  await initKv(process.env.REDIS_URL);
} else if (!process.env.REDIS_URL) {
  logger.warn(
    {},
    "REDIS_URL not set, using in-memory sessions (not deploy-safe)",
  );
  await initKv(undefined);
}

const server = new MCPServer({
  name: "squad-mcp",
  version: "4.0.0",
  description:
    "Squad AI MCP Server - product feedback intelligence: signals, insights, actions, goals, and decision briefs",
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
server.app.get("/health", c => c.json({ status: "ok", version: "4.0.0" }));

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

// Register tools (the full v4 surface lands milestone by milestone)
registerWorkspaceTools(server);
registerSearchTools(server);
registerEntityTools(server);
registerEvidenceTools(server);
registerActionReadTools(server);
registerStrategyReadTools(server);
registerIngestTools(server);
registerActionWriteTools(server);
registerStrategyWriteTools(server);
registerResearchWriteTools(server);
registerKnowledgeTools(server);

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
