# Night Watch — On-prem deploy pack

Self-hosted stack for private cloud or air-gapped data centers. No foreign SaaS runtime dependency.

## What ships

| Piece | Path |
|-------|------|
| Compose stack | `server/docker-compose.yml` (postgres, redis, api, worker; optional gateway/dashboard profiles) |
| API image | `server/Dockerfile` |
| Worker image | `server/Dockerfile.worker` |
| Secrets / nginx | `server/deploy/` |
| First-party gateway | `deploy/gateway/` (Envoy + nginx samples) |
| Offline image notes | `server/deploy/OFFLINE_IMAGES.md` |

## Data residency defaults

- `NightWatch__IpDatasets__AllowOutboundLookup=false` — no outbound IP intel calls
- `NightWatch__FeatureFlags__ExperimentalMl=Disabled`
- Metering invoice gateway: `none_self_hosted` (no Apple Pay / card networks)
- Console air-gap: leave `window.NIGHT_WATCH_NETWORK` unset for demo-only UI

## Quick start (lab)

```bash
cd server
cp deploy/.env.example .env   # set POSTGRES_PASSWORD
docker compose up --build -d postgres redis api
# API: http://127.0.0.1:8080
```

Air-gapped: load images per `OFFLINE_IMAGES.md`, then `docker compose up -d` without build.

## Hardening checklist

1. Replace compose secrets; never commit production passwords
2. Terminate TLS at first-party same-origin gateway (`deploy/gateway/`)
3. Keep admin console behind VPN / private network; enable `NIGHT_WATCH_NETWORK=1` only on trusted hosts
4. Run DPO erase/export from console Privacy page (Administrator / DPO role)
5. Prefer Postgres persistence for production; in-memory admin state is lab-only
6. Document retention days per project (Tenant console → retentionDays)

## Helm

Minimal chart: `server/deploy/helm/night-watch/` (postgres + redis + api + worker). Compose remains the lab source of truth.
