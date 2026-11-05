# Security policy

## Supported versions

| Version | Supported |
|---|---|
| **1.x** | Yes |
| 0.x / RC / alpha | No — upgrade to 1.x |

Pin exact package versions and verify artifact checksums for air-gapped deploys.

## Reporting a vulnerability

Prefer coordinated, private disclosure to the maintainers of your deployment.
Do **not** file public issues that include exploit PoCs against production sites,
credentials, or personal data.

When reporting, include: SDK / API version, `SOURCE_MANIFEST_REVISION`, browser and
OS, whether self-hosted, and a minimal reproduction that does not require
third-party network access.

## Scope reminders

- The browser SDK is **client-side**. It is not device attestation.
- Do not rely on `visitorId` or `confidence.score` alone for authentication or
  high-value authorization.
- Expected behavior: zero automatic third-party network egress during `get()`.
- Server deployments must replace default compose/dev secrets before production.
