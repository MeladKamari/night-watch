# Rollback procedure

## When to roll back

- RC/stable build introduces hash/ID breaks without a documented manifest bump.
- Production egress / telemetry regression.
- Critical vulnerability in a published tarball.
- Accidental publish without authorization.

## Client / self-hosted rollback (preferred)

1. Redeploy the previous known-good `fp.min.js` / ESM artifacts from your
   artifact store (use `reference/artifact-checksums.sha256` to verify).
2. Keep `SOURCE_MANIFEST_REVISION` aligned with stored visitorIds; do not mix
   `default-v1` IDs with a future revision without migration notes.
3. Clear CDN/edge caches for the script URL if you use one **on your origin**.

## npm dist-tag rollback (only if a publish already occurred)

```bash
# Example — requires human auth and npm credentials
npm dist-tag add @night-watch/browser-sdk@<previous> latest
npm dist-tag add @night-watch/core@<previous> latest
# Optionally deprecate the bad version
npm deprecate @night-watch/browser-sdk@<bad> "Use <previous>; see CHANGELOG"
```

Do **not** `npm unpublish` after 72h or if dependents exist; prefer deprecate.

## Git tag rollback

- Prefer adding a new fix tag over deleting published annotated tags that others
  may have fetched.
- If a mistaken local tag was never pushed: `git tag -d v1.0.0`.
- If already pushed: only delete remote tags with explicit authorization
  (`git push origin :refs/tags/v1.0.0`) and communicate to consumers.

## Data / visitorId considerations

Rolling back the script does not rewrite historical server-side IDs. Document
which algorithm revision each stored ID used. See `docs/MIGRATION.md`.
