# Nimbus Console

An AWS-style management console for a private cloud. Customers consume services
from your cloud through a familiar UI: compute, storage, networking, load
balancing, and security.

The initial focus is **Load Balancers**, which combines the feature sets of
AWS NLB (Layer 4) and AWS ALB (Layer 7) into a single unified service.

## What's implemented

### Load Balancers

Request shape mirrors AWS so migration guides transfer directly.

**Application load balancers (Layer 7):**
- HTTP / HTTPS listeners
- SSL/TLS termination, SSL policies, SNI, multiple certificates per listener
- Listener rules with conditions: host-header, path-pattern, http-header,
  http-request-method, query-string, source-ip
- Actions: forward (multi target group + weights + sticky), redirect,
  fixed-response, authenticate-oidc
- HTTP/2, WebSocket-ready, idle timeout, X-Forwarded-For handling modes,
  desync mitigation mode, drop-invalid-header-fields, WAF fail-open toggle

**Network load balancers (Layer 4):**
- TCP / UDP / TCP_UDP / TLS listeners
- Static IP per availability zone
- ALPN policies, SSL/TLS termination
- Preserve client IP, connection termination on deregistration

**Common:**
- Internet-facing / internal
- IPv4 / dual-stack
- Cross-zone load balancing
- Deletion protection
- Access logs
- Tags
- Provisioning lifecycle (provisioning → active)

### Target Groups

- Target types: `instance`, `ip`, `lambda`, `alb`
- All AWS protocols (HTTP/HTTPS/TCP/UDP/TCP_UDP/TLS/GENEVE)
- Protocol versions HTTP1/HTTP2/gRPC (ALB)
- Health checks: protocol, port, path, interval, timeout, healthy /
  unhealthy thresholds, HTTP matcher codes
- Stickiness: `lb_cookie`, `app_cookie`, `source_ip`, `source_ip_dest_ip`
- Load balancing algorithm: round_robin / least_outstanding_requests /
  weighted_random
- Slow start (ALB), deregistration delay, preserve client IP / proxy
  protocol v2 (NLB)
- Register / deregister targets, simulated health-check convergence

## Tech stack

- **Monorepo** via npm workspaces
- `shared/`  - TypeScript domain types shared by server + web
- `server/`  - Express + TypeScript REST API, in-memory store, zod validation
- `web/`     - React + Vite + TypeScript console UI

## Run

```bash
npm install                 # install workspaces
npm run dev:server          # http://localhost:4000
npm run dev:web             # http://localhost:5173
# or both at once:
npm run dev
```

The API is proxied from the Vite dev server at `/api`. Sample data is seeded
on startup: 2 VPCs, 3 target groups, 1 ALB (with HTTP→HTTPS redirect and 4
rules) and 1 NLB (TCP:5432).

## REST API tour

```
GET    /api/health
GET    /api/vpcs
GET    /api/load-balancers
POST   /api/load-balancers
GET    /api/load-balancers/:id
PATCH  /api/load-balancers/:id/attributes
DELETE /api/load-balancers/:id

GET    /api/target-groups
POST   /api/target-groups
GET    /api/target-groups/:id
POST   /api/target-groups/:id/targets
DELETE /api/target-groups/:id/targets
DELETE /api/target-groups/:id

POST   /api/listeners
GET    /api/listeners?loadBalancerId=...
DELETE /api/listeners/:id
POST   /api/listeners/:id/rules
DELETE /api/listeners/:id/rules/:ruleId
```

## Deploy a live demo (free, phone-friendly)

The repo ships with `vercel.json` (web) and `render.yaml` (API). Both
services have free tiers. Flow from a phone browser:

### 1. Deploy the API on Render

1. Go to **render.com** → sign in with GitHub.
2. **New → Blueprint** → pick this repo → branch
   `claude/cloud-console-load-balancers-5gFEd`.
3. Render detects `render.yaml`, shows `nimbus-api` on the free plan →
   **Apply**.
4. Wait ~3 min for build. Copy the URL Render assigns, e.g.
   `https://nimbus-api.onrender.com`. Test it by opening
   `<url>/api/health` — you should see `{"ok":true,...}`.

### 2. Deploy the web on Vercel

1. Go to **vercel.com** → sign in with GitHub.
2. **Add New → Project** → import this repo → branch
   `claude/cloud-console-load-balancers-5gFEd`.
3. Vercel reads `vercel.json` and pre-fills the build command. Before
   clicking **Deploy**, expand **Environment Variables** and add:
   - `VITE_API_URL` = the Render URL from step 1 (e.g.
     `https://nimbus-api.onrender.com`)
4. **Deploy**. Vercel gives you a public URL like
   `https://nimbus-console.vercel.app`. Open it on your phone — done.

### Notes

- Render free-plan services sleep after 15 min idle; the first request
  wakes it with a ~30s cold start. Subsequent requests are instant.
- The in-memory store resets on every cold start. For a persistent
  demo, swap in Postgres via the `store` interface in
  `server/src/store/memory.ts`.
- CORS is open (`cors()`) for demo simplicity — lock it to the Vercel
  origin before going to production.

## Next steps

- Swap the in-memory store for Postgres (the `store` interface is designed
  for this).
- Add authentication (OIDC) for console users.
- Implement the Compute / Storage / VPC / IAM services shown as "Coming
  soon" in the sidebar.
- Wire the domain events to an actual LB data plane (e.g. envoy or haproxy
  control plane).
