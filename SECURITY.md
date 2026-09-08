# Security policy

## Reporting

Do not disclose suspected vulnerabilities in public issues. Send a private report through the
organization's confidential security channel with reproduction steps, affected versions, and
impact.

## Dependency review

Dependencies are reviewed with `npm audit --omit=dev` and updated through tested pull requests.

## Runtime baseline

- Production traffic must use HTTPS through the trusted reverse proxy. HSTS, CSP, frame denial,
  MIME sniffing protection, a restrictive referrer policy, and permissions policy are emitted by
  the application/edge configuration.
- Refresh and logout requests carrying authentication cookies validate the browser `Origin` against
  the configured `WEB_URL`. Access tokens remain in memory rather than browser persistence.
- Global, login, registration, and webhook throttles complement provider/WAF limits. Request and
  upload bodies have explicit limits.
- `/metrics` and `/health/operational` require a dedicated 32+ character production bearer token.
  Logs never include request bodies, database parameters, passwords, tokens, or cookie values.
- Production secrets belong in the deployment secret store. Rotate JWT/cookie, database, SMTP,
  Safepay, and monitoring credentials after suspected exposure.

Before each release, run `npm run validate`, `npm run test:e2e`, and
`npm run security:audit`; review every finding and document any temporary exception below.

### React Router GHSA-qwww-vcr4-c8h2

React Router 7.18.2 is retained because it resolves the older XSS, open-redirect, denial-of-service,
and deserialization advisories affecting earlier 7.x releases. The remaining advisory concerns
React Server Components action handling. Veyora uses React Router exclusively as a client-side
Vite SPA and exposes no React Router framework-mode or RSC server/action endpoints, so the vulnerable
execution path is not present. Reassess this exception when a patched 7.x release becomes available
or before enabling any React Router server feature.
