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

- Keep `@night-watch/*` branding; never reintroduce Fingerprint / FingerprintJS Pro claims.
- Do not add runtime calls to fingerprint SaaS hosts.
- Algorithm changes that alter `visitorId` require a new `SOURCE_MANIFEST_REVISION` and a CHANGELOG entry.
- Prefer small, focused PRs with tests.

## Release

Maintainers cut releases with `pnpm release:prepare` and `pnpm release:publish`
(see `scripts/release/`). Version **1.x** uses npm tag `latest`.
