# Security Hardening Summary - Phase 1 & 2

## Overview of Changes

This document summarizes all security improvements made across Phase 1 and Phase 2.

---

## Phase 1: Critical Fixes

| Finding | Fix | Impact | Heroku/Vercel Compat |
|---------|-----|--------|----------------------|
| **Broken Auth Route** | Fixed wildcard routing: mounted `/api/auth` before JSON parser | ✅ Auth now works | ✅ No conflict |
| **Missing Security Headers** | Added `helmet()` middleware globally | ✅ Blocks XSS, clickjacking, MIME-sniffing | ✅ No conflict |
| **Unsafe CORS Wildcard** | Replaced regex with structured origin parser; fail-fast validation | ✅ Only allows configured origins; no info leak | ✅ Supports Vercel wildcards |
| **No Rate Limiting** | Added `express-rate-limit` on auth + automation routes | ✅ Prevents brute-force, DoS | ✅ Works with Heroku proxy |
| **Weak Internal Secret** | Upgraded to timing-safe digest comparison | ✅ Resistant to timing attacks | ✅ No conflict |
| **GPS Spoofing** | All client GPS marked as "Remote" pending server verification | ✅ Prevents fake On-site claims | ✅ No conflict |

---

## Phase 2: Hardening & Audit

| Feature | Implementation | How It Works | Config |
|---------|-----------------|--------------|--------|
| **CSRF Protection** | Middleware on `/api/v1/*` state-changing requests | Validates `Origin`/`Referer` headers; allows internal routes with secret | `FRONTEND_ORIGIN` |
| **User-Aware Rate Limit** | Key: `${userId}:${ip}` for authenticated routes | Protects against account enumeration + per-IP abuse | `RATE_LIMIT_USER_*` |
| **Security Audit Log** | Structured logging to stdout with `[security]` prefix | Tracks CORS/CSRF/rate-limit/auth failures | Logs to stderr/stdout |
| **Proxy Safety** | `TRUST_PROXY` env-configurable | Correctly extracts IP from `X-Forwarded-For` on Heroku | `TRUST_PROXY=1` |
| **Config Validation** | Fail-fast on invalid `FRONTEND_ORIGIN` | App will not start if origin is malformed | Caught at startup |

---

## Vercel + Heroku Compatibility

### FRONTEND_ORIGIN Pattern for Vercel

```bash
# Production domain
https://yourapp.vercel.app

# Production + all preview branches
https://yourapp.vercel.app,https://*.vercel.app

# Production + custom domain
https://yourapp.vercel.app,https://yourdomain.com

# All three
https://yourapp.vercel.app,https://*.vercel.app,https://yourdomain.com
```

### Why TRUST_PROXY=1?

Heroku sits behind reverse proxies:
- Client → Heroku Router (proxy) → Your dyno
- `TRUST_PROXY=1` tells Express: "The first proxy is trusted; use X-Forwarded-* headers"
- This ensures `req.ip` is correct for rate-limiting and logging

### How CORS + CSRF work together

```
Browser at https://yourapp.vercel.app
  → GET /api/v1/logs
    ✅ CORS check passes (origin matches)
    ✅ CSRF check skips (GET is not protected)
    ✅ Request succeeds

Browser at https://yourapp.vercel.app
  → POST /api/v1/logs/clock-in
    ✅ CORS check passes
    ✅ CSRF check validates Origin header
    ✅ If Origin not in FRONTEND_ORIGIN → 403 Forbidden
    ✅ If valid → request succeeds

Attacker at https://evil.com
  → POST /api/v1/logs (if user is logged in)
    ✅ CORS check blocks (origin rejected)
    ✅ Even if they bypass CORS, CSRF rejects (Origin not allowed)
    ✅ Double protection
```

---

## New Environment Variables (Phase 2)

```bash
# Proxy configuration
TRUST_PROXY=1                                   # For Heroku (default)

# Rate limiting (tunable)
RATE_LIMIT_AUTH_MAX=100                        # Login attempts per window
RATE_LIMIT_AUTH_WINDOW_MS=900000               # 15 minutes
RATE_LIMIT_USER_MAX=120                        # API calls per user+IP per window
RATE_LIMIT_USER_WINDOW_MS=900000               # 15 minutes
RATE_LIMIT_AUTOMATION_MAX=60                   # Internal endpoints per window
RATE_LIMIT_AUTOMATION_WINDOW_MS=900000         # 15 minutes
```

---

## Security Event Logging

All security events are logged to stderr with `[security]` prefix.

### Examples

```json
[security] {
  "event": "cors_reject",
  "timestamp": "2025-01-15T10:30:45.123Z",
  "ip": "192.168.1.100",
  "method": "OPTIONS",
  "path": "/api/v1/logs",
  "context": {
    "reason": "origin_not_allowed",
    "originPresent": true,
    "refererPresent": false
  }
}

[security] {
  "event": "csrf_reject",
  "timestamp": "2025-01-15T10:31:10.456Z",
  "ip": "192.168.1.100",
  "userId": "user_12345",
  "method": "POST",
  "path": "/api/v1/logs/clock-in",
  "context": {
    "reason": "missing_origin_and_referer",
    "originPresent": false,
    "refererPresent": false
  }
}

[security] {
  "event": "rate_limit_exceeded",
  "timestamp": "2025-01-15T10:32:00.789Z",
  "ip": "192.168.1.100",
  "userId": "user_12345",
  "method": "POST",
  "path": "/api/v1/logs/clock-in",
  "context": {
    "reason": "user_api_limiter",
    "keyType": "user+ip"
  }
}
```

### Monitor in Heroku

```bash
# Watch real-time logs
heroku logs --tail

# Filter for security events
heroku logs --tail | grep "\[security\]"

# Export logs for analysis
heroku logs > logs.txt
```

---

## Testing in Production

### 1. Verify CORS works

```bash
# From browser console on Vercel frontend
fetch('https://your-backend.herokuapp.com/api/v1/logs', {
  method: 'GET',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' }
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Expected: Either success (if logged in) or `{ error: "Unauthorized" }`. NOT a CORS error.

### 2. Verify CSRF protection

```bash
# Try POST from different origin (should fail)
curl -X POST https://your-backend.herokuapp.com/api/v1/logs/clock-in \
  -H 'Content-Type: application/json' \
  -b 'session-cookie' \
  -H 'Origin: https://evil.com'
```

Expected: `403 Forbidden`

### 3. Verify rate limiting

```bash
# Make 101 rapid auth attempts (exceeds RATE_LIMIT_AUTH_MAX=100)
for i in {1..101}; do
  curl -X POST https://your-backend.herokuapp.com/api/auth/sign-in \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

Last one should return: `429 Too Many Requests`

### 4. Check security logs

```bash
heroku logs --tail

# You should see [security] events for rate-limit violations
```

---

## Pre-Deployment Checklist

- [ ] `BETTER_AUTH_SECRET` generated and set
- [ ] `BETTER_AUTH_URL` matches your Heroku app URL
- [ ] `FRONTEND_ORIGIN` includes all Vercel domains you own
- [ ] `TRUST_PROXY=1` set (for Heroku)
- [ ] `DATABASE_URL` points to valid PostgreSQL
- [ ] `npm run build` passes locally
- [ ] No TypeScript errors
- [ ] Secrets stored in Heroku config (not committed to git)
- [ ] Production database is backed up before deploy
- [ ] Vercel frontend `NEXT_PUBLIC_APP_URL` points to Heroku backend

---

## Troubleshooting

### Symptom: "Origin not allowed by CORS policy"

**Cause:** `FRONTEND_ORIGIN` doesn't include your Vercel domain

**Fix:**
```bash
heroku config:set FRONTEND_ORIGIN=https://yourapp.vercel.app,https://*.vercel.app
```

### Symptom: Auth works but API calls fail with 403 Forbidden

**Cause:** CSRF middleware blocking requests without proper Origin/Referer

**Fix:**
- Vercel frontend should send `Origin` header automatically in cross-origin requests
- If issue persists, check that `cookies` are being sent (`credentials: 'include'`)
- Look at logs: `heroku logs --tail | grep csrf_reject`

### Symptom: High rate-limit rejections (429)

**Cause:** Legitimate users hitting rate limit

**Fix:**
- Increase `RATE_LIMIT_USER_MAX` and/or `RATE_LIMIT_USER_WINDOW_MS`
- Example: 120 → 300 requests per 15 minutes
- Be aware: higher = more abuse risk

### Symptom: TypeError in logs about "timingSafeEqual"

**Cause:** Internal secret validation error (rare)

**Fix:**
- Verify `INTERNAL_AUTOMATION_SECRET` is a valid string
- If not using internal endpoints, leave it unset

---

## Next Steps (Optional Hardening)

1. **Add request signing** for critical endpoints (geofence, manual logs)
2. **Implement distributed rate limiting** if you scale to multiple dynos
3. **Add WAF rules** via Heroku Shield or Cloudflare
4. **Set up monitoring** with Sentry or Datadog for security events
5. **Annual security audit** of dependencies and auth flow
