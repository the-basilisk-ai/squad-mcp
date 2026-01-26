# Quick Start - Remote MCP Server

> **Note**: This guide is for self-hosted deployments or internal Squad infrastructure.
> End users should connect to Squad's hosted remote server via [Claude Connectors](https://claude.ai).

This guide gets you from zero to deployed in ~15 minutes.

## ✅ What We Built

- **HTTP Server** with Express + OAuth2
- **PropelAuth Integration** for secure authentication
- **Redis Session Store** for multi-user support
- **StreamableHTTP Transport** for MCP protocol over HTTPS
- **30+ Squad Tools** with safety annotations (readOnlyHint/destructiveHint)
- **Railway-ready** configuration

## 🚀 Deploy to Railway (5 minutes)

### Step 1: Create PropelAuth Account

1. Go to https://app.propelauth.com and sign up
2. Create a new project
3. Copy these values (you'll need them):
   - **Auth URL** (e.g., `https://12345.propelauthtest.com`)
   - **API Key** (Settings → API Keys → Create → Backend/Server API Key)

### Step 2: Configure OAuth Application in PropelAuth

1. In PropelAuth Dashboard → **Applications** → **Create Application**
2. Set redirect URIs (add all three):
   ```
   https://claude.ai/api/mcp/auth_callback
   https://claude.com/api/mcp/auth_callback
   http://localhost:6274/oauth/callback
   ```
3. Save the application

### Step 3: Deploy to Railway

```bash
# Login to Railway
railway login

# Link to your Railway project (or create new one)
railway link

# Add Redis
railway add redis

# Set environment variables
railway variables set \
  PROPELAUTH_AUTH_URL="https://YOUR_AUTH_ID.propelauthtest.com" \
  PROPELAUTH_API_KEY="your_backend_api_key" \
  SQUAD_API_URL="https://api.meetsquad.ai" \
  NODE_ENV="production"

# Deploy
railway up
```

### Step 4: Get Your Railway URL

```bash
# Get the public URL
railway domain
```

Copy the URL (e.g., `https://your-app.up.railway.app`)

### Step 5: Update PropelAuth with Railway URL

1. Go back to PropelAuth Dashboard → **Applications**
2. Add your Railway URL to redirect URIs:
   ```
   https://your-app.up.railway.app/oauth/callback
   ```

### Step 6: Set BASE_URI

```bash
railway variables set BASE_URI="https://your-app.up.railway.app"
```

Railway will auto-redeploy with the new variable.

## ✅ Verify Deployment

### Test Health Endpoint

```bash
curl https://your-app.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-26T...",
  "version": "2.3.0"
}
```

### Test OAuth Discovery

```bash
curl https://your-app.up.railway.app/.well-known/oauth-authorization-server
```

Should return OAuth metadata with your PropelAuth endpoints.

## 🔧 Local Development

### Setup

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Fill in .env with your values:
   ```bash
   PORT=3232
   BASE_URI=http://localhost:3232
   PROPELAUTH_AUTH_URL=https://YOUR_AUTH_ID.propelauthtest.com
   PROPELAUTH_API_KEY=your_api_key
   SQUAD_API_URL=https://api.meetsquad.ai
   REDIS_URL=redis://localhost:6379
   ```

3. Start local Redis (Docker):
   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

4. Run dev server:
   ```bash
   yarn dev
   ```

Server starts at http://localhost:3232

## 🧪 Testing with MCP Inspector

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Start inspector
npx @modelcontextprotocol/inspector
```

In the inspector:
1. Set URL: `http://localhost:3232/mcp` (or your Railway URL)
2. Configure OAuth:
   - Authorization URL: `https://YOUR_AUTH_ID.propelauthtest.com/propelauth/oauth/authorize`
   - Token URL: `https://YOUR_AUTH_ID.propelauthtest.com/propelauth/oauth/token`
3. Test authentication flow
4. Try calling tools

## 📱 Using with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "squad-remote": {
      "url": "https://your-app.up.railway.app/mcp",
      "auth": {
        "type": "oauth",
        "authorization_url": "https://YOUR_AUTH_ID.propelauthtest.com/propelauth/oauth/authorize",
        "token_url": "https://YOUR_AUTH_ID.propelauthtest.com/propelauth/oauth/token",
        "scopes": ["openid", "profile", "email"]
      }
    }
  }
}
```

Restart Claude Desktop and the Squad tools will be available with OAuth authentication.

## 📊 Monitoring

### View Logs

```bash
railway logs
```

### Check Redis

```bash
railway run bash
# Then inside the container:
redis-cli -u $REDIS_URL ping
# Should respond: PONG
```

### Common Issues

**"Missing PROPELAUTH_AUTH_URL"**
- Make sure all environment variables are set in Railway dashboard

**"Redis connection failed"**
- Ensure Redis service is added in Railway
- Check REDIS_URL is automatically set

**"OAuth fails"**
- Verify redirect URIs are correctly set in PropelAuth
- Check Railway URL matches BASE_URI

## 📝 Next Steps

1. ✅ Deploy to Railway
2. ✅ Test with MCP Inspector
3. ✅ Configure Claude Desktop
4. [ ] Submit to Claude Connector Directory (optional)
5. [ ] Add error tracking (Sentry)
6. [ ] Set up monitoring alerts

## 📚 Documentation

- Full deployment guide: [DEPLOYMENT.md](DEPLOYMENT.md)
- Main README: [README.md](README.md)
- Railway docs: https://docs.railway.app
- PropelAuth docs: https://docs.propelauth.com

## 💰 Costs

- **Railway**: Free tier available, ~$5-20/month for production
- **Redis**: Included with Railway
- **PropelAuth**: Free up to 1,000 MAU

Total estimated cost: **$5-20/month** for production deployment
