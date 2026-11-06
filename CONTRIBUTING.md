# Contributing

Thanks for helping with **Night Watch**.

## Setup

- Node.js ≥ 20, pnpm 12
- .NET SDK 10.x for `server/`

```bash
pnpm install
pnpm build
pnpm test
```

API tests:

```bash
dotnet test server/NightWatch.sln -c Release
```

## Guidelines

- Keep `@thenightwatch/*` branding; never reintroduce Fingerprint / FingerprintJS Pro claims.
- Do not add runtime calls to fingerprint SaaS hosts.
- Algorithm changes that alter `visitorId` require a new `SOURCE_MANIFEST_REVISION` and a CHANGELOG entry.
- Prefer small, focused PRs with tests.

## Release

Push to `main` (paths under `packages/*`) runs `.github/workflows/publish.yml`:
quality gates → auto patch bump (or keep a local ahead version) → npm publish → git tag.

Manual bump: Actions → **publish** → Run workflow → choose `patch` / `minor` / `major`.

**npm Trusted Publisher** (required for tokenless CI; once per package):

1. https://www.npmjs.com/package/@thenightwatch/PACKAGE → Settings → Trusted Publisher  
2. GitHub Actions · user `MeladKamari` · repo `night-watch` · workflow `publish.yml`  
3. Allow `npm publish`

Optional fallback: repo secret `NPM_TOKEN` (granular, Bypass 2FA).

Local: `pnpm release:prepare` then `pnpm release:publish:execute`. npm tag for 1.x is `latest`.

**Blazor** ships on **NuGet** as `NightWatch.Blazor` (`pnpm release:nuget:execute` with `NUGET_API_KEY`) — not npm.
