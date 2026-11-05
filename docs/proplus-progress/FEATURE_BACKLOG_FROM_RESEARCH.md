# Feature backlog — research notes (Night Watch)

**Date:** 2026-11-05  
**Constraint:** Self-hosted, self-hosted / air-gappable, no Fingerprint Pro copying, no Apple Pay / native mobile track in this wave.

Sources skimmed (vendor blogs / product pages, not copied): Dregs, Trulioo Device Intelligence, Sardine, Trueonic, Incognia Network Graph, FraudSense residency, Wingman, FraudDefense, Prynt, nsxia.

## Already covered or in-flight here
- Persistent visitorId + multi-source web signals
- SmartSignals / SuspectScore / Rules / Decisions
- Bot / VPN / integrity-oriented signals (heuristic honesty)
- Fraud cases + analyst queue
- Console auth + CSRF + keys / rules / webhooks / projects / audit (this wave)
- Metering with `paymentGateway=none_self_hosted`

## High-value next features (fit this product)

| Priority | Feature | Why (from market) | Repo hook |
|----------|---------|-------------------|-----------|
| P0 | **Temporal identity graph UI** | Incognia/Trueonic: graph only works with sticky device ID + decayed edges | `IIdentityGraphService` / FraudRingGraph — expose management read + console investigation view |
| P0 | **Explainable verdict receipts** | Trueonic: probabilities with evidence, not opaque booleans | Expand decision payload: signal → weight → contribution; console “why this score” |
| P0 | **Webhook reliability ops** | All vendors push events; ops need deliveries/replay | Wired this wave; add ProcessPending worker + dead-letter dashboard polish |
| P1 | **Behavioral UEBA dimensions** | Dregs: Humanity / Authenticity / Uniqueness / Behavior as separate scores | Split SuspectScore facets instead of one blob |
| P1 | **Agentic / browser-automation detection** | Sardine 2025–26: Operator / BrowserUse-class agents | New smart-signal family (honest “unsupported” until validated) |
| P1 | **Remote-access / screen-share hints** | Trulioo APP fraud theme | **DONE** — `remote_access_detection` |
| P1 | **Privacy export / erase console** | FraudSense MENA residency + GDPR story | **DONE** |
| P2 | **Sovereign / on-prem deploy pack** | FraudSense Docker on-prem | **DONE** — ONPREM + Helm chart |
| P2 | **Signed sealed client payloads** | Prynt-style tamper-proof collect | **DONE** — identify seals + `/v1/sealed/unseal` |
| P2 | **Live console E2E + FF/WebKit** | Regression gate for management CSRF | **DONE** — chromium live + offline FF/WebKit projects |
| P3 | **OIDC / MFA for console** | Enterprise admin baseline | **DONE scaffold** — MFA opt-in + OIDC metadata |
| P3 | **Postgres-backed admin state** | Leave in-memory for labs only | **DONE** — EF dual-write + hydrate for keys/webhooks/projects (+ audit) |

## Explicit non-goals (this product wave)
- Clone Fingerprint Pro UI/API surface or marketing claims
- Apple Pay / payment network integrations
- Claiming “99.5% accuracy” without independent evaluation harness
- Shipping PII-heavy “identity verification” (names/IDs) — stay device/session intelligence

## Suggested execution order after current wave
1. Investigation graph + score explainability — **DONE 2026-11-05** (`/v1/management/graph`, Visitors page, decay projection)
2. Privacy DPO console ops — **DONE** (`/v1/management/privacy/*`, Privacy page + graph cascade on erase)
3. Behavior facet split + automation-agent signals — **DONE** (facets on explain receipt; `browser_automation_agent_detection`)
4. On-prem deploy pack — **DONE** (`server/deploy/ONPREM.md`, `compose.onprem.env.example`, Deploy docs page)
5. Live Playwright management suite (login+CSRF against API) — **DONE** (`playwright.console.live.config.ts`, `admin-console.live.spec.ts`)
6. Webhook process/enqueue + dead-letter UI — **DONE**
7. Bots / Velocity / Smart Signals live evaluate — **DONE**
