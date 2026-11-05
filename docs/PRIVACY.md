# Privacy policy integration guidance

This SDK does **not** provide legal compliance by itself. Integrators own notices,
lawful basis, consent, retention, and user rights under applicable law.

## What the SDK collects (default)

On `agent.get()`, the library reads browser APIs for the **41** Default-profile
sources (UA-CH, fonts, canvas, WebGL, storage capability flags, locales, etc.)
and computes an in-memory `visitorId`. By design:

- no automatic third-party `fetch` / XHR / beacon / WebSocket,
- no persistent SDK cookie or localStorage visitor key,
- `monitoring: false` by default and no-op when true,
- temporary cookie only inside the `cookiesEnabled` probe (cleaned up).

Treat `visitorId` and raw components as **potentially personal or linkable
data** once stored server-side or joined with accounts.

## Suggested notice elements (integrator checklist)

1. **Purpose** — e.g. session integrity, abuse prevention, analytics (pick real ones).
2. **Data categories** — device/browser technical signals; hashed identifier.
3. **Legal basis** — consent and/or other valid basis for your jurisdiction(s).
4. **Retention** — how long IDs/components are kept; deletion path.
5. **Sharing** — whether any processor receives the ID (default SDK shares none).
6. **User rights** — access, deletion, objection where applicable.
7. **Cross-border** — do not assume Iran law alone covers every visitor.

Persian-language notices are recommended for first-party apps serving Persian
speakers; wording must match the **operator’s** purpose, not this README.

## Consent UX patterns

- Gate collection behind an explicit control (playground checkbox pattern).
- Prefer collecting after disclosure, not on first paint by default.
- If you disable sources for policy reasons, use `excludeSources` /
  `omitComponents` and record the algorithm impact.

## What not to write in a privacy policy

- “FingerprintJS official” / affiliate claims,
- “100% unique device ID”,
- “detects nationality from timezone/language”,
- “SDK guarantees GDPR/CCPA compliance”.

## Related

- `SECURITY.md` — vulnerability reporting
- `docs/ACCURACY_AND_LIMITATIONS.md` — accuracy caveats
- `NOTICE` — licensing attribution (not a privacy notice)
