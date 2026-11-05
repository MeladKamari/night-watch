# Helm chart — Night Watch

Minimal Kubernetes packaging of `server/docker-compose.yml` (postgres, redis, api, worker).

```bash
# Create secret first
kubectl create secret generic night-watch-postgres --from-literal=password='change-me'

helm upgrade --install night-watch ./server/deploy/helm/night-watch \
  --set image.apiRepository=night-watch-api \
  --set image.tag=local
```

Air-gapped: load images offline, keep `NightWatch__IpDatasets__AllowOutboundLookup=false`.
Compose remains the source of truth for local labs (`ONPREM.md`).
