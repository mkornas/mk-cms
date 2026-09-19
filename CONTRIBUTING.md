# Contributing to mk-cms

Thanks for taking a look. mk-cms is a small project with a clear shape; the
easiest contributions are the ones that keep it that way.

## Ground rules

- **Bugs and small fixes:** open a pull request.
- **New modules, field types, or schema changes:** open an issue first so we
  can agree on the shape (`docs/ARCHITECTURE.md` is the reference).
- **Security issues:** do not open a public issue — see `SECURITY.md`.

## Setup

- Node **22+**, pnpm (`corepack enable`), Docker.
- `pnpm install`
- `pnpm infra:up` — Postgres + Redis (+ MinIO) from `docker/docker-compose.yml`
- `cp .env.example .env`
- `pnpm api:dev` — API on http://localhost:4000 (migrations run on boot)
- `pnpm admin:dev` — admin on http://localhost:4300, proxied to the API

## Quality bar

- `pnpm --filter @mk-cms/api test` passes; new server logic comes with a test.
- `pnpm --filter @mk-cms/admin build` passes; the admin uses `@mk-kit/ui`
  components and `--mk-*` tokens only — no hand-rolled widgets, no hardcoded
  colours.
- Schema changes ship with a TypeORM migration (`pnpm --filter @mk-cms/api
  migration:generate`), never `DB_SYNCHRONIZE`.
- GraphQL changes update `docs/API.md`.

## Developer Certificate of Origin

By contributing you certify the [DCO 1.1](https://developercertificate.org/).
Sign your commits with `git commit -s`.
