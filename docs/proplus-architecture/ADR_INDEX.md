# Night Watch ADR index (foundation)

Legacy browser ADRs remain in `docs/DECISIONS.md` (ADR-001…). ProPlus platform ADRs start at **ADR-P001**.

---

## ADR-P001 — Independent product namespace `@night-watch`

- **Status:** Accepted (STEP 002)
- **Decision:** Ship ProPlus under `@night-watch/*` / product code `night-watch`, separate from `@night-watch/*` legacy SDK.
- **Why:** Prevent marketing/API collision with Fingerprint Pro; keep additive imports.
- **Consequences:** Two identity planes; compatibility doc required.

## ADR-P002 — ASP.NET Core (.NET) modular monolith for backend

- **Status:** Accepted (STEP 003)
- **Decision:** Implement ingestion, identity, risk, management APIs as an ASP.NET Core modular monolith (target .NET 10 LTS when toolchain available; otherwise current LTS installed locally).
- **Why:** Strong typing, first-class DI, OpenAPI, mature auth/middleware, excellent Windows/Linux on-prem fit for Iran DC/air-gap; team path already Rider/.NET-oriented (`RiderProjects`).
- **Alternatives considered:** Node NestJS (rejected: split stack duplication with future C# preference); multiple microservices day-one (rejected: ops cost before measurement).
- **Consequences:** C# solution under `server/`; TypeScript `@night-watch/server-sdk` remains a thin client.

## ADR-P003 — PostgreSQL as system of record

- **Status:** Accepted (STEP 003)
- **Decision:** PostgreSQL stores tenants, immutable observation events, identity graph, signal evaluations, audit, outbox.
- **Why:** ACID, JSONB for evolving evidence, RLS for tenant isolation, partitioning path, offline-friendly licensing.
- **Alternatives:** MongoDB (weaker relational integrity for graph/outbox); cloud-only warehouses (rejected for air-gap).
- **Consequences:** Migrations owned by backend; Redis never SoR.

## ADR-P004 — Redis for cache, dedupe, and velocity counters

- **Status:** Accepted (STEP 003)
- **Decision:** Redis holds short-TTL idempotency/dedupe keys, rate counters, and velocity windows.
- **Why:** Low-latency ephemeral workloads; rebuildable if lost.
- **Alternatives:** Postgres-only counters (rejected for hot path latency); in-process memory (rejected for multi-instance).
- **Consequences:** Redis outage degrades velocity/rate features to `unavailable`, not silent zero.

## ADR-P005 — Trust model: browser untrusted, server authoritative

- **Status:** Accepted (STEP 003)
- **Decision:** Browser components and client-supplied risk hints are untrusted input. Server assigns `eventId` / server `visitorId`, signs receipts, evaluates risk.
- **Why:** Spoofing resistance; aligns with security gate.
- **Consequences:** Legacy local `visitorId` preserved as evidence feature only.

## ADR-P006 — Local-only / Self-hosted processing

- **Status:** Accepted (STEP 003)
- **Decision:** No runtime dependency on foreign CDN, geolocation SaaS, or Fingerprint vendor endpoints. Intelligence via signed offline bundles when needed.
- **Why:** Air-gap and regional sovereignty.
- **Consequences:** Some signals stay `provider_unavailable` until bundles exist.

## ADR-P007 — Sync identify with honest degradation

- **Status:** Accepted (STEP 003)
- **Decision:** `/v1/identify` is synchronous with p95 budget ≤ 250 ms lab target; heavy enrichment may continue async; missing evidence → explicit statuses, never fabricated certainty.
- **Why:** UX needs immediate event id; accuracy honesty > fake scores.
- **Consequences:** Calibration deferred until labeled datasets exist.

## ADR-P008 — Angular + PrimeNG for admin (deferred app bootstrap)

- **Status:** Accepted (direction); UI app not bootstrapped until phase 07
- **Decision:** Dashboard uses Angular + PrimeNG with Persian RTL / English.
- **Why:** Enterprise table/form density; RTL support; matches roadmap.
- **Consequences:** `@night-watch/dashboard-client` precedes the Angular app.
