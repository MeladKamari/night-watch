# Pro+ risk register (opened at STEP 001)

Living register. Status vocabulary: `OPEN` / `MITIGATED` / `ACCEPTED` / `BLOCKED`.

| ID | Risk | Impact | Likelihood | Status | Mitigation / notes |
|---|---|---|---|---|---|
| R-001 | Accidental change to `default-v1` hash/visitorId while adding Pro+ | Breaks existing deployments and parity tests | Medium | **MITIGATED** (STEP 001) | Golden vectors + `tests/proplus-step001-baseline.test.ts`; treat ALGORITHM_SCHEMA as immutable |
| R-002 | Reintroducing `applePay` via custom sources or docs | Scope / policy violation | Low | **MITIGATED** | `EXCLUDED_UPSTREAM_SOURCE` guards + `pnpm run ci:guard` |
| R-003 | Assuming 73-step track complete without verification | Building Pro+ on broken baseline | High (pre-audit) | **MITIGATED** | STEP 001 source + test audit; build/typecheck/529 tests PASS |
| R-004 | No git history / commit SHA in workspace | Weak provenance and rollback provenance | Medium | **OPEN** | Initialize or attach VCS before release; inventory records `gitCommit: null` |
| R-005 | Claiming Fingerprint Pro accuracy / Smart Signal parity | Legal/trust and false certainty | High if claimed | **OPEN** | Public matrix is goal scope only; use UNKNOWN/UNSUPPORTED; no vendor parity claims |
| R-006 | Faking 10 native-only Smart Signals in browser JS | Misleading security posture | Medium | **OPEN** | Scope lock: return `not_applicable` / `requires_native_sdk` only when catalog requested |
| R-007 | Treating VPN/CGNAT/Iran ISP signals as sole reject reason | Unfair treatment of benign users | Medium | **OPEN** | Policy: network signals are context; never sole auth/deny |
| R-008 | Browser payload treated as trusted by future server | Spoofing / privilege escalation | High once server lands | **OPEN** | Architecture trust model: browser untrusted; server authoritative |
| R-009 | Pro+ packages mutating `@night-watch/core` / `@night-watch/browser-sdk` defaults | Silent visitorId drift | Medium | **OPEN** | STEP 002: separate namespace; adapters only |
| R-010 | Missing backend/dashboard today mistaken for “ready Pro+” | False completion | High | **MITIGATED** (documented) | Inventory marks ASP.NET/Angular/Redis/Postgres **MISSING** |
| R-011 | Offline/air-gapped runtime broken by CDN or SaaS deps | Self-hosted deployment failure | Medium | **OPEN** | Keep first-party-only; no runtime call-home |
| R-012 | E2E / real Iran device matrix not re-run in STEP 001 | Residual browser-environment risk | Medium | **ACCEPTED** (for STEP 001) | Vitest + registry/guard PASS; Playwright matrix `NOT_RUN` this step — schedule later |
| R-013 | Confidence score misread as calibrated probability | Bad product decisions | High | **OPEN** | Existing comments mark heuristic; Pro+ must keep uncalibrated/absent until real calibration data |
| R-014 | Secrets or tenant data in future logs/URLs | Privacy/security incident | Medium | **OPEN** | Enforce minimization, retention, erasure in later steps |
| R-015 | License / supply-chain drift when adding .NET/npm deps | Compliance | Medium | **OPEN** | Reuse offline SBOM/lockfile gates; review new licenses |

## Evidence notes

- Local validation this step: `pnpm build`, `pnpm typecheck`, `pnpm test` (529), `pnpm test:registry`, `pnpm run ci:guard`.
- `pnpm test:e2e` and `pnpm lint` were **NOT RUN** in STEP 001 (recorded honestly).
