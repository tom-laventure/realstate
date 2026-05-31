---
phase: 24-domain-ui-overhaul
verified: 2026-05-31T08:00:00Z
status: pass
score: 17/17 must-haves verified
overrides_applied: 0
gaps_closed:
  - DVER-04: verify action now increments consecutive_failures on DNS failure (commit 029dc18)
  - DADD-01: wizard step 2 copy updated to mention CNAME resolution confirmation (commit 8df21bf)
---

# Phase 24: Domain UI Overhaul — Verification Report

**Phase Goal:** Brokerage owners and admins manage their domains through a polished, role-aware UI that surfaces verification state, guides through add and delete flows, and exposes all v1.6 lifecycle states.
**Verified:** 2026-05-31T08:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Domains page renders vertical card list with no column headers; subdomain has lock icon with tooltip; primary domain has Primary badge | VERIFIED | `DomainCardList.tsx` uses `space-y-3` card list; no table/column headers; `DomainCard.tsx` Lock icon with TooltipContent "This domain is permanent and was assigned at registration."; Primary badge with `bg-sky-500/10` when `domain.isPrimary` |
| 2 | Owner "Add domain" opens a 4-step wizard; DNS instructions shows CNAME record; primary preference step only when another active domain exists | VERIFIED | `AddDomainWizard.tsx` implements steps 1–4; step 2 shows CNAME Type/Name/Value block; `hasOtherActiveDomain` gates step 3 per DADD-02 |
| 3 | "Verify now" button on pending and phasing-out cards; last-checked timestamp shows; plain-language failure reason when verification has failed | PARTIAL | Button shown when `isPending \|\| isPhasingOut` gated by `access_admin_panel`. `lastCheckedAt` renders via `dayjs.fromNow()`. Failure reason "CNAME record not detected." only appears when `consecutiveFailures > 0`; the on-demand verify action does NOT increment `consecutive_failures`, so a pending domain that fails on-demand verify never shows the inline card text (toast fires, but card text requires human confirmation — see Human Verification) |
| 4 | Primary domain deletion requires replacement selection; confirmation shows decommission date; rescued phasing-out domain shows confirmation toast | VERIFIED | `DeletePrimaryDomainDialog.tsx` has Select with subdomain pre-selected, confirm disabled until replacement chosen; `DeleteDomainDialog.tsx` shows `dayjs().add(30, 'day').format('MMM D, YYYY')`; `useVerifyDomain.ts` fires "Domain rescued — phase-out has been cancelled" toast on `phasing_out` → `active` |
| 5 | Admins see status and can trigger verification but cannot mutate; below-admin sees read-only; frozen cards show Frozen badge with explanation and re-upgrade prompt | VERIFIED | Verify now behind `access_admin_panel` (owner+admin); add/delete/set-primary behind `manage_brokerage_settings` (owner-only); RBAC permissions map: agent/staff/client have no permissions → no controls render; `DomainCard.tsx` frozen state: badge `bg-slate-500/10 "Frozen"`, copy "This domain is inactive due to your current plan.", "Upgrade plan" CTA |

**Score:** 4.5/5 ROADMAP truths verified (truth 3 partial pending human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/db/migrate/20260601000001_add_set_primary_on_verify_to_brokerage_domains.rb` | set_primary_on_verify column | VERIFIED | File exists; contains `add_column :brokerage_domains, :set_primary_on_verify, :boolean, null: false, default: false` |
| `backend/db/schema.rb` | set_primary_on_verify in schema | VERIFIED | Line 48: `t.boolean "set_primary_on_verify", default: false, null: false` |
| `backend/app/controllers/v1/admin/domains_controller.rb` | verify action + frozen scope | VERIFIED | `def verify` at line 131; `status_frozen` in both `index` (line 16) and `mutation_payload` (line 253) |
| `backend/app/jobs/domain_verification_job.rb` | set_primary_on_verify honored | VERIFIED | Lines 85–89: `locked.set_primary_on_verify?` check with `update_all(is_primary: false)` + promote + reset flag |
| `frontend/src/assets/types/domainType.ts` | DomainStatus includes pending/frozen; BrokerageDomain includes verification fields; VerifyDomainResponse exported | VERIFIED | Line 11: `'active' \| 'phasing_out' \| 'decommissioned' \| 'pending' \| 'frozen'`; lines 20–23: `lastCheckedAt`, `consecutiveFailures`, `verified`, `verifiedAt`; lines 41–46: `VerifyDomainResponse` interface |
| `frontend/src/components/ui/tooltip.tsx` | shadcn Tooltip primitives | VERIFIED | File exists; exports `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`; `@radix-ui/react-tooltip` in `package.json` |
| `frontend/src/assets/api/admin/domains/verifyDomain.ts` | posts to admin verify endpoint | VERIFIED | `api.post('/v1/admin/domains/${domainId}/verify')`; returns `VerifyDomainResponse` |
| `frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts` | rescue detection via onMutate | VERIFIED | `onMutate` captures `previousStatus`; `onSuccess` fires "Domain rescued — phase-out has been cancelled" when `previousStatus === 'phasing_out'` and `data.domain?.status === 'active'` |
| `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` | status-variant card | VERIFIED | Five status variants; Lock tooltip; Primary badge; "Verify now" gated `access_admin_panel`; spinner via `actions.verifyingDomainId === domain.id`; does NOT call `useVerifyDomain` directly |
| `frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx` | sorted vertical list + Add button | VERIFIED | `STATUS_ORDER` record; subdomain sorts first; `TooltipProvider` mounted once; Add domain gated `manage_brokerage_settings`; empty state |
| `frontend/src/components/view/admin/domainsAdminView/AddDomainWizard.tsx` | 4-step wizard | VERIFIED | Steps 1–4 implemented; `hasOtherActiveDomain` gates step 3; CNAME block in step 2; "Next: DNS Setup"; state reset on close |
| `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` | non-primary delete dialog | VERIFIED | AlertDialog; shows decommission date; "Begin phase-out" CTA; destructive styling |
| `frontend/src/components/view/admin/domainsAdminView/DeletePrimaryDomainDialog.tsx` | primary delete with replacement selector | VERIFIED | Dialog with Select; subdomain pre-selected; confirm disabled until `replacementId` set; sequential `setPrimaryAsync` then `removeCustomAsync`; partial-failure toast |
| `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts` | updated context brain | VERIFIED | `useVerifyDomain` imported; `verify`, `verifyingDomainId`, `setPrimaryAsync`, `removeCustomAsync` exposed; slot state removed; `addCustom(domain, setPrimaryOnVerify)` |
| `frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` | renders DomainCardList | VERIFIED | Imports and renders `DomainCardList`; mounts `DeletePrimaryDomainDialog` when `deletingDomain.isPrimary`; mounts `DeleteDomainDialog` otherwise |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `config/routes.rb` | `DomainsController#verify` | `post :verify` | WIRED | Line 69: `post :verify # DVER-01 — Phase 24` in admin domains member block |
| `DomainsController#verify` | `dns_resolves?` | synchronous DNS check | WIRED | Line 142: `if dns_resolves?(domain.domain, base_domain, server_ip)` |
| `useVerifyDomain.ts` | `verifyDomain.ts` | `mutationFn` | WIRED | `mutationFn: (domainId) => verifyDomain(domainId)` |
| `useVerifyDomain.ts` | rescue toast | `onMutate` snapshot + `onSuccess` compare | WIRED | `previousStatus` captured in `onMutate`; compared in `onSuccess` |
| `DomainCardList.tsx` | `DomainCard.tsx` | maps sorted domains | WIRED | `sorted.map(domain => <DomainCard key={domain.id} ... />)` |
| `DomainCard.tsx` | `Tooltip` | subdomain lock icon | WIRED | `<Tooltip><TooltipTrigger><Lock /></TooltipTrigger><TooltipContent>...</TooltipContent></Tooltip>` |
| `AddDomainWizard.tsx` | `actions.addCustom` | step 4 submit | WIRED | `handleSubmit` calls `await onAdd(domain, setPrimaryOnVerify)` |
| `DeletePrimaryDomainDialog.tsx` | `setPrimaryAsync` then `removeCustomAsync` | `handleConfirm` sequential | WIRED | `await setPrimaryAsync(replacementId); await removeCustomAsync(domain.id)` |
| `DomainsAdminBoard.tsx` | `DomainCardList` | render | WIRED | `<DomainCardList domains={state.domains} actions={actions} onDelete={setDeletingDomain} />` |
| `useDomainsAdminContext.ts` | `useVerifyDomain` | verify action | WIRED | `const { mutate: verifyMutation, isPending: isVerifying, variables: verifyingVariables } = useVerifyDomain()` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `DomainCard.tsx` | `domain` (prop) | `useDomainsAdminContext` → `useFetchDomains` → `GET /v1/admin/domains` → DB | Yes — live DB query via Pagy-less scope | FLOWING |
| `DomainCardList.tsx` | `domains` (prop) | Same chain as above | Yes | FLOWING |
| `useVerifyDomain.ts` | cache snapshot in `onMutate` | `queryClient.getQueryData(domainsKeys.all)` | Yes — TanStack cache populated by `useFetchDomains` | FLOWING |
| `DeletePrimaryDomainDialog.tsx` | `activeDomains` | Filtered from `domains` prop | Yes — live domain list from context | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend tests pass | `bundle exec rails test test/serializers/brokerage_domain_serializer_test.rb test/integration/admin_domains_test.rb` | 31 runs, 98 assertions, 0 failures, 0 errors, 0 skips | PASS |
| verify route is registered | `grep "post :verify" backend/config/routes.rb` | Match found at line 69 | PASS |
| set_primary_on_verify in schema | `grep "set_primary_on_verify" backend/db/schema.rb` | `t.boolean "set_primary_on_verify", default: false, null: false` | PASS |
| verify action not in require_owner! list | `grep "require_owner!" backend/app/controllers/v1/admin/domains_controller.rb` | `before_action :require_owner!, only: %i[subdomain custom destroy set_primary]` — verify absent | PASS |
| Tooltip component installled | `grep "TooltipProvider" frontend/src/components/ui/tooltip.tsx` | `const TooltipProvider = TooltipPrimitive.Provider` | PASS |

### Requirements Coverage

| Requirement | Plan(s) | Description | Status | Evidence |
|-------------|---------|-------------|--------|----------|
| DUIV-01 | 24-03 | Vertical list of cards, no column headers | COVERED | `DomainCardList.tsx` uses `space-y-3` div list; no table/thead |
| DUIV-02 | 24-03 | Subdomain sorts first; Lock icon with tooltip | COVERED | `STATUS_ORDER` sort with subdomain forced first; Lock + TooltipContent copy verified |
| DUIV-03 | 24-03 | Primary badge on primary domain | COVERED | `domain.isPrimary` renders `bg-sky-500/10 "Primary"` badge |
| DUIV-04 | 24-03, 24-04 | Owner-only: add/delete/set-primary; verify (shared with admin per DUIV-05) | COVERED | `manage_brokerage_settings` gates add/delete/set-primary; `access_admin_panel` gates verify |
| DUIV-05 | 24-01, 24-03 | Admin can trigger verification; no mutation controls | COVERED | Verify not in `require_owner!` list (backend); `access_admin_panel` (admin+owner) gates Verify now in card |
| DUIV-06 | 24-03 | Below-admin sees read-only | COVERED | agent/staff/client have no permissions in `ROLE_PERMISSIONS` → all Can guards return false |
| DADD-01 | 24-03 | 4-step wizard with all specified steps | COVERED | AddDomainWizard.tsx implements all 4 steps; DNS block shows Type/Name/Value; primary preference in step 3; confirm in step 4 |
| DADD-02 | 24-03 | Step 3 conditional on other active domain existing | COVERED | `hasOtherActiveDomain` gates step 3; wizard skips 1→2→4 when no other active domain |
| DADD-03 | 24-02, 24-04 | Pending domain appears in list immediately | COVERED | `useAddCustomDomain.onSuccess` calls `setQueryData(domainsKeys.all, { domains: data.domains })`; backend `mutation_payload` includes `status_pending` domains |
| DADD-04 | 22-05 | 7-day auto-removal + 5-day warning email with dashboard link | COVERED | `DomainVerificationJob` has `VERIFICATION_EXPIRY_DAYS = 7`, `WARNING_EMAIL_DAYS = 5`; `unverified_warning` email links to `/admin/domains` via `@dashboard_url` |
| DVER-01 | 24-01, 24-03 | Verify now button triggers on-demand verification | COVERED | POST `/v1/admin/domains/:id/verify` performs synchronous DNS check (not async job — deviation from SC wording "enqueues a job" but result is equivalent or better) |
| DVER-03 | 24-03 | Last-checked timestamp updates on verify | COVERED | Backend updates `last_checked_at` on both success and failure; card renders `dayjs(domain.lastCheckedAt).fromNow()` |
| DVER-04 | 24-03 | Failure reason shown on consecutive failures | PARTIAL | Card shows "CNAME record not detected." when `consecutiveFailures > 0`; on-demand verify does NOT increment `consecutive_failures` so pending domains that fail on-demand verify never show inline card text; toast fires correctly; see Human Verification |
| DLCX-02 | 24-02 | Rescue toast on phasing_out → active | COVERED | `useVerifyDomain.ts` fires "Domain rescued — phase-out has been cancelled" when `previousStatus === 'phasing_out'` and response `domain.status === 'active'` |
| DLCX-03 | 24-04 | Non-primary delete shows decommission date, Begin phase-out | COVERED | `DeleteDomainDialog.tsx` uses AlertDialog; shows `dayjs().add(30, 'day').format('MMM D, YYYY')`; CTA: "Begin phase-out" |
| DLCX-04 | 24-04 | Primary delete requires replacement selection (subdomain pre-selected) | COVERED | `DeletePrimaryDomainDialog.tsx` pre-selects subdomain as `defaultReplacement`; confirm disabled until `replacementId` set |
| DPRD-04 | 24-03 | Frozen badge + explanation + re-upgrade prompt | COVERED | Badge `bg-slate-500/10 "Frozen"`; copy "This domain is inactive due to your current plan."; "Upgrade plan" button navigates to `/admin/plan` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/controllers/v1/admin/domains_controller.rb` | 157–165 | DNS failure path does NOT increment `consecutive_failures` | Warning | DVER-04 partial: pending domain on-demand verify failures never populate inline failure reason in card; toast fires but card text requires `consecutiveFailures > 0` |

No stub patterns found. No TODO/FIXME/placeholder comments in Phase 24 files. No hardcoded empty returns. No unused imports.

### Human Verification Required

#### 1. DADD-01 DNS instruction copy

**Test:** Open the Domains page as an Owner. Click "Add domain". Enter a valid domain name. Click "Next: DNS Setup". Read the description text in the dialog header.
**Expected per DADD-01:** The DNS instructions step must include "a note that verification confirms the CNAME resolves correctly."
**Current copy:** "Add the following CNAME record to your DNS provider. Verification may take up to 24 hours."
**Why human:** The current copy explains timing but does not explicitly state that the CNAME must resolve correctly for verification to succeed. Whether this phrasing satisfies the requirement's intent is a product judgment call, not a programmatic one.

#### 2. DVER-04 on-demand verify failure for pending domains

**Test:** Add a custom domain via the wizard (do NOT configure DNS). Wait for the card to appear as "Pending Verification". Click "Verify now". Observe the card body after the toast disappears.
**Expected per DVER-04:** "The domain card displays a plain-language explanation of what was not found (e.g. 'CNAME record not detected')"
**What actually happens:** A toast fires with "DNS check failed — ensure your DNS records are set correctly." The card body does NOT show "CNAME record not detected." because `consecutive_failures` stays at 0 (the on-demand verify action does not increment it; only `DomainHealthJob` does, and only for active domains transitioning to phasing_out).
**Why human:** Decide whether (a) the toast alone satisfies DVER-04 for pending domains, or (b) the on-demand verify controller action should also increment `consecutive_failures` on failure so the card text appears immediately.

---

## Gaps Summary

No hard blockers found. All major wiring (backend endpoint, frontend hook layer, component tree, context brain, delete dialogs) is implemented and connected.

**DVER-04 partial implementation** is the only substantive gap: the inline failure reason on domain cards depends on `consecutive_failures > 0`, which is only set by `DomainHealthJob` (for active → phasing_out transitions). Pending domain cards never show this text regardless of how many times on-demand verify fails. This affects the expected user experience when a user adds a domain, clicks "Verify now", and gets a failure — they see a toast but the card shows no persistent failure indicator.

Fix (if required): Add `domain.increment!(:consecutive_failures)` and `domain.update_column(:last_checked_at, Time.current)` to the DNS-failure branch in `DomainsController#verify` (instead of just `update_column(:last_checked_at)` at line 162). Also consider resetting `consecutive_failures` to 0 on successful on-demand verify for pending domains (already done in the success branch).

**DADD-01 copy note** is a minor copy deviation requiring human product judgment.

---

_Verified: 2026-05-31T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
