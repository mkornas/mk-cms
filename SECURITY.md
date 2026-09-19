# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Use GitHub's private vulnerability reporting for this repository
(**Security → Report a vulnerability**), or email `hi@mateuszkornas.com` with
"mk-cms security" in the subject. Include the affected surface (admin
GraphQL, delivery GraphQL, media upload, forms, importer), a minimal
reproduction and the impact. You will get an acknowledgement within 3
business days.

## Scope

mk-cms is a self-hosted, multi-tenant headless CMS. What we treat as
security-relevant:

- Tenant isolation: any read or write that crosses a `site_id` boundary.
- Authentication and authorisation: JWT handling, capability checks on admin
  root fields, preview tokens, invite tokens.
- Untrusted input: HTML in rich-text fields, WXR imports, uploaded media (MIME
  allow-list, `sharp` processing), form submissions, webhook payloads.
- Public delivery leaking unpublished content.

Issues in NestJS, TypeORM, Angular or other dependencies should go to their
projects; a dependency problem that mk-cms fails to mitigate is in scope.

## Hardening notes for operators

- Set real `JWT_*` secrets and `SEED_OWNER_PASSWORD` — production refuses
  the defaults.
- Put the instance behind TLS; the admin stores tokens in the browser.
- `SEED_DEMO` is for demos. Don't enable it on an instance with real content.
