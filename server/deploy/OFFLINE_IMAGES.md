# Offline image import & cold start — Night Watch

## 1. On an online machine

```bash
cd server
docker compose pull postgres redis gateway
docker compose build api worker
docker save postgres:16.6-alpine redis:7.4.1-alpine nginx:1.27.3-alpine night-watch-api:latest night-watch-worker:latest \
  -o night-watch-images.tar
sha256sum night-watch-images.tar > night-watch-images.tar.sha256
```

Tag note: compose project builds produce local tags; retag before `docker save` if needed:

```bash
docker tag night-watch-api night-watch-api:latest
docker tag night-watch-worker night-watch-worker:latest
```

## 2. Transfer

Copy `night-watch-images.tar`, `.sha256`, this repo `server/` tree, and NuGet local cache (see `docs/OFFLINE_RESTORE.md`).

## 3. Air-gapped import & cold start

```bash
sha256sum -c night-watch-images.tar.sha256
docker load -i night-watch-images.tar
cd server
# set POSTGRES_PASSWORD in environment or .env (not committed)
export POSTGRES_PASSWORD='(from sealed secret)'
printf '%s' "$POSTGRES_PASSWORD" > deploy/secrets/postgres_password.txt
docker compose config >/dev/null
docker compose up -d postgres redis api worker
curl -fsS http://127.0.0.1:8080/health/live
curl -fsS http://127.0.0.1:8080/health/ready
```

## 4. Rules

- No plaintext production credentials in git.
- `NightWatch__IpDatasets__AllowOutboundLookup=false` always in air-gap.
- `MigrateOnStartup=true` only for Development compose profile.
- Angular dashboard profile is optional (`--profile dashboard`).
