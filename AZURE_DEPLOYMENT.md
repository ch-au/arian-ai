# Azure App Service Deployment Guide

Step-by-step guide for deploying ARIAN AI Platform to Azure App Service.

## Overview

The application is configured for Azure App Service with automatic **GitLab CI** deployment. All Azure-specific files are additive and do not affect local development.

**Key Benefits:**
- Automatic CI/CD via GitLab CI
- Python + Node.js hybrid support
- WebSocket support for real-time updates
- Health monitoring built-in
- Zero changes to local development workflow

## Prerequisites

- Azure account with active subscription
- GitLab repository with code (Markant GitLab)
- Azure Service Principal for authentication
- Neon PostgreSQL database (or any PostgreSQL instance)
- OpenAI API key
- Langfuse account (optional but recommended)

## Step 1: Create Azure App Service

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"** → Search for **"App Service"**
3. Click **"Create"** and fill in:

   **Basics:**
   - **Subscription**: Your Azure subscription
   - **Resource Group**: Create new or select existing
   - **Name**: `arian-ai-platform` (or your preferred name)
   - **Publish**: Code
   - **Runtime stack**: Node 20 LTS
   - **Operating System**: Linux
   - **Region**: West Europe (or your preferred region)

   **App Service Plan:**
   - **Plan**: Create new
   - **Plan name**: `arian-ai-plan`
   - **Plan type**: Basic (B1 minimum recommended)
   - **Sku and size**: B1 (Basic - 1.75 GB RAM, 1 Core)
     - **Why B1?**: Free tier (F1) doesn't support "Always On" which is required for WebSocket
     - **Cost**: ~€11/month

4. Click **"Review + create"** → **"Create"**
5. Wait for deployment (takes ~2-3 minutes)

## Step 2: Configure App Service Settings

### Enable Web Sockets and Always On

1. Go to your App Service → **Configuration** → **General settings**
2. Enable:
   - ✅ **Web sockets**: ON
   - ✅ **Always On**: ON
   - ✅ **ARR Affinity**: ON (required for WebSocket)

3. Click **"Save"** (takes ~30 seconds)

### Configure Health Check

1. Go to **Health check** (in left sidebar)
2. Enable health check
3. Set:
   - **Path**: `/health`
   - **Interval**: 60 seconds
   - **Unhealthy threshold**: 3

4. Click **"Save"**

## Step 3: Configure Environment Variables

1. Go to **Configuration** → **Application settings**
2. Click **"New application setting"** for each:

   **Required:**
   ```
   Name: DATABASE_URL
   Value: postgresql://user:pass@host.neon.tech/db?sslmode=require
   ```

   ```
   Name: OPENAI_API_KEY
   Value: sk-your-openai-key-here
   ```

   ```
   Name: NODE_ENV
   Value: production
   ```

   **Optional (Langfuse):**
   ```
   Name: LANGFUSE_PUBLIC_KEY
   Value: pk-lf-your-public-key
   ```

   ```
   Name: LANGFUSE_SECRET_KEY
   Value: sk-lf-your-secret-key
   ```

   ```
   Name: LANGFUSE_HOST
   Value: https://cloud.langfuse.com
   ```

3. Click **"Save"** (restarts the app)

**Note:** `PORT` is automatically set by Azure (defaults to 8080) - do not set manually.

## Step 4: Set Startup Command

1. Go to **Configuration** → **General settings**
2. Scroll to **"Startup Command"**
3. Enter:
   ```bash
   bash startup.sh
   ```
4. Click **"Save"**

## Step 5: Create Azure Service Principal

Create a Service Principal for GitLab CI authentication:

```bash
# Login to Azure
az login

# Create Service Principal
az ad sp create-for-rbac --name "GitLab-ARIAN-AI" --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>
```

**Save the output** - you'll need these values:
```json
{
  "appId": "xxxx-xxxx-xxxx-xxxx",
  "displayName": "GitLab-ARIAN-AI",
  "password": "xxxx-xxxx-xxxx-xxxx",
  "tenant": "xxxx-xxxx-xxxx-xxxx"
}
```

**Find your Subscription ID:**
```bash
az account show --query id --output tsv
```

## Step 6: Configure GitLab CI/CD Variables

1. Go to your GitLab repository → **Settings** → **CI/CD** → **Variables**
2. Click **"Add variable"** for each:

   **Variable 1:**
   ```
   Key: AZURE_CLIENT_ID
   Value: <appId from Service Principal>
   Type: Variable
   Protected: Yes
   Masked: Yes
   ```

   **Variable 2:**
   ```
   Key: AZURE_CLIENT_SECRET
   Value: <password from Service Principal>
   Type: Variable
   Protected: Yes
   Masked: Yes
   ```

   **Variable 3:**
   ```
   Key: AZURE_TENANT_ID
   Value: <tenant from Service Principal>
   Type: Variable
   Protected: Yes
   Masked: Yes
   ```

   **Variable 4:**
   ```
   Key: AZURE_RESOURCE_GROUP
   Value: <your-resource-group-name>
   Type: Variable
   Protected: Yes
   ```

   **Variable 5:**
   ```
   Key: AZURE_WEBAPP_NAME
   Value: arian-ai-platform
   Type: Variable
   Protected: Yes
   ```
   (Use your actual App Service name)

3. Click **"Add variable"** for each

## Step 7: Database Setup

### Option A: Manual Migration (Recommended for first deployment)

1. On your local machine:
   ```bash
   npm run db:push
   npm run db:seed  # Optional: Add sample data
   ```

### Option B: Configure Neon IP Whitelist

1. Go to Neon dashboard → Your project → Settings → IP Allowlist
2. Get Azure App Service outbound IPs:
   ```bash
   az webapp show --name <app-name> --resource-group <resource-group> --query outboundIpAddresses
   ```
3. Add all IPs to Neon allowlist

## Step 8: Deploy Application

### First Deployment

1. Ensure all GitLab CI/CD variables are configured (Step 6)
2. Push to `main` branch:
   ```bash
   git add .
   git commit -m "Configure Azure deployment"
   git push origin main
   ```

3. Monitor deployment:
   - Go to **CI/CD** → **Pipelines** in GitLab
   - Watch the running pipeline
   - Should complete in ~3-5 minutes

### GitLab CI Pipeline

The pipeline automatically:

**Stage 1: Validate**
1. Validates TypeScript compilation
2. Checks Python scripts syntax
3. Runs Ruff linting on Python code
4. Verifies repository structure

**Stage 2: Build** (only on `main` branch)
1. Installs dependencies (`npm ci`)
2. Runs type checking (`npm run check`)
3. Runs tests (`npm run test`)
4. Builds application (`npm run build`)
   - Frontend: Vite build → `dist/public/`
   - Backend: esbuild compilation → `dist/index.js`
   - Python scripts: Copied to `dist/scripts/`
5. Creates build artifacts for deployment

**Stage 3: Deploy** (only on `main` branch)
1. Authenticates with Azure using Service Principal
2. Creates deployment ZIP package
3. Deploys to Azure App Service via `az webapp deployment`
4. Waits for app to start
5. Checks health endpoint (`/health`)
6. Reports deployment URL

## Step 9: Verify Deployment

### Check Health Endpoint

```bash
curl https://<app-name>.azurewebsites.net/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX...",
  "uptime": 123.45,
  "environment": "production"
}
```

### Access Application

1. Open browser: `https://<app-name>.azurewebsites.net`
2. Should see ARIAN AI Platform frontend
3. Test login/functionality

### Verify WebSocket Support

1. Open browser DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Start a negotiation simulation
4. Should see WebSocket connection established and real-time updates

### Check Azure Logs

```bash
# Stream logs in real-time
az webapp log tail --name <app-name> --resource-group <resource-group>

# Or view in Azure Portal
# App Service → Monitoring → Log stream
```

## Architecture & Implementation

### Key Files

- **`startup.sh`** - Azure startup script
  - Creates/activates Python virtual environment
  - Installs Python dependencies
  - Starts Node.js application

- **`.gitlab-ci.yml`** - GitLab CI/CD pipeline
  - Automated validation, build and deployment
  - Runs tests before deployment
  - Health check after deployment

- **`.deployment`** - Azure Oryx build configuration
  - Configures build system
  - Enables custom build steps

- **`scripts/copy-python.js`** - Build helper
  - Copies Python scripts to `dist/` directory
  - Ensures Python code available in deployment

### Build Process Details

```bash
# Frontend build (Vite)
npm run build:frontend
# → Outputs to dist/public/

# Backend build (esbuild)
npm run build:backend  
# → Compiles TypeScript to dist/index.js

# Python scripts copy
npm run build:copy-python
# → Copies scripts/*.py to dist/scripts/
```

### Startup Sequence

When Azure starts the application:

1. **Execute `startup.sh`**
2. **Check for Python**
   - If not available: Skip Python setup, continue
   - If available: Create `.venv`, install dependencies
3. **Start Node.js**
   - Runs `npm start` (→ `node dist/index.js`)
4. **Health Check**
   - Azure monitors `/health` endpoint
   - Marks app as healthy when responding

### Environment Variables Used

Application reads these from Azure Configuration:
- `DATABASE_URL` - PostgreSQL connection
- `OPENAI_API_KEY` - AI service
- `LANGFUSE_*` - Observability (optional)
- `NODE_ENV` - Runtime mode
- `PORT` - Auto-set by Azure

## Updating the Application

### Deploy Changes

Simply push to main branch:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

GitLab CI will automatically:
- Validate code (TypeScript, Python, Ruff)
- Build and test
- Deploy to Azure
- Restart the application
- Check health endpoint

**Deployment Time:** ~3-5 minutes

### Manual Restart

If needed, restart via Azure Portal:
```bash
az webapp restart --name <app-name> --resource-group <resource-group>
```

Or in Azure Portal → Overview → Restart

### View Deployment History

- GitLab: **CI/CD** → **Pipelines** shows all deployments
- Azure: **Deployment Center** shows deployment logs

## Local Development (Unchanged)

All Azure changes are additive. Local development works exactly as before:

```bash
npm run dev              # Start dev server
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

**No changes needed to:**
- `.env` file
- Development workflow
- Testing process
- Database access

## Troubleshooting

### App Won't Start

**Check logs:**
```bash
az webapp log tail --name <app-name> --resource-group <resource-group>
```

**Common causes:**
- `startup.sh` missing execute permissions
- Startup command not set to `bash startup.sh`
- Environment variables not configured
- Database connection failed

**Fix:**
1. Verify startup command in Azure Portal → Configuration → General settings
2. Check all environment variables are set
3. Test database connection string locally

### Python Scripts Not Found

**Symptom:** Errors like "Module not found: evaluate_simulation.py"

**Check:**
```bash
# Verify build copied Python files
ls dist/scripts/
# Should show: *.py files, requirements.txt, tests/
```

**Fix:**
1. Check GitHub Actions build logs for `build:copy-python` step
2. Verify `scripts/copy-python.js` executed successfully
3. Ensure `dist/scripts/` exists in deployment

### Database Connection Fails

**Common causes:**
- Incorrect `DATABASE_URL`
- Neon IP whitelist doesn't include Azure IPs
- PostgreSQL not accessible from Azure

**Fix:**
1. Verify connection string in Azure Configuration
2. Test connection locally: `psql $DATABASE_URL`
3. Add Azure outbound IPs to Neon allowlist:
   ```bash
   az webapp show -n <app-name> -g <resource-group> --query outboundIpAddresses
   ```

### WebSocket Not Working

**Symptoms:**
- Real-time updates not appearing
- WebSocket connection errors in browser console

**Fix:**
1. Azure Portal → Configuration → General settings
2. Verify enabled:
   - ✅ Web sockets: ON
   - ✅ Always On: ON
   - ✅ ARR Affinity: ON
3. Save and restart application

### Health Check Failing

**Check endpoint:**
```bash
curl https://<app-name>.azurewebsites.net/health
```

**If 404 or error:**
1. Verify `/health` endpoint exists in `server/index.ts`
2. Check it's registered **before** auth middleware
3. Ensure app is running: `az webapp show -n <app-name>`

### Build Fails in GitLab CI

**Check:**
1. GitLab CI logs (**CI/CD** → **Pipelines** → select failed pipeline)
2. Look for failed step (validate, build, deploy)
3. Fix locally and push again

**Common issues:**
- TypeScript errors → `npm run check` locally
- Test failures → `npm run test` locally
- Missing dependencies → `npm install`
- Azure authentication → Check GitLab CI/CD variables (Step 6)

## Cost Estimation

### Azure Costs

- **Basic B1**: ~€11/month
  - 1 Core, 1.75 GB RAM
  - Always On included
  - WebSocket support
  
### Database Costs

- **Neon Free Tier**: €0/month
  - 0.5 GB storage
  - 100 hours compute/month
  - Perfect for prototypes
  
- **Neon Pro**: ~€19/month
  - 10 GB storage
  - Unlimited compute
  - For production use

### Total Monthly Cost

- **Prototype (10 users)**: ~€11/month (Azure B1 + Neon Free)
- **Production**: ~€30/month (Azure B1 + Neon Pro)

**API Costs (OpenAI):**
- Variable based on usage
- ~$0.15 per simulation run
- Monitor via Langfuse dashboard

## Advanced Configuration

### Custom Domain

1. Azure Portal → App Service → Custom domains
2. Add your domain
3. Configure DNS records
4. Enable SSL (automatically managed)

### Application Insights (Optional)

1. Create Application Insights resource
2. Link to App Service
3. View detailed performance metrics, traces, logs

### Auto-Scaling (Optional)

1. Azure Portal → App Service → Scale up (plan)
2. Choose plan with auto-scale support (S1+)
3. Configure scale rules based on CPU/Memory

### Continuous Deployment Branch Protection

Protect `main` branch:
1. GitLab → **Settings** → **Repository** → **Protected branches**
2. Select `main` branch
3. Configure:
   - **Allowed to merge**: Maintainers
   - **Allowed to push**: No one
   - Require merge request approval
   - Require passing pipeline

## Monitoring & Maintenance

### Regular Checks

- **Weekly:** Review Azure logs for errors
- **Monthly:** Check Application Insights metrics
- **Quarterly:** Review costs and optimize

### Backup Strategy

**Database:**
- Neon: Automatic daily backups (point-in-time recovery)
- Manual: `pg_dump` to local file

**Code:**
- GitHub: Version controlled
- Releases: Tag important versions

### Security Updates

**Automatic:**
- Dependabot alerts in GitHub
- Azure platform updates

**Manual:**
- Review and update npm dependencies monthly
- Update Python dependencies quarterly

## Support & Resources

### Documentation

- [Azure App Service Docs](https://learn.microsoft.com/en-us/azure/app-service)
- [GitLab CI/CD Docs](https://docs.gitlab.com/ee/ci/)
- [Neon PostgreSQL Docs](https://neon.tech/docs)

### Internal Documentation

- `README.md` - Quick start and features
- `AGENTS.md` - Development guide
- `CHANGELOG.md` - Version history

### Getting Help

1. Check Azure App Service logs
2. Review GitLab CI pipeline logs
3. Verify GitLab CI/CD variables (Step 6)
4. Verify `startup.sh` execution
5. Test components locally
6. Check environment variables configuration

---

**Document Version:** 1.0  
**Last Updated:** Januar 2025  
**Maintainer:** Christian Au


