import { config } from "dotenv";
import { MCPServer } from "mcp-use";
import { version as VERSION } from "./package.json";
import { getPropelAuthUrl } from "./src/helpers/config.js";
import { initKv } from "./src/helpers/kv.js";
import { squadOAuthProvider } from "./src/helpers/oauth-provider.js";
import { logger } from "./src/lib/logger.js";
import { securityHeaders } from "./src/lib/security-headers.js";
import { initTelemetry, shutdownTelemetry } from "./src/lib/telemetry.js";
import { registerPrompts } from "./src/prompts/index.js";
import { registerResources } from "./src/resources/index.js";
import { registerActionReadTools } from "./src/tools/actions-read.js";
import { registerActionWriteTools } from "./src/tools/actions-write.js";
import { registerEvidenceTools } from "./src/tools/evidence.js";
import { registerEntityTools } from "./src/tools/get-entity.js";
import type { SquadUser } from "./src/tools/helpers.js";
import { registerIngestTools } from "./src/tools/ingest.js";
import { registerIntegrationTools } from "./src/tools/integrations.js";
import { registerKnowledgeTools } from "./src/tools/knowledge.js";
import { registerSearchTools } from "./src/tools/search.js";
import { registerStrategyReadTools } from "./src/tools/strategy-read.js";
import { registerStrategyWriteTools } from "./src/tools/strategy-write.js";
import { registerWorkspaceTools } from "./src/tools/workspace.js";

config();

const IS_BUILD = process.argv.includes("build");
const PORT = parseInt(process.env.PORT || "3232", 10);
const BASE_URI = process.env.BASE_URI || `http://localhost:${PORT}`;
const BASE_PATH = "/mcp";
const AUTH_URL = getPropelAuthUrl();
const ISSUER = `${AUTH_URL}/oauth/2.1`;
const SCOPES = ["read:workspace", "write:workspace", "openid", "email"];
const MCP_URL = process.env.MCP_URL || BASE_URI;
const RESOURCE = `${MCP_URL}${BASE_PATH}`;

await initKv(IS_BUILD ? undefined : process.env.REDIS_URL);

const server = new MCPServer<SquadUser>({
  name: "squad-mcp",
  version: VERSION,
  description:
    "Squad AI MCP Server - product feedback intelligence: signals, insights, actions, goals, and decision briefs",
  basePath: BASE_PATH,
  // Railway routes only hostnames assigned to the deployment, so binding
  // publicly needs nothing more. The v2 default of 127.0.0.1 would make the
  // service unreachable behind the edge.
  host: "0.0.0.0",
  port: PORT,
  // v1 answered every request with `Access-Control-Allow-Origin: *`; v2 sends no
  // CORS headers unless asked, which would break browser-based MCP clients. The
  // wildcard is safe without credentials: a page can only read a response it
  // already holds a bearer token for.
  cors: { origin: "*" },
  oauth: squadOAuthProvider({
    authUrl: AUTH_URL,
    resource: RESOURCE,
    scopes: SCOPES,
  }),
});

// Railway's edge adds neither header, so they are set here for every route.
server.app.use("*", securityHeaders);

// Health check (used by Railway for deployment readiness)
server.app.get("/health", c => c.json({ status: "ok", version: VERSION }));

// OpenAI Apps Challenge verification
server.app.get("/.well-known/openai-apps-challenge", c =>
  c.text("ywfOLPwG3Z3bK1EX5FLG2ho27wlOPA9bUkpewskLD90"),
);

// The framework serves the RFC 9728 path
// (/.well-known/oauth-protected-resource/mcp) from the OAuth provider. These
// two aliases are for clients that look elsewhere: Smithery probes the bare
// path, and some probe the path-suffix form.
for (const path of [
  "/.well-known/oauth-protected-resource",
  `${BASE_PATH}/.well-known/oauth-protected-resource`,
]) {
  server.app.get(path, c =>
    c.json({
      resource: RESOURCE,
      authorization_servers: [ISSUER],
      scopes_supported: SCOPES,
    }),
  );
}

registerWorkspaceTools(server);
registerSearchTools(server);
registerEntityTools(server);
registerEvidenceTools(server);
registerActionReadTools(server);
registerStrategyReadTools(server);
registerIntegrationTools(server);
registerIngestTools(server);
registerActionWriteTools(server);
registerStrategyWriteTools(server);
registerKnowledgeTools(server);
registerPrompts(server);
registerResources(server);

// mcp-use build imports this file for the build manifest — skip env validation
if (!IS_BUILD) {
  initTelemetry();
  process.on("SIGTERM", () => {
    shutdownTelemetry().finally(() => process.exit(0));
  });

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

// `mcp-use start` imports this module, requires the default export to be the
// MCPServer, and calls listen() itself.
export default server;
