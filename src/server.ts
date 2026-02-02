#!/usr/bin/env node
import { config } from 'dotenv';
import { MCPServer, oauthCustomProvider } from 'mcp-use/server';
import { logger } from './lib/logger.js';
import { registerWorkspaceTools } from './tools/workspace.js';
import { registerOpportunityTools } from './tools/opportunity.js';
import { registerSolutionTools } from './tools/solution.js';
import { registerOutcomeTools } from './tools/outcome.js';
import { registerKnowledgeTools } from './tools/knowledge.js';
import { registerFeedbackTools } from './tools/feedback.js';
import { registerInsightTools } from './tools/insight.js';
import { registerSearchTools } from './tools/search.js';

// Load environment variables
config();

// Validate required environment variables
if (!process.env.PROPELAUTH_CLIENT_ID || !process.env.PROPELAUTH_CLIENT_SECRET) {
  logger.fatal('Missing required environment variables: PROPELAUTH_CLIENT_ID and PROPELAUTH_CLIENT_SECRET');
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || '3232', 10);
const BASE_URI = process.env.BASE_URI || `http://localhost:${PORT}`;
const CLIENT_ID = process.env.PROPELAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.PROPELAUTH_CLIENT_SECRET;

/**
 * Get PropelAuth URL based on SQUAD_ENV
 */
export function getPropelAuthUrl(): string {
  const squadEnv = process.env.SQUAD_ENV || 'production';

  if (squadEnv === 'dev') {
    return 'https://26904088430.propelauthtest.com';
  }
  if (squadEnv === 'staging') {
    return 'https://auth.app.meetsquad.ai';
  }
  return 'https://auth.meetsquad.ai'; // production
}

const AUTH_URL = getPropelAuthUrl();
const SCOPES = ['read:workspace', 'write:workspace'];

// Pre-compute Basic auth credentials for introspection
const introspectionCredentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

/**
 * Introspection result from PropelAuth
 */
interface IntrospectionResult {
  active: boolean;
  sub?: string;
  email?: string;
  exp?: number;
  iat?: number;
  scope?: string;
  client_id?: string;
  token_type?: string;
}

/**
 * Token validation via PropelAuth OAuth 2.1 introspection
 */
async function introspectToken(token: string): Promise<IntrospectionResult> {
  const response = await fetch(`${AUTH_URL}/oauth/2.1/introspect`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${introspectionCredentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ token }),
  });

  if (!response.ok) {
    throw new Error(`Introspection failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Create MCP server with PropelAuth OAuth
const server = new MCPServer({
  name: 'squad-mcp',
  version: '3.0.0',
  description: 'Squad AI MCP Server - Product discovery and opportunity management tools',
  baseUrl: `${BASE_URI}/mcp`,
  oauth: oauthCustomProvider({
    issuer: AUTH_URL,
    jwksUrl: `${AUTH_URL}/.well-known/jwks.json`,
    authEndpoint: `${AUTH_URL}/oauth/2.1/authorize`,
    tokenEndpoint: `${AUTH_URL}/oauth/2.1/token`,
    scopesSupported: SCOPES,
    grantTypesSupported: ['authorization_code', 'refresh_token'],
    verifyToken: async (token: string) => {
      // Strip Bearer prefix if present
      if (token.startsWith('Bearer ')) {
        token = token.substring(7);
      }

      const result = await introspectToken(token);

      if (!result.active) {
        throw new Error('Token is not active');
      }

      return { payload: result };
    },
    getUserInfo: (payload) => ({
      userId: payload.sub as string,
      email: payload.email as string | undefined,
    }),
  }),
});

// OAuth discovery - proxy to PropelAuth (needed to avoid CORS issues)
server.app.get('/.well-known/oauth-authorization-server', async (c) => {
  try {
    const response = await fetch(`${AUTH_URL}/.well-known/oauth-authorization-server/oauth/2.1`);
    if (!response.ok) {
      logger.error({ status: response.status }, 'OAuth discovery proxy failed');
      return c.json({ error: 'Failed to fetch OAuth metadata' }, 502);
    }
    return c.json(await response.json());
  } catch (error) {
    logger.error({ err: error }, 'OAuth discovery proxy error');
    return c.json({ error: 'Service unavailable' }, 503);
  }
});

// OpenID Connect discovery - proxy to PropelAuth (needed to avoid CORS issues)
server.app.get('/.well-known/openid-configuration', async (c) => {
  try {
    const response = await fetch(`${AUTH_URL}/oauth/2.1/.well-known/openid-configuration`);
    if (!response.ok) {
      logger.error({ status: response.status }, 'OpenID discovery proxy failed');
      return c.json({ error: 'Failed to fetch OpenID configuration' }, 502);
    }
    return c.json(await response.json());
  } catch (error) {
    logger.error({ err: error }, 'OpenID discovery proxy error');
    return c.json({ error: 'Service unavailable' }, 503);
  }
});

// Protected resource metadata (RFC 9728)
// Point authorization_servers to our server to use proxied endpoints (avoids CORS)
['/mcp/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'].forEach(path => {
  server.app.get(path, (c) => c.json({
    resource: `${BASE_URI}/mcp`,
    authorization_servers: [BASE_URI],
    scopes_supported: SCOPES,
  }));
});

// Health check endpoint
server.app.get('/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '3.0.0',
  environment: process.env.SQUAD_ENV || 'production',
}));

// Register all tools
registerWorkspaceTools(server);
registerOpportunityTools(server);
registerSolutionTools(server);
registerOutcomeTools(server);
registerKnowledgeTools(server);
registerFeedbackTools(server);
registerInsightTools(server);
registerSearchTools(server);

// Start server
async function startServer() {
  try {
    await server.listen(PORT);
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Squad MCP Server (mcp-use)                              ║
║                                                           ║
║   Version: 3.0.0                                          ║
║   Port: ${PORT}                                              ║
║   Base URI: ${BASE_URI.padEnd(40)}  ║
║                                                           ║
║   Endpoints:                                              ║
║   - /mcp (MCP Protocol)                                   ║
║   - /sse (SSE endpoint)                                   ║
║   - /health (Health Check)                                ║
║   - /inspector (MCP Inspector UI)                         ║
║                                                           ║
║   OAuth Provider: PropelAuth                              ║
║   Auth URL: ${AUTH_URL.padEnd(40)}  ║
║   Environment: ${(process.env.SQUAD_ENV || 'production').padEnd(37)}  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  logger.fatal({ err: error }, 'Fatal error starting server');
  process.exit(1);
});

// Export for helpers
export { server, AUTH_URL };
