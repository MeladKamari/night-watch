# Night Watch 1.0 release checklist

## Product

- [x] Brand: Night Watch (`@thenightwatch/*`, IIFE `NightWatch`)
- [x] Browser SDK 41-source `default-v1`
- [x] Framework packages: vanilla, react, vue, angular, preact, blazor
- [x] Server API identity-v4 + admin console + playground
- [x] Versions **1.0.0**, MIT + NOTICE, SECURITY / CONTRIBUTING / CHANGELOG

## Before first public push

1. Confirm `.gitignore` excludes local scratch, `artifacts/`, secrets, `bin/`/`obj/`.
2. `pnpm release:prepare` (build + tests + SBOM + checksums).
3. Create npm organization **`night-watch`** (scoped packages need it).
4. `npm login` with an owner of that org.
5. `pnpm release:publish -- --execute`
6. Tag git: `git tag v1.0.0 && git push origin v1.0.0`
7. Optional: pack `NightWatch.Blazor` NuGet from `packages/blazor/csharp`.

## Install (consumers)

```bash
pnpm add @thenightwatch/browser-sdk
# or
pnpm add @thenightwatch/react
```

```html
<script src="/vendor/night-watch/fp.min.js"></script>
<script>
  NightWatch.load({ monitoring: false }).then((a) => a.get())
</script>
```
