# Phase 1: Security Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30 (updated 2026-05-01, updated 2026-04-30)
**Phase:** 1-security-foundation
**Areas discussed:** CORS in dev, Rate limit store, 403 interceptor logic, DEBT-04 scope, RBAC pattern (user-initiated follow-up), 429 response body, DomainsController auth level, Admin::BaseController scope, InvitationsController exceptions, Rack::Attack IP key, solid_cache setup mechanics, Pagination concern cleanup scope

---

## CORS in Dev

| Option | Description | Selected |
|--------|-------------|----------|
| Skip in dev | Allow all origins in development; enforce only in production | |
| Seed a localhost domain | Add BrokerageDomain seed record for localhost; proc works uniformly | ✓ |
| Allow pattern in proc | Hardcode localhost:* patterns inside the proc | |

**User's choice:** Seed a localhost domain

**Host value for seed record:**

| Option | Description | Selected |
|--------|-------------|----------|
| localhost only | Strip scheme and port before matching; works for any dev port | ✓ |
| localhost:3000 exact | Match origin host+port exactly | |

**User's choice:** `localhost` (scheme/port stripped before matching)

---

## Rate Limit Store

| Option | Description | Selected |
|--------|-------------|----------|
| solid_cache gem | PG-backed Rails.cache; consistent with SolidQueue no-Redis philosophy | ✓ |
| Custom AR counter | ActiveRecord-backed store using a rate_limits table | |
| Memory store (per-worker) | Default; doesn't satisfy cross-worker requirement | |

**User's choice:** solid_cache gem

**Throttle window/count:**

| Option | Description | Selected |
|--------|-------------|----------|
| 5 requests / 20 sec | Tight; stops brute-force; won't affect legitimate users | ✓ |
| 10 requests / 60 sec | More lenient | |
| You decide | Leave to implementer | |

**User's choice:** 5 requests / 20 sec on `POST /v1/sessions`, keyed by IP

---

## 403 Interceptor Logic

| Option | Description | Selected |
|--------|-------------|----------|
| Check response body | `next_step === 'no-access'` → brokerage-contact; otherwise → dashboard + toast | ✓ |
| Check error code field | `error?.code === 'forbidden'` → dashboard + toast | |
| You decide | Leave to implementer | |

**User's choice:** Check response body (presence/absence of `next_step: 'no-access'`)

**Toast message:**

| Option | Description | Selected |
|--------|-------------|----------|
| "Access denied" | Short, standard SaaS language | |
| "You don't have permission to do that" | More conversational | ✓ |
| You decide | Leave to implementer | |

**User's choice:** "You don't have permission to do that"

---

## DEBT-04 Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Price only | Switch to price_numeric; no strata_fees_numeric migration | ✓ |
| Include strata_fees_numeric | Add migration + update both columns | |

**User's choice:** Price only — strata_fees deferred

---

## RBAC Pattern (User Follow-up)

**User question:** Does the chosen pattern support restricting specific admin functionality to owner-only (e.g., brokerage-wide settings)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add require_owner! too | Both methods on Admin::BaseController | ✓ |
| Flat require_admin! only | Defer owner-only restrictions to a future phase | |
| Generic require_role!(*roles) | Flexible but less semantic | |

**User's choice:** Add `require_owner!` alongside `require_admin!`

**Which endpoints get require_owner! now:**

| Option | Description | Selected |
|--------|-------------|----------|
| None yet — just add the method | Apply to existing endpoints in a future phase | |
| BrokeragesController endpoints | update, destroy on brokerages_controller use require_owner! | ✓ |

**User's choice:** `BrokeragesController` (update, destroy)

**Base controller structure:**

| Option | Description | Selected |
|--------|-------------|----------|
| New Admin::BaseController | Dedicated base at v1/admin/base_controller.rb | ✓ |
| Add to ApplicationController | Less encapsulation; no new class | |

**User's choice:** New `Admin::BaseController`

---

## Claude's Discretion

All remaining requirements (SEC-02, SEC-05, SEC-06, SEC-07, PERF-01, PERF-02, PERF-03, DEBT-01, DEBT-02, DEBT-03, DEBT-05, DEBT-06, DEBT-07) have unambiguous implementations per REQUIREMENTS.md. Claude implements as documented without further input.

---

---

## 429 Response Body (Update Session)

| Option | Description | Selected |
|--------|-------------|----------|
| JSON envelope | `{ error: { code: "rate_limited", message: "..." } }` with Content-Type: application/json | ✓ |
| Plain text default | Rack::Attack default "Throttled" | |

**User's choice:** JSON envelope

**Frontend handling:**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline form error | Sign-in component catches 429 and shows inline message | ✓ |
| Global toast via interceptor | Axios interceptor handles all 429s | |

**User's choice:** Inline form error — Axios interceptor unchanged

---

## DomainsController Auth Level (Update Session)

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-only | require_owner! — same level as BrokeragesController | ✓ |
| Admin-accessible | require_admin! (default) | |

**User's choice:** Owner-only — domain config is brokerage structural config

---

## Admin::BaseController Scope (Update Session)

| Option | Description | Selected |
|--------|-------------|----------|
| All 13 controllers | Top-level (9) + v1/admin/group/ (4) | ✓ |
| Top-level only (9) | Skip the 4 group-nested controllers | |

**User's choice:** All 13 — no gaps in enforcement

---

---

## InvitationsController Exceptions (Update Session 2026-05-01)

**Finding:** `accept_invitation`, `decline_invitation`, and `validate_token` are called by invitees before they have a brokerage membership. If `Admin::BaseController` applies `require_admin!` to all actions, these three would receive 403 — breaking invitation acceptance entirely.

| Option | Description | Selected |
|--------|-------------|----------|
| Skip all 3 (accept, decline, validate_token) | validate_token is public; accept+decline are pre-membership | ✓ |
| Skip only accept + decline | validate_token would gain require_admin! accidentally — breaks anonymous invitees | |
| Move to a separate controller | Extract to V1::InviteeActionsController; cleaner but more refactoring | |

**User's choice:** Skip all 3 with `skip_before_action :require_admin!, only: [...]`

**validate_token authentication:**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep public (no Cognito auth) | validate_token is called by anonymous invitees from email link | ✓ |
| Require Cognito JWT | Would break anonymous invitee flow | |

**User's choice:** validate_token skips both `require_admin!` and `authenticate_cognito_user!`

**accept_invitation / decline_invitation Cognito auth:**

| Option | Description | Selected |
|--------|-------------|----------|
| Still require JWT | Actions use Current.user to create BrokerageMembership | ✓ |
| Make fully public | Would allow unauthenticated membership creation — security hole | |

**User's choice:** Yes, still require Cognito JWT — only `require_admin!` skipped

---

## Rack::Attack IP Key (Update Session 2026-05-01)

| Option | Description | Selected |
|--------|-------------|----------|
| req.ip (proxy-aware) | Reads X-Forwarded-For; correct when behind Nginx/load balancer | ✓ |
| req.env["REMOTE_ADDR"] | Raw socket IP; if behind proxy, all users share same counter | |

**User's choice:** `req.ip`
**Notes:** User asked for clarification on the issue. Explained that REMOTE_ADDR behind a proxy is the proxy IP — 5 attempts from anyone trips the throttle for all users. `req.ip` reads X-Forwarded-For to get the real client IP.

---

---

## solid_cache Setup Mechanics (Update Session 2026-04-30)

**Context:** D-07 captured the intent (add gem + configure Rails.cache) but not the setup path. solid_cache requires a migration to create its backing table, same as solid_queue.

| Option | Description | Selected |
|--------|-------------|----------|
| rails solid_cache:install:migrations | Gem installer generates migration automatically; same pattern as solid_queue | ✓ |
| Manual migration | Write create_solid_cache_entries by hand | |

**User's choice:** `rails solid_cache:install:migrations` then `rails db:migrate`

---

## Pagination Concern Cleanup Scope (Update Session 2026-04-30)

**Finding:** DEBT-07 requirement says "remove unused paginate lambda." Code audit confirmed that all 5 methods in the Pagination concern (`per_page`, `page_no`, `paginate_offset`, `default_per_page`, `paginate`) are unused — every controller computes per_page inline.

| Option | Description | Selected |
|--------|-------------|----------|
| Lambda only | Remove just the `paginate` lambda as specified | |
| Entire concern | Remove Pagination concern + include from ApplicationController | ✓ |

**User's choice:** Remove the entire Pagination concern

---

## ESLint no-console Rule (Update Session 2026-05-01)

| Option | Description | Selected |
|--------|-------------|----------|
| error (CI-breaking) | Fails CI on any console.log in production source | ✓ |
| warn (non-blocking) | Flags but doesn't fail CI | |

**User's choice:** `"error"` severity

| Option | Description | Selected |
|--------|-------------|----------|
| Block only console.log | `{ allow: ["warn", "error"] }` | ✓ |
| Block all console methods | No allow list | |

**User's choice:** `{ allow: ["warn", "error"] }` — debug noise blocked, deliberate error reporting allowed

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude test files | Override for *.test.* / *.spec.* | ✓ |
| Apply everywhere | Strictest consistency | |

**User's choice:** Exclude test files via ESLint override

---

## solid_cache Database Isolation (Update Session 2026-05-01)

**Context:** solid_cache in Phase 1 is only used for Rack::Attack shared counters across Puma workers.

| Option | Description | Selected |
|--------|-------------|----------|
| Same DB as app | Tables in main schema; no extra database.yml | ✓ |
| Separate cache database | Isolated; more config; can wipe independently | |

**User's choice:** Same PostgreSQL database — consistent with SolidQueue; no ops overhead

---

## CORS Origin in Dev — gregoryrealtor.realstate.local (Update Session 2026-05-01)

**Finding:** User has a hosts file redirect pointing `gregoryrealtor.realstate.local` to 127.0.0.1 for local brokerage management testing. Browser sends `Origin: http://gregoryrealtor.realstate.local:3000`. After port stripping the proc checks `BrokerageDomain.exists?(host: 'gregoryrealtor.realstate.local')`.

**Problem:** After `db:reset + db:seed`, this domain record doesn't exist — user recreates it manually. Phase 1 CORS proc would make this worse (currently wildcard passes everything).

| Option | Description | Selected |
|--------|-------------|----------|
| Add to dev seeds | Seed creates BrokerageDomain on existing test brokerage | ✓ |
| Keep recreating manually | No seed change; user runs wizard or inserts manually | |

**User's choice:** Add to dev seeds (D-06 updated)

| Option | Description | Selected |
|--------|-------------|----------|
| Domain on existing seeded brokerage | One extra seed row; simplest | ✓ |
| Dedicated 'Gregory Realtor' brokerage | More realistic isolation | |

**User's choice:** Domain on existing seeded test brokerage

---

## Deferred Ideas

- `strata_fees_numeric` migration — excluded from DEBT-04; noted for a future tech debt phase
- Owner-only guards beyond BrokeragesController and DomainsController — `require_owner!` ready but not applied until those controllers are built
