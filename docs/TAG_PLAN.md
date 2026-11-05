# Annotated tag plan

## Intended tag

| Field | Value |
|---|---|
| Tag | `v1.0.0` |
| Type | Annotated (`-a`) |
| Packages | `@night-watch/core@1.0.0`, `@night-watch/browser-sdk@1.0.0` |
| Manifest | `default-v1` (41 sources) |
| npm dist-tag (if published) | `next` — **not** `latest` until stable |

## Local tag command (after gates; no push unless authorized)

```bash
git tag -a v1.0.0 -m "Night Watch 1.0.0 (default-v1, 41 sources)"
git show v1.0.0
```

## Push / publish (explicit authorization required)

```bash
# ONLY when a human authorizes remote publish:
git push origin v1.0.0
pnpm --filter @night-watch/core publish --access public --tag next --no-git-checks
pnpm --filter @night-watch/browser-sdk publish --access public --tag next --no-git-checks
```

Do **not** run the push/publish block without that authorization.

## Tag message checklist

- Version and date
- Manifest revision and source count
- Pointer to `CHANGELOG.md` section
- Note: not affiliated with FingerprintJS Inc.
