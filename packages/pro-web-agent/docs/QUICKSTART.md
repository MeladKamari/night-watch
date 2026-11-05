# @night-watch/web-agent quickstart (Self-hosted-party)

## Install

```bash
pnpm add @night-watch/web-agent @night-watch/browser-sdk
# or local tarball / internal registry
```

## Minimal browser usage

```ts
import { createProWebAgent, BrowserCollectionPolicy, FirstPartyTransport } from '@night-watch/web-agent'

const policy = new BrowserCollectionPolicy()
policy.configure({
  version: 'v1',
  decision: 'allow',
  purposes: ['fraud_prevention'],
})

const agent = createProWebAgent({
  mode: policy.canNetworkCollect('fraud_prevention') ? 'pro_plus' : 'browser_only',
  endpoint: '/api/v1/observations',
  publicApiKey: 'pk_public_only',
  purpose: 'fraud_prevention',
  consentStatus: 'granted',
})

await agent.start()
const data = await agent.identify()
// visitorId is deterministic from @night-watch/browser-sdk (41 sources). Decisions are server-side only.
```

## Transport

```ts
const transport = new FirstPartyTransport({
  baseUrl: '/api',
  publicProjectKey: 'pk_public_only',
  sameOriginOnly: true,
})
```

## Compatibility

- Mobile **browsers** / WebViews as JS contexts: supported
- Android/iOS **native SDKs**: explicitly out of scope
- Apple Pay source: excluded

## Security note

Browser signals are not device attestation. Backend verifies receipts and applies risk decisions.
