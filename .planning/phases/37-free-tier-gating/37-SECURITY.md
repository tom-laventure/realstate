---
phase: 37
slug: free-tier-gating
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-21
---

# Phase 37 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser/SPA → /v1/admin API | Free-tier admin can craft direct API calls bypassing any hidden frontend UI | Board credentials, board list, invitation payloads |
| Browser/SPA → /v1/account/calendar API | Account-level endpoints resolve `Current.brokerage` from Origin/Host, which is NOT the user's authoritative membership scope | OAuth authorize redirects, CalDAV connect payloads, connection status |
| Browser/SPA → /v1/admin + /v1/dashboard API | Pre-existing boundaries (domain gate, seat adds) verified for absence of unintended restriction | Custom domain config, member invitations |
| N/A (client-only UX layers) | Frontend plan-capability helper, hidden forms/grids, banners — presentational only; authoritative enforcement is server-side | N/A |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-37-01 | Elevation of Privilege | `POST /v1/admin/board_credentials` | mitigate | `board_credentials_controller#create` rejects real-board connects with 403 `plan_required` before RETS auth runs (`plan_config.real_boards \|\| board.is_test_board?`) | closed |
| T-37-02 | Information Disclosure | `GET /v1/admin/boards` | mitigate | `boards_controller#index` narrows list to `RealEstateBoard.test_boards` for any brokerage without `plan_config.real_boards` | closed |
| T-37-03 | Elevation of Privilege | `POST/PATCH /v1/admin/groups/:id/invitations` | mitigate | `create` gate checked as first line, applies regardless of caller role. Code-review finding CR-01 (bypass via `PATCH .../invitations/:id`) fixed in backend commit `9b26118` — `update` now mirrors the same guard keyed off the post-update role | closed |
| T-37-04 | Tampering | invitation `role` param | accept | Pre-existing lack of enum validation on this endpoint; exact-match `== "client"` per D-03; broader role validation out of phase scope | closed |
| T-37-05 | Elevation of Privilege | `google/authorize`, `apple/connect` | mitigate | `User#any_paid_brokerage_membership?` guard, first line of each action, 403 `plan_required` before OAuth/CalDAV flow | closed |
| T-37-06 | Tampering / Elevation of Privilege | Tenant-confused calendar gate | mitigate | Gate queries `Current.user` memberships directly (grep-verified: neither controller references `plan_config.calendar_sync`), never `Current.brokerage.plan_config` — avoids RESEARCH Pitfall 1 | closed |
| T-37-07 | Information Disclosure | `calendar_sync_available` field | accept | Boolean reveals only whether the user has any paid membership — low sensitivity, needed for banner rendering | closed |
| T-37-08 | Elevation of Privilege | `POST /v1/admin/domains/custom` | mitigate | Existing Phase-36 `plan_config.custom_domain` gate; regression tests added asserting 403 holds for Free, absent for paid | closed |
| T-37-09 | Denial of Service | Free-tier member adds | accept | Seats intentionally uncapped on Free (D-10); regression test documents intended absence of any cap | closed |
| T-37-10 | Elevation of Privilege | Frontend plan-capability helper | accept | UX-only; client-state tampering still hits server-side gates in Plans 01–03 | closed |
| T-37-11 | Elevation of Privilege | Hidden client-invite form / hidden real boards | mitigate | Frontend hiding is defense-in-depth over backend 403s (T-37-01, T-37-03) | closed |
| T-37-12 | Elevation of Privilege | Hidden provider grid | mitigate | Frontend hiding is defense-in-depth over backend calendar gate (T-37-05) | closed |
| T-37-13 | Tampering | `calendarSyncAvailable` client value | accept | Original plan accepted fail-open default; code-review finding WR-01 (fail-open contradicted UX intent) fixed in frontend commit `a5a84a9` — default flipped to fail-closed (`false`), so tampering can only ever hide the grid, never grant real access, which the server still gates independently | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-37-04 | Invitation `role` param has no enum validation platform-wide (pre-existing); exact-match check on `"client"` is sufficient for this phase's scope | Plan 01 (D-03) | 2026-07-20 |
| AR-02 | T-37-07 | `calendar_sync_available` boolean discloses only paid-membership status, not calendar contents | Plan 02 | 2026-07-20 |
| AR-03 | T-37-09 | Uncapped seats on Free tier is an intentional product decision (D-10), not a vulnerability | Plan 03 | 2026-07-20 |
| AR-04 | T-37-10 | Frontend plan-capability helper is UX-only; server-side gates are the real boundary (repo convention) | Plan 04 | 2026-07-20 |
| AR-05 | T-37-13 | Client boolean tampering cannot grant real calendar access; server 403 is the actual gate. Now fail-closed by default post-WR-01 fix, strictly better than the original accepted disposition | Plan 06 | 2026-07-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-21 | 13 | 13 | 0 | /gsd:secure-phase (orchestrator, retroactive verification against plan-time register + code-review fix commits `9b26118`/`a5a84a9`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-21
