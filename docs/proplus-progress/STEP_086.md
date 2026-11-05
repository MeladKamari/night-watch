# STEP 086 — Pro+ Web Agent public API and backward compatibility

**Date:** 2026-11-04
**Status:** **IMPLEMENTED/VALIDATED** (vitest packages/pro-web-agent Passed 3; tsc build OK).

## Changed files
- `packages/pro-web-agent/**` (new `@night-watch/web-agent`)
- `tsconfig.json`, root `package.json` workspace wiring

## Implemented
- `start` / `get` / `identify` / `getVisitorData` / `clearTransientState` / `stop` / `on`
- State machine; unknown options rejected; protocol version negotiation
- Single-flight; AbortSignal; no network when mode `off`/`browser_only`
- Wraps `@night-watch/browser-sdk` load()/get(); visitorId = hashComponents; 41 sources; no applePay
- No global collisions (class API only)

## Tests
```
pnpm --filter @night-watch/web-agent run build
pnpm exec vitest run packages/pro-web-agent
# Passed 3
```

## Next
STEP 087 — Typed first-party transport and server configuration
