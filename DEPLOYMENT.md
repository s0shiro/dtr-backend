# Production Deployment Guide: Heroku + Vercel

## Quick Checklist

| Step | Task | Status |
|------|------|--------|
| 1 | Generate secrets (`BETTER_AUTH_SECRET`, `INTERNAL_AUTOMATION_SECRET`) | ⬜ |
| 2 | Determine your Vercel frontend domain(s) | ⬜ |
| 3 | Determine your Heroku backend domain | ⬜ |
| 4 | Copy `.env.production.example` to `.env.production` (or use Heroku config) | ⬜ |
| 5 | Fill in all required variables | ⬜ |
| 6 | Verify `FRONTEND_ORIGIN` includes Vercel domain(s) | ⬜ |
| 7 | Run `npm run build` locally to verify | ⬜ |
| 8 | Deploy to Heroku and check logs | ⬜ |
| 9 | Test auth flow (login/signup) from Vercel | ⬜ |
| 10 | Test API calls (logs, daily-notes) from Vercel | ⬜ |

---

## Critical Environment Variables

### Required (will fail to start without these)

```bash
PORT=3000
DATABASE_URL=postgres://...  # Heroku provides automatically
BETTER_AUTH_SECRET=<generate>
BETTER_AUTH_URL=https://your-backend.herokuapp.com
FRONTEND_ORIGIN=https://yourapp.vercel.app,https://*.vercel.app
TRUST_PROXY=1
```

### Highly Recommended

```bash
INTERNAL_AUTOMATION_SECRET=<generate>  # For internal endpoints
OFFICE_LATITUDE=<your-office-lat>      # For geofencing
OFFICE_LONGITUDE=<your-office-lon>
HOLIDAY_COUNTRY_CODE=PH                # Adjust for your country
```

### Optional

```bash
N8N_GEOFENCE_WEBHOOK_URL=...           # If using n8n
API_NINJAS_KEY=...                     # For daily quotes
```

---

## Step-by-Step Deployment

### 1. Generate Secrets

```bash
# Generate BETTER_AUTH_SECRET
openssl rand -base64 32

# Generate INTERNAL_AUTOMATION_SECRET
openssl rand -base64 32
```

Keep these safe and store in a password manager.

### 2. Heroku Setup

#### Create/Configure Heroku app

```bash
# If new app
heroku create your-app-name

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Verify DATABASE_URL is set
heroku config | grep DATABASE_URL
```

#### Set environment variables

```bash
# Set via CLI (repeat for each var)
heroku config:set BETTER_AUTH_SECRET=your-secret-here
heroku config:set BETTER_AUTH_URL=https://your-app-name.herokuapp.com
heroku config:set FRONTEND_ORIGIN=https://yourapp.vercel.app,https://*.vercel.app
heroku config:set INTERNAL_AUTOMATION_SECRET=your-internal-secret-here
heroku config:set OFFICE_LATITUDE=14.5794
heroku config:set OFFICE_LONGITUDE=121.0202
heroku config:set HOLIDAY_COUNTRY_CODE=PH
heroku config:set TRUST_PROXY=1

# Or use .env file approach (see .env.production.example)
```

#### Deploy

```bash
# Commit and push
git add backend/
git commit -m "security: phase 1 & 2 hardening"
git push heroku main

# Watch logs
heroku logs --tail
```

### 3. Vercel Frontend Setup

Set `NEXT_PUBLIC_APP_URL` in Vercel dashboard to point to Heroku backend:

```
NEXT_PUBLIC_APP_URL=https://your-app-name.herokuapp.com
```

(The frontend's `next.config.mjs` rewrites `/api/*` to this URL.)

### 4. Verify Deployment

#### Test health endpoint

```bash
curl https://your-app-name.herokuapp.com/health
```

Expected response:
```json
{
  "success": true,
  "data": { "status": "ok", "timestamp": "..." },
  "error": null
}
```

#### Test CORS from Vercel

Open browser DevTools on your Vercel app and run:

```javascript
fetch('https://your-app-name.herokuapp.com/api/v1/logs', {
  method: 'GET',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' }
})
```

Should succeed (if logged in) or return 401 (if not logged in). Should NOT return CORS error.

#### Test auth flow

1. Go to Vercel frontend
2. Try signing up / logging in
3. Check Heroku logs for security events
4. Verify session is created

### 5. Monitor Production

#### Heroku logs show security events:

```
[security] { 
  event: 'cors_reject',
  timestamp: '2025-01-01T...',
  ip: '192.x.x.x',
  context: { ... }
}
```

#### Common issues and fixes:

| Issue | Cause | Fix |
|-------|-------|-----|
| CORS error on frontend | `FRONTEND_ORIGIN` not set correctly | Add Vercel domain to config |
| CSRF reject (403) | Origin header mismatch | Check browser is sending `Origin` header |
| Rate-limit (429) | Too many requests in time window | Increase `RATE_LIMIT_*_MAX` or wait for window to reset |
| Auth fails silently | `BETTER_AUTH_URL` mismatch | Ensure it matches your Heroku app URL |

---

## Security Checklist

- ✅ Secrets are strong (generated with `openssl rand -base64 32`)
- ✅ `TRUST_PROXY=1` set for Heroku
- ✅ `FRONTEND_ORIGIN` is specific to your Vercel domain (avoid broad wildcards)
- ✅ `INTERNAL_AUTOMATION_SECRET` is set if using internal endpoints
- ✅ SSL/TLS enforced (Heroku and Vercel both use HTTPS by default)
- ✅ Rate limiting configured for your expected user load
- ✅ Logs monitored for security events

---

## Rollback Plan

If something goes wrong:

```bash
# View past deployments
heroku releases

# Rollback to previous version
heroku releases:rollback v10  # Replace v10 with your version

# Or redeploy manually
git push heroku main
```

---

## Additional Resources

- **Better Auth Docs:** https://www.better-auth.com/docs
- **Heroku Deployment:** https://devcenter.heroku.com/articles/git
- **Vercel Deployment:** https://vercel.com/docs
- **PostgreSQL on Heroku:** https://devcenter.heroku.com/articles/heroku-postgresql
