# Deployment Guide - Squad MCP Remote Server

> **Note**: This guide is for self-hosted deployments or internal Squad infrastructure.
> End users should connect to Squad's hosted remote server via [Claude Connectors](https://claude.ai).

This guide walks you through deploying the Squad MCP server to Railway with OAuth2 support for Claude Connectors and ChatGPT.

## Prerequisites

1. **Railway Account**: Sign up at https://railway.app
2. **PropelAuth Account**: Sign up at https://app.propelauth.com
3. **Squad API Access**: Ensure you have access to the Squad API

## Step 1: Configure PropelAuth

### Create OAuth Application

1. Log in to your PropelAuth dashboard: https://app.propelauth.com
2. Navigate to **Applications** > **Create Application**
3. Configure the application:
   - **Name**: Squad MCP Server
   - **Application Type**: Web Application
   - **Redirect URIs** (add all of these):
     ```
     https://claude.ai/api/mcp/auth_callback
     https://claude.com/api/mcp/auth_callback
     http://localhost:6274/oauth/callback
     http://localhost:6274/oauth/callback/debug
     ```

### Get Credentials

4. Copy the following values from your PropelAuth dashboard:
   - **Auth URL** (e.g., `https://12345.propelauthtest.com`)
   - **Backend API Key** (found in Settings > API Keys)
   - **Verifier Key** (found in Settings > API Keys)

## Step 2: Deploy to Railway

### Create Project

1. Install Railway CLI (optional but recommended):
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. Or use the Railway Dashboard:
   - Go to https://railway.app/dashboard
   - Click **New Project**
   - Select **Deploy from GitHub repo**
   - Connect your repository

### Add Redis

3. In your Railway project:
   - Click **New Service**
   - Select **Redis**
   - Railway will automatically set `REDIS_URL` environment variable

### IMPORTANT: Configure Single-Instance Deployment

**⚠️ CRITICAL**: The MCP server must run as a **single instance** due to in-memory transport storage.

4. In Railway Dashboard > **Settings** > **Deploy**:
   - Set **Replicas**: `1` (default)
   - **DO NOT** enable horizontal scaling or multiple replicas

**Why**: MCP sessions maintain stateful transport objects in memory that cannot be shared across instances. Running multiple replicas will cause random "Session not found" errors as requests are load-balanced between instances.

**Future**: For horizontal scaling, the architecture needs to be refactored to use:
- Sticky sessions at the load balancer level, OR
- WebSocket-based transport (maintains connection affinity naturally), OR
- Stateless session management (requires MCP SDK changes)

### Configure Environment Variables

4. In Railway Dashboard > **Variables**, add:

   ```bash
   # Server Configuration
   PORT=3232
   NODE_ENV=production
   BASE_URI=https://your-railway-app.up.railway.app

   # PropelAuth OAuth Configuration
   PROPELAUTH_AUTH_URL=https://YOUR_AUTH_ID.propelauthtest.com
   PROPELAUTH_API_KEY=your_backend_api_key_here
   PROPELAUTH_VERIFIER_KEY=your_verifier_key_here

   # Squad API Configuration
   SQUAD_API_URL=https://api.meetsquad.ai
   ```

   **Note**: Railway will automatically set `REDIS_URL` when you add Redis.

### Deploy

5. Deploy your application:
   - Using CLI: `railway up`
   - Using Dashboard: Push to your connected GitHub branch

6. Railway will:
   - Build your application using `yarn build`
   - Start it with `node dist/http-server.js`
   - Assign a public URL (e.g., `https://your-app.up.railway.app`)

7. Update `BASE_URI` in Railway environment variables with your actual Railway URL

## Step 3: Verify Deployment

### Health Check

Test that your server is running:

```bash
curl https://your-railway-app.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-26T12:00:00.000Z",
  "version": "2.3.0"
}
```

### OAuth Discovery

Check OAuth metadata:

```bash
curl https://your-railway-app.up.railway.app/.well-known/oauth-authorization-server
```

Expected response includes:
```json
{
  "issuer": "https://your-auth.propelauthtest.com",
  "authorization_endpoint": "...",
  "token_endpoint": "..."
}
```

## Step 4: Update PropelAuth Redirect URIs

Now that you have your Railway URL, add it to PropelAuth:

1. Go to PropelAuth Dashboard > **Applications** > Your Application
2. Add your Railway URL to redirect URIs:
   ```
   https://your-railway-app.up.railway.app/oauth/callback
   ```

## Step 5: Test with MCP Inspector

### Local Testing

1. Install MCP Inspector:
   ```bash
   npm install -g @modelcontextprotocol/inspector
   ```

2. Start the inspector:
   ```bash
   npx @modelcontextprotocol/inspector
   ```

3. In the inspector:
   - Set URL: `https://your-railway-app.up.railway.app/mcp`
   - Configure OAuth with your PropelAuth endpoints
   - Test authentication flow
   - Try calling tools

## Step 6: Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "squad-remote": {
      "url": "https://your-railway-app.up.railway.app/mcp",
      "auth": {
        "type": "oauth",
        "authorization_url": "https://your-auth.propelauthtest.com/propelauth/oauth/authorize",
        "token_url": "https://your-auth.propelauthtest.com/propelauth/oauth/token",
        "client_id": "your_client_id",
        "scopes": ["openid", "profile", "email"]
      }
    }
  }
}
```

For Windows: `%APPDATA%\Claude\claude_desktop_config.json`

## Step 7: Submit to Claude Connector Directory (Optional)

Once everything is working:

1. Go to https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide
2. Follow the submission guidelines
3. Provide:
   - Server URL
   - OAuth configuration
   - Description of tools
   - Terms of service (if applicable)

## Monitoring & Maintenance

### View Logs

Using Railway CLI:
```bash
railway logs
```

Or use the Railway Dashboard > **Deployments** > **Logs**

### Monitor Redis

Check Redis connection in Railway Dashboard:
- **Metrics** tab shows memory usage, connections
- **Connect** tab has connection details

### Update Environment Variables

To update configuration:
1. Railway Dashboard > **Variables**
2. Update values
3. Application will automatically redeploy

## Troubleshooting

### Server won't start

**Check logs for missing environment variables:**
```bash
railway logs
```

Common issues:
- Missing `PROPELAUTH_AUTH_URL`
- Missing `PROPELAUTH_API_KEY`
- Missing `REDIS_URL` (make sure Redis service is added)

### OAuth fails

**Check redirect URIs:**
1. Ensure Railway URL is added to PropelAuth redirect URIs
2. Verify HTTPS is enabled (Railway provides this automatically)
3. Check PropelAuth logs for authorization errors

### Sessions not persisting

**Check Redis connection:**
```bash
railway run bash
redis-cli -u $REDIS_URL ping
```

Expected response: `PONG`

### Tools returning errors

**Check Squad API configuration:**
- Verify `SQUAD_API_URL` is correct
- Check authentication with Squad API
- Review tool execution logs in Railway

## Costs

**Railway** (estimated):
- Hobby Plan: Free for starter projects
- Pro Plan: ~$5-20/month depending on usage

**Redis** (Railway add-on):
- Included in Railway pricing
- Or use external provider (Upstash, Redis Cloud): ~$10-30/month

**PropelAuth**:
- Free tier: Up to 1,000 MAU
- Pro: $20/month for 10,000 MAU

## Security Checklist

- [x] HTTPS enabled (Railway provides this)
- [x] OAuth 2.1 with PKCE configured
- [x] PropelAuth token validation
- [x] Session ownership verification
- [x] Redis for session storage
- [x] Rate limiting enabled
- [x] CORS restricted to Claude.ai origins
- [x] Health check endpoint exposed
- [ ] Error logging configured (set up Sentry or similar)
- [ ] Monitoring alerts configured

## Next Steps

- Set up error tracking (Sentry, Rollbar)
- Configure monitoring alerts (Railway can alert on downtime)
- Add analytics for tool usage
- Document user onboarding flow
- Create user documentation for Squad MCP tools
