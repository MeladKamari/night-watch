# Private PKI (offline)

1. Create lab CA: `openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 3650 -subj "/CN=IBF Lab CA"`
2. Issue leaf for `identify.local.test` signed by lab CA.
3. Trust `ca.crt` on clients (Windows Trusted Root / NSS / macOS keychain).
4. Point nginx `ssl_certificate` / `ssl_certificate_key` at the leaf.
5. HA: run two nginx instances behind keepalived VIP; API upstream list multiple `127.0.0.1`/`10.x` backends — no foreign CDN.
6. Forbidden: fingerprint.com, openfpcdn, third-party analytics beacons.
