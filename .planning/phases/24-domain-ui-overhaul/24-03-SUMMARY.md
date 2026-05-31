---
phase: 24-domain-ui-overhaul
plan: "03"
subsystem: frontend-domains
tags: [domains, ui, components, card, wizard, rbac, tooltip, typescript]
dependency_graph:
  requires:
    - DomainStatus union with pending/frozen (Plan 24-02)
    - BrokerageDomain interface with lastCheckedAt/consecutiveFailures/verified (Plan 24-02)
    - shadcn Tooltip component (Plan 24-02)
    - Can RBAC guard (existing)
  provides:
    - DomainCard (status-variant: active, pending, phasing_out, frozen, subdomain)
    - DomainCardList (subdomain-first sort, gated Add button, TooltipProvider, empty state)
    - AddDomainWizard (4-step dialog with conditional step 3 and CNAME display)
  affects:
    - frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx
    - frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx
    - frontend/src/components/view/admin/domainsAdminView/AddDomainWizard.tsx
tech_stack:
  added: []
  patterns:
    - "STATUS_ORDER record for sort: subdomain-first then active/pending/phasing_out/frozen/decommissioned"
    - "Role-gating via Can component: manage_brokerage_settings (owner) / access_admin_panel (owner+admin)"
    - "Verify spinner driven by actions.verifyingDomainId comparison — no hook inside card"
    - "Wizard state reset via handleOpenChange wrapper"
    - "DADD-02 conditional step 3 with skip-logic navigation"
key_files:
  created:
    - frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx
    - frontend/src/components/view/admin/domainsAdminView/AddDomainWizard.tsx
  modified:
    - frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx
decisions:
  - "DomainCard drives verify spinner from actions.verifyingDomainId === domain.id; does not call useVerifyDomain (Component -> Context -> Hook pattern)"
  - "onDelete prop on DomainCardList defaults to no-op; dialogs owned by Plan 04"
  - "wizard totalVisibleSteps is 3 when step 3 skipped; visualStep remaps step 4 -> dot 3 for correct dot display"
  - "Frozen Upgrade plan CTA navigates window.location.href = /admin/plan (no mutation)"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-31T06:11:00Z"
  tasks_completed: 3
  files_changed: 3
---

# Phase 24 Plan 03: Domain UI Components Summary

**One-liner:** Built status-variant DomainCard with five distinct layouts, DomainCardList with STATUS_ORDER sort and gated Add button, and a 4-step AddDomainWizard with conditional primary-preference step and live CNAME display.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build status-variant DomainCard | bc2e252 | DomainCard.tsx |
| 2 | Build DomainCardList with sort and gated Add button | b2ab1d4 | DomainCardList.tsx |
| 3 | Build 4-step AddDomainWizard dialog | e6e64f2 | AddDomainWizard.tsx |

## What Was Built

### Task 1: DomainCard (replaced)

- **Five status variants** with dedicated copy per UI-SPEC Copywriting Contract:
  - subdomain: Lock tooltip "This domain is permanent and was assigned at registration." + "Your permanent brokerage subdomain."
  - active custom: "Verified and serving traffic." + last-checked meta via dayjs.fromNow()
  - pending: "Waiting for DNS verification..." + last-checked meta + "Unverified domains are removed after 7 days."
  - phasing_out: "DNS check failed..." + decommission countdown via formatCountdown + last-checked meta
  - frozen: "This domain is inactive due to your current plan." + Upgrade plan CTA (no mutation)
- **Badge color map** exactly per UI-SPEC: emerald (active), amber (phasing_out), blue-500/10 (pending), slate-500/10 (frozen), sky-500/10 (primary), purple-500/10 (custom type), secondary (subdomain type)
- **Failure reason**: `domain.consecutiveFailures > 0` renders `text-xs text-destructive "CNAME record not detected."`
- **Role-gating**: Verify now behind `access_admin_panel`; Set as primary / Delete behind `manage_brokerage_settings`; Frozen Upgrade plan behind `access_admin_panel`
- **Verify spinner**: computed as `actions.verifyingDomainId === domain.id` — no hook call inside card; CLAUDE.md Component → Context data flow preserved
- `dayjs.extend(relativeTime)` at file top (mirrors CommentFeedRow pattern)

### Task 2: DomainCardList (new file)

- **STATUS_ORDER**: `{ active: 0, pending: 1, phasing_out: 2, frozen: 3, decommissioned: 4 }` with subdomain always first
- **TooltipProvider** mounted once around entire list (not per-card) — enables lock icon tooltip
- **Add domain** button with Plus icon gated `manage_brokerage_settings`; opens `AddDomainWizard` via local `wizardOpen` state
- **Empty state**: "No custom domains yet" + "Add a custom domain to brand your brokerage with your own URL." rendered when no custom domains exist (subdomain always renders)
- `onDelete` prop defaults to no-op; delete dialogs owned by Plan 04 context layer

### Task 3: AddDomainWizard (new file)

- **Step 1** (Enter Domain): domain input with client-side validation — rejects empty, rejects `://` protocol prefix, requires dotted-host pattern; `text-xs text-destructive` error display; "Next: DNS Setup" / "Discard"
- **Step 2** (DNS Instructions): CNAME block `bg-muted rounded-md p-3` showing Type/Name/Value rows; `cnameTarget` derived from active subdomain domain; Copy button with 2-second "Copied!" feedback; "Next: Primary" or "Next: Confirm" depending on `hasOtherActiveDomain`
- **Step 3** (Primary Preference — conditional): `hasOtherActiveDomain` gate per DADD-02; two selectable bordered option cards with ring-2 ring-primary selection state; "Next: Confirm"
- **Step 4** (Confirm): title "Ready to add {domain}?"; summary bullets; conditional "Once verified, this domain will become your primary." bullet; Loader2 spinner while submitting; handleSubmit awaits `onAdd()` then closes
- **State reset** in `handleOpenChange` wrapper: step/domain/setPrimaryOnVerify/submitting all return to defaults
- **setPrimaryOnVerify default**: `useEffect` on open sets `!hasOtherActiveDomain` (true when no other active custom domain — first custom domain auto-becomes primary)
- **Step dot indicator**: active (bg-primary) / completed (bg-primary/40) / upcoming (border border-border); dot count is 3 when step 3 skipped, 4 otherwise

## Verification Results

```
Task 1: all 9 grep checks passed — tooltip copy, Verify now, frozen copy, Upgrade plan,
        consecutiveFailures, access_admin_panel, manage_brokerage_settings, verifyingDomainId,
        no useVerifyDomain import — OK
Task 2: all 6 grep checks passed — STATUS_ORDER, TooltipProvider, Add domain,
        manage_brokerage_settings, No custom domains yet, AddDomainWizard — OK
Task 3: all 7 grep checks + tsc 0 errors in target files — OK
tsc --noEmit: 0 errors in DomainCard.tsx, DomainCardList.tsx, AddDomainWizard.tsx — OK
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All data flows through the `actions` prop object from context (Plan 04). The `onDelete` no-op default in DomainCardList is intentional — Plan 04 will wire the delete dialogs and pass the handler.

## Threat Flags

No new security surface beyond the plan's threat model:
- T-24-08: client-side Can gating is UX-only; backend enforces require_owner!/require_admin! independently
- T-24-09: wizard step 1 rejects `://` and requires dotted-host pattern client-side; backend re-validates
- T-24-10: frozen Upgrade plan navigates to `/admin/plan` — in-app route, already auth-gated

## Self-Check: PASSED

- `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` exists — FOUND
- `frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx` exists — FOUND
- `frontend/src/components/view/admin/domainsAdminView/AddDomainWizard.tsx` exists — FOUND
- Commit bc2e252 (DomainCard) — FOUND
- Commit b2ab1d4 (DomainCardList) — FOUND
- Commit e6e64f2 (AddDomainWizard) — FOUND
