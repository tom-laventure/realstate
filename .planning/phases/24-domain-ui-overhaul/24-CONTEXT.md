# Phase 24: Domain UI Overhaul - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 24 delivers a complete overhaul of the Domains admin page. The Phase 21 split-section layout (Subdomains / Custom Domains) is replaced with a single unified vertical card list that surfaces all domain lifecycle states (pending, active, phasing-out, frozen, decommissioned), role-gates actions by Owner > Admin > read-only, and provides:
- A 4-step "Add domain" wizard (Modal/Dialog)
- Per-card "Verify now" button on pending and phasing-out domains
- Delete confirmation dialog with primary-replacement selector when deleting the primary domain
- Rescue toast when "Verify now" restores a phasing-out domain to active
- Frozen badge with re-upgrade prompt on frozen custom domain cards

One backend addition is required: `POST /v1/admin/domains/:id/verify` route and controller action (Owner + Admin accessible). The backend index also needs to include frozen domains (currently excluded from the `.routable.or(.status_pending)` scope) so Phase 24 can display frozen cards.

</domain>

<decisions>
## Implementation Decisions

### Wizard (4-step Add Domain)

- **D-01:** Wizard lives in a **Modal/Dialog overlay** (shadcn `Dialog`). Consistent with the existing `RemoveNowDialog` pattern. Card list stays visible behind the overlay. Dismissible with escape/outside click.
- **D-02:** Wizard step state (current step, form values across steps) lives in **local Dialog component state** (`useState` inside the wizard component). State resets on close — correct behavior for a transient add flow. No Redux slice, no context involvement.
- **D-03:** On successful submission: **auto-close dialog + toast** ("Domain added — verification pending"). Card list refetches via `queryClient.invalidateQueries` (domainsKeys.all). Consistent with existing mutation patterns.

### Delete-Primary Flow (DLCX-03, DLCX-04)

- **D-04:** The delete confirmation dialog detects whether the domain is primary. If primary: the dialog renders a **replacement dropdown** (subdomain pre-selected) before the confirm button. The user must select a replacement to enable the confirm button. UI sequences two calls: `set_primary` → `destroy`.
- **D-05:** The replacement dropdown lists **all active non-primary domains**. Subdomain is pre-selected. This handles cases where the owner wants to designate a different active custom domain as primary before deleting.
- **D-06:** Partial failure (set_primary succeeds, destroy fails): **show error toast** ("Domain deletion failed — a new primary was already designated"), do not retry or attempt rollback. Primary change stands. User sees the updated list and can retry delete.
- **D-07:** Non-primary domain deletion dialog: shows decommission date per DLCX-03. No replacement selector needed.

### Card List Refactor

- **D-08:** **Full replacement** of DomainsAdminBoard, DomainsAdminView, SubdomainsSection, CustomDomainList with new unified components. The split-section structure is the wrong shape for the Phase 24 design. No backwards-compat shims or retained dead code.
- **D-09:** **Keep and update** `useDomainsAdminContext` (remove slot-limit state, add new actions) and all TanStack hooks (useFetchDomains, useSetPrimaryDomain, useDecommissionDomain, useAddCustomDomain, useVerifyDomain, useRemoveCustomDomain). The context brain and hook layer are the right shape; only the view components get replaced.
- **D-10:** **Remove** `slotWarning`, `subdomainSlotsBlocked`, `customSlotsBlocked` from `useDomainsAdminContext`. The Phase 21 slot-limit UX is superseded by Phase 24 design.

### Rescue Confirmation (DLCX-02)

- **D-11:** Rescue confirmation **only fires when the user pressed "Verify now"** and the domain status transitions from `phasing_out` → `active` in the verify response. No passive detection on every data load.
- **D-12:** Rescue confirmation is a **toast notification** ("Domain rescued — phase-out has been cancelled"). Consistent with all other mutation outcome communication. No persistent card banner needed.

### Claude's Discretion

- Exact card layout for each status variant (pending card fields, phasing-out fields, frozen badge copy, last-checked timestamp formatting) — implement per REQUIREMENTS.md specs.
- Whether `useVerifyDomain` hook is extended to detect the phasing_out → active transition by comparing pre-mutation domain status, or by inspecting the response domain.status — Claude chooses the cleaner approach.
- New permission constant for domain verification — if needed, add to `permissions.ts`; alternatively, gate the verify button directly on `role === 'owner' || role === 'admin'` since the rule is simple.
- Backend `verify` action implementation: synchronous inline DNS check (mirrors onboarding verify pattern) or async job enqueue. Given existing `useVerifyDomain` hook expects a direct `{ verified: bool }` response and DVER-01 says "triggers an on-demand verification job", run the check synchronously in the controller and return the result immediately (consistent with onboarding verify).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DUIV-01–06, DADD-01–04, DVER-01, DVER-03, DVER-04, DLCX-02, DLCX-03, DLCX-04, DPRI-01, DPRI-02, DPRD-04 (Phase 24 requirements)
- `.planning/ROADMAP.md` §Phase 24 — success criteria (5 items)

### Existing Domain Model & Backend
- `backend/app/models/brokerage_domain.rb` — domain statuses (`active`, `phasing_out`, `frozen`, `pending`, `decommissioned`), `is_primary`, `verified`, `last_checked_at`, `consecutive_failures` fields
- `backend/app/serializers/brokerage_domain_serializer.rb` — serialized fields (all Phase 24 UI needs are already exposed)
- `backend/app/controllers/v1/admin/domains_controller.rb` — existing actions (index, subdomain, custom, destroy, set_primary); where to add `verify` action
- `backend/config/routes.rb` — where to add `member { post :verify }` under admin domains

### Existing Frontend Domain Code
- `frontend/src/assets/types/domainType.ts` — `BrokerageDomain` interface (needs `pending` and `frozen` added to `DomainStatus` union; add `lastCheckedAt`, `consecutiveFailures`, `verified`, `verifiedAt` fields)
- `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts` — context to update (remove slot state, add verify action)
- `frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts` — existing verify hook (extend to detect rescue transition)
- `frontend/src/store/hooks/Admin/Domains/useFetchDomains.ts` — query key ref for cache invalidation
- `frontend/src/components/view/admin/domainsAdminView/RemoveNowDialog.tsx` — dialog pattern to follow for wizard and delete dialogs
- `frontend/src/assets/rbac/permissions.ts` — current permission model; `manage_brokerage_settings` = owner-only; `access_admin_panel` = owner + admin

### Prior Phase Context
- `.planning/phases/22-dns-verification-health-monitoring-backend/22-CONTEXT.md` — Phase 22 decisions (D-08: custom domains created as pending; `consecutive_failures`, `last_checked_at` columns added)
- `.planning/phases/23-301-redirect-primary-domain-enforcement/23-CONTEXT.md` — Phase 23 decisions (middleware, frozen redirect)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useDomainsAdminContext`: Context brain — keep, update. Remove slot-limit state. Add `verify` action wired to `useVerifyDomain`.
- `useFetchDomains`: Query hook — keep as-is. `domainsKeys.all` is the cache key for all domain mutations to invalidate.
- `useVerifyDomain`: Existing hook — extend `onSuccess` to detect phasing_out → active transition (D-11) and fire rescue toast.
- `useSetPrimaryDomain`, `useRemoveCustomDomain`, `useDecommissionDomain`, `useAddCustomDomain`: All keep. No changes needed to hooks — only context and components change.
- `RemoveNowDialog.tsx`: Dialog pattern reference for wizard and delete-confirmation dialogs.
- `Can.tsx` + `permissions.ts`: RBAC guard for role-gating action buttons.

### Established Patterns
- shadcn `Dialog` for overlays; `lucide-react` for icons; Tailwind for styling.
- Context hook returns `{ state, actions }` via `useMemo` — new context shape must follow this.
- `useEffect` with `isHydratedFromUrl` guard for URL param hydration — not applicable here but the pattern exists.
- Toast via `react-hot-toast` for mutation outcomes.
- `queryClient.invalidateQueries({ queryKey: domainsKeys.all })` in `onSuccess` for cache refresh after mutations.

### Integration Points
- **Backend index scope change**: The existing `GET /v1/admin/domains` returns `routable.or(status_pending)` (active + phasing_out + pending). Phase 24 also needs **frozen** domains for DPRD-04 card display. The index scope must be updated to include `status_frozen`.
- **New route + action**: `POST /v1/admin/domains/:id/verify` — accessible to admin and owner (default `require_admin!` from BaseController is correct; do NOT add `require_owner!` for this action).
- **domainType.ts update**: `DomainStatus` union must add `'pending' | 'frozen'`. `BrokerageDomain` interface must add `lastCheckedAt: string | null`, `consecutiveFailures: number`, `verified: boolean`, `verifiedAt: string | null`.

</code_context>

<specifics>
## Specific Ideas

- The CNAME instructions in wizard step 2 (DNS instructions) must show the exact CNAME record — the target is the brokerage's subdomain. Backend should return this in the `custom` action response or it can be derived from the domain list (subdomain domain field).
- The subdomain card must show a lock icon (DUIV-02) — `lucide-react` `Lock` icon with shadcn Tooltip showing "This domain is permanent and was assigned at registration."
- Primary badge (DUIV-03) — small badge component on the primary card. Existing shadcn `Badge` component.
- Frozen badge (DPRD-04) — badge + plain-language explanation ("This domain is inactive due to your current plan") + link/CTA to re-upgrade. No action controls on frozen cards.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 24-Domain-UI-Overhaul*
*Context gathered: 2026-05-30*
