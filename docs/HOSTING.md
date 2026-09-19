# Hosting tenant websites

How the sites whose content lives in mk-cms actually get served — and why the
CMS deliberately does **not** host them. This is the delivery-side companion to
`ARCHITECTURE.md`.

## TL;DR

**Keep the CMS API-only. Ship each site as a static-first front-end (its own
repo from a shared starter) on Cloudflare Pages; publish events rebuild it via
the webhooks we already have.** The browser then talks to the CMS ~never: pages
are static HTML on Cloudflare's edge, media comes from public storage behind a
CDN, and only small dynamic islands (form submits, live search) call the API
cross-origin. One modest CMS instance serves any number of sites, because
visitors never touch it.

```
editor ──> admin SPA ──> mk-cms API ──┬─ content.afterPublish ─→ webhook ─→ CF Pages deploy hook
                                      │                                          │
visitor ──> www.client-a.com  (Cloudflare Pages: static HTML) ←── build fetches ─┘
                │                        (delivery GraphQL, server-side — no CORS involved)
                ├─ <img> ──> media CDN / R2 (public objects, immutable cache)
                └─ forms / live search ──> api.cms.example (the only browser→CMS traffic)
```

## Why the CMS shouldn't render sites

`ARCHITECTURE.md` locked "headless, API-only — the CMS never renders public
HTML", and it's worth keeping:

- **Blast radius.** One instance rendering N tenant sites means one bad deploy,
  one traffic spike, or one heavy page takes down every client at once.
- **Performance ceiling.** Rendering on the instance puts every visitor on your
  VPS; static-on-CDN puts them on Cloudflare's edge for free. You cannot beat
  a pre-rendered page with a runtime renderer.
- **It's the WordPress trap.** Coupling content management to page serving is
  exactly the operational model mk-cms exists to replace.

"Hosting" is therefore not a missing CMS feature — the missing piece is a
**repeatable delivery path per site**, which is a starter template + webhook
recipe, not server code.

## The cross-domain worry, examined

Cross-domain only matters for requests the **browser** makes. In this
architecture almost everything happens server-to-server, where CORS doesn't
exist:

| Traffic                          | Where it runs               | Cross-domain issue?          |
| -------------------------------- | --------------------------- | ---------------------------- |
| Page content                     | Build time (SSG) / server (SSR) | None — server-to-server  |
| Images                           | Browser `<img>` embed       | Needs CORP `cross-origin` (fixed) — not CORS |
| Form submit, live search         | Browser `fetch()`           | Needs CORS (enabled, tokenless public surfaces only) |
| Admin SPA                        | Same origin / dev proxy     | None                         |

So "sites hosted elsewhere like Cloudflare Pages" is not fighting the
architecture — it *is* the architecture. The two real blockers were bugs, both
fixed in this change: helmet's blanket `Cross-Origin-Resource-Policy:
same-origin` broke media embeds everywhere, and CORS was never enabled for the
public surfaces.

For the rare site that wants zero browser→CMS traffic at all, a 20-line
Cloudflare Worker on the site's own domain can proxy `/api/*` → the CMS and
cache at the edge. Optional, per-site, no CMS changes.

## Delivery modes (pick per site)

1. **SSG — the default.** Astro/Eleventy/Next-export site, built from the
   delivery API, deployed on CF Pages. `content.afterPublish` → mk-cms webhook →
   CF Pages deploy hook → live in ~1–2 min. Zero runtime dependency on the CMS
   (it can be *down* and every site stays up), perfect Core Web Vitals, ~zero
   hosting cost. Right for brochure sites, blogs, restaurant menus — the
   Rozpędzeni-style client base.

2. **SSR / ISR — for big or fast-moving sites.** Next/Nuxt/Astro-SSR on
   CF/Vercel when full rebuilds get slow (10k+ pages) or content must be live in
   seconds. Fetches are still server-side (no CORS); the publish webhook calls
   the framework's revalidate endpoint instead of a full rebuild.

3. **Dynamic islands.** Whatever the mode above, interactive bits (contact form
   → `POST /forms/:slug/submit`, search-as-you-type → `delivery.search`) call
   the API from the browser. This is the only cross-origin surface: CORS is on,
   no cookies are involved, and per-site rate limits/keys are the hardening
   step when it matters.

## Performance plan for the CMS instance

The point of the model: **visitor traffic ≈ 0 on the CMS.** What remains, and
how it scales:

- **Builds** hit the delivery API in bursts. Postgres indexes + DataLoader
  already handle this; if a burst ever hurts, put Cloudflare in front of
  `api.` and add `Cache-Control: s-maxage=60, stale-while-revalidate` to
  delivery responses — correctness is preserved because publishes trigger
  rebuilds anyway. (P2 below.)
- **Media** must not stream through Node in production: set `MEDIA_DRIVER=s3`
  with R2/MinIO and `MEDIA_PUBLIC_URL`/`S3_PUBLIC_URL` on a public CDN domain
  (R2 + Cloudflare = free egress). Stored URLs then bypass the API entirely.
  The local driver stays for dev.
- **Editors** are the only steady runtime load; a single VPS instance covers
  dozens of tenants. Scale-out (more API replicas behind one LB) is only ever
  needed for editor concurrency, not audience size.

## Domains, per tenant

- `www.client-a.com` → CF Pages (the site). The CMS is **not** in this path.
- `api.<your-domain>` → one canonical API host for every tenant; the `x-site`
  header (or Host, for direct-domain setups) picks the tenant. `site.domains`
  already resolves this.
- `media.<your-domain>` (or the R2 public URL) → media objects, immutable.
- **Sitemap/robots/redirects live on the site's domain**, so materialise them
  at build time: fetch `/seo/sitemap.xml` + `delivery.redirect` data during the
  build and emit `sitemap.xml`, `robots.txt`, and CF Pages `_redirects`. The
  CMS endpoints stay as the source of truth.

## What already exists vs. what's missing

Enablers already shipped: delivery GraphQL (published-only), preview tokens,
HMAC-signed webhooks with retry, sitemap/robots, redirects with hit counts,
full-text search, forms + notifications, media variants, per-site domains.

Gaps, in priority order:

- **P1 — `mk-site-starter` template repo.** Astro starter wired to the delivery
  API: typed client, per-content-type pages, media helper (variant `srcset`),
  build-time sitemap/robots/`_redirects`, draft preview route using
  `previewToken`, deploy-hook setup doc. This one repo *is* the "mechanism to
  host sites" — every new client site is `degit mk-site-starter` + two env vars.
- **P1 — webhook → deploy-hook recipe** documented per host (CF Pages, Vercel):
  create webhook on `content.published` pointing at the deploy-hook URL. Works
  today with zero code.
- **P2 — cacheable delivery + purge.** Accept GET for whitelisted delivery
  queries (or a small REST mirror), set `s-maxage` + `stale-while-revalidate`,
  put Cloudflare in front. Only needed when builds/SSR traffic actually shows
  up in metrics.
- **P2 — per-site delivery keys + rate limiting.** Content is public, but keys
  give quotas, abuse control and per-site analytics. Tighten CORS to
  `site.domains` at the same time.
- **P2 — webhook payloads with changed URLs** (via `seoUrlPattern`) so ISR
  sites can revalidate exactly one path.
- **P3 — managed rendering tier (`mk-host`), only if customers pay for it.** A
  *separate* multi-tenant SSR service (Host → site → render from delivery API,
  Redis page cache, Cloudflare for SaaS for customer domains/TLS). It's just
  another API consumer, so the headless core stays intact. Don't build it
  speculatively — mode 1 covers the current business.

## Business framing

- **Agency mode (today):** starter template + CF Pages ⇒ ~zero marginal
  infra cost per client site; one VPS runs the CMS for all of them; you charge
  for the site build and a maintenance retainer. Fast to deliver, cheap to run,
  and client sites are independent artifacts you can hand over if ever needed.
- **Product mode (later):** the same platform sells as tiers — DIY headless
  (API access, bring your own front-end), template tier (starter + rebuild
  webhooks preconfigured), and managed tier (`mk-host`, custom domains, "we run
  everything"). Each tier maps to a P1→P3 item above, so the roadmap and the
  pricing ladder are the same list.
