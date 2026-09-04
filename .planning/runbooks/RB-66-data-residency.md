# RB-66 — Board data residency (Canada / US)

**Requirement:** REB-3 §3.7(a)/(b) — any intermediary storage of board data
(the database, and any parallel server or photo storage) must be located in
**Canada or the United States**, on infrastructure owned by a company
**headquartered in North America**. Expected to be examined in the Board's
compliance / security review (REB-3 §3.11(c)).

**Status:** platform standardises on **US regions** (`us-west-2` for AWS). No
Canadian-region migration — REB-3 is satisfied by either country, and the
compute host (Render) has no Canadian region. The `.ca` domain / Quebec
Law 25 question is a *separate* legal-review thread, not this ticket.

---

## 1. Where board data lives

"Board data" = anything sourced from a real estate board's feed: `estates`,
`listing_details` (including `raw_payload`), `board_members`, and the Solid
Queue job arguments that carry board/estate IDs.

| Store | Contains board data? | Region | NA-HQ ownership | How it's pinned |
|---|---|---|---|---|
| **PostgreSQL (Neon)** | **Yes** — the primary store | `us-west-2` (dev `.env` confirmed; **prod to be confirmed — see §3**) | Neon Inc., San Francisco, CA, USA | `DATABASE_URL` (Render env). Boot check: **report-only** |
| **Listing photos** | No — **not stored**. Referenced directly from the board/CDN `MediaURL` per RB-59 (`ResoMediaService` binary-download/S3 path was retired). Nothing to region-pin. | n/a | n/a | Design guarantee (RB-59) |
| **AWS S3** | No — holds only brokerage branding (logos/favicons) and user-uploaded estate documents. No board-sourced data is written to S3. | `us-west-2` (confirmed) | Amazon.com Inc., Seattle, WA, USA | Explicit `region:` in `S3UploadService` + `config/storage.yml`. Boot check: **hard raise** |
| **Solid Queue / Solid Cache** | Indirectly — job args + rack-attack counters | Same connection as the primary DB (no separate `database:` in `config/queue.yml`; `cache_store = :solid_cache_store`) | Covered by the Neon row above | Covered by the `DATABASE_URL` check |
| **Redis (Action Cable)** | No — pub/sub only, nothing persisted | **To be confirmed — see §3** | Depends on provider (Render Key Value / Upstash) | `REDIS_URL` (Render env). Boot check: **report-only** |
| **Render.com** (web + worker compute) | Transient only (in-process) | **To be confirmed — see §3** | Render Services Inc., San Francisco, CA, USA | Dashboard setting; not visible to code |
| **ActiveStorage** | No | Prod uses `service: :local` (ephemeral container disk); the `amazon` service is inert in prod | — | `config/storage.yml` `amazon.region` pinned anyway |
| **Error tracking / APM** | — | None installed — no Sentry/Honeybadger/Datadog/etc. gem. Logs go to Render's log stream only. | — | n/a |

---

## 2. Code guardrail

`config/initializers/data_residency.rb` runs on every **production** boot
(skipped in dev/test and during image build; `SKIP_DATA_RESIDENCY_CHECK=true`
is an emergency override). Logic lives in `lib/data_residency.rb`
(`DataResidency` — allowlist + host/region classification, unit-tested in
`test/lib/data_residency_test.rb`).

| Signal | Source | Mode | Why |
|---|---|---|---|
| AWS region | `credentials.aws.region` | **hard `raise`** | Value (`us-west-2`) is confirmed and in-allowlist, so this can only fire on a future misconfiguration |
| `DATABASE_URL` host region | env | **report-only** (`[DATA-RESIDENCY]` log line) | Prod value not yet confirmed against the allowlist; a blind hard raise could brick a compliant deploy |
| `REDIS_URL` host region | env | **report-only** | Render internal Redis hostnames carry no region token; no board data at rest |

Allowlist: all US + Canadian AWS regions
(`DataResidency::ALLOWED_AWS_REGIONS`) and the corresponding host-region
tokens. A hostname with **no** recognisable region token classifies as
`:indeterminate` — logged for manual follow-up, never a boot failure.

---

## 3. Open items — confirm in the dashboards, then tighten

- [ ] **Prod `DATABASE_URL` region** — read the host from the Render service's
  environment. Confirm it resolves to a US/CA Neon region. Then flip the
  Postgres check in `config/initializers/data_residency.rb` from report-only
  to a hard `raise` (move the `report_only <<` line to `hard_failures <<`).
- [ ] **`REDIS_URL` region** — identify the provider (Render Key Value vs
  Upstash) and its region. If it exposes a region-bearing hostname, add the
  token to the allowlist and promote the check to hard. If not (Render
  internal hostname), record the region here from the dashboard and leave the
  check report-only with a comment pointing at this line.
- [ ] **Render service region** (web + background worker) — record it here
  (e.g. Oregon / Ohio / Virginia). Not code-enforceable; this doc is the
  audit record.
- [ ] **Neon project** — confirm the production Neon project (not just the dev
  branch) is in a US region, and that PITR/backups do not replicate to a
  non-NA region.
- [ ] **S3 bucket region** — confirm the actual bucket was created in
  `us-west-2` (a bucket's region is fixed at creation; the client `region:`
  only needs to match for routing). Confirm no cross-region replication rule
  targets a non-NA region.

Once every box is ticked, update the table in §1 (replace "to be confirmed")
and this section can be deleted.

---

## 4. Ownership basis (for the audit narrative)

- **Neon** — Neon Inc., headquartered in San Francisco, California, USA.
- **AWS** — Amazon Web Services, a subsidiary of Amazon.com Inc.,
  headquartered in Seattle, Washington, USA. S3 `us-west-2` is Oregon, USA.
- **Render** — Render Services Inc., headquartered in San Francisco,
  California, USA.

All three are North-America-headquartered, satisfying REB-3 §3.7(b)'s
ownership condition in addition to the physical-location condition.
