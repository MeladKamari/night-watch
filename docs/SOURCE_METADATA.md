# Compatibility-preserving source metadata registry (step 72)

**Optional documentation registry** — does **not** change `SOURCE_MANIFEST_REVISION`
(`default-v1`) or visitorId hashing. Default `load()` ignores it.

## Why

- Expose per-source **privacy category**, **stability**, **cost**, **browser support**,
  and documented **dependency** hints for future plugins/profiles.
- Keep the v5.3.0-aligned 41-source set reproducible (no `applePay`).

## API

```ts
import {
  getSourceMetadataRegistry,
  getSourceMetadata,
  SOURCE_METADATA_REGISTRY_REVISION,
} from '@thenightwatch/browser-sdk'

const registry = getSourceMetadataRegistry()
// registry.sourceCount === 41, excludesApplePay === true
const canvas = getSourceMetadata('canvas')
```

Revision: `night-watch-source-metadata-v1`. Metadata edits that should affect hashing
require an explicit algorithm / manifest revision ADR — never silently.
