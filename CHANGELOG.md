# nexus-portal

## 1.0.0

First stable release. The portal is the operator UI for a Nexus
platform install: hosts, gates, remotes, catalog, protection, config,
logs, system, users — every entity the registry stores is editable
from this UI.

### Highlights

- Angular 19 standalone application + Node 22 + Fastify BFF, both in
  the same Docker image. Listens on `:8669`.
- Multi-database BFF: SQLite by default, switch to PostgreSQL,
  MySQL, or MariaDB by setting `DATABASE_URL`.
- Two built-in roles (admin, developer) backed by a `roles` table so
  adding a third role is a data change, not a schema migration.
- Sortable Component Catalog table view aggregating `catalog.json`
  from every registered remote, with per-entry detail page showing
  copy-able snippets in Angular, Vue, and React plus a live preview.
- Hot-config inline editors for every gateway protection setting,
  registry rate limits, WebSocket reconnect policy, and circuit
  breaker.
- Real-time updates over the registry WebSocket — a deploy that
  registers a remote shows up in an open portal session within
  milliseconds.
- Dark and light theme matching the docs site.

### Fixes

- (G-4) `Dockerfile` no longer declares a SQLite `VOLUME` (caused
  ghost volumes when using Postgres).
- (G-7) `package-lock.json` is now committed (was gitignored by
  accident).

### License

Relicensed from MIT to GNU Affero General Public License v3.0 or any
later version (AGPL-3.0-or-later). Commercial license: svp@bimo.dk.
