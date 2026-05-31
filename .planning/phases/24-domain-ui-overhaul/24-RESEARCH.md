# Phase 24: Domain UI Overhaul - Research

**Researched:** 2026-05-30
**Domain:** React SPA (frontend component replacement) + Rails JSON API (one new route + scope update)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Wizard lives in a Modal/Dialog overlay (shadcn `Dialog`). Dismissible with escape/outside click.
- **D-02:** Wizard step state (current step, form values across steps) lives in local Dialog component state (`useState`). Resets on close.
- **D-03:** On successful submission: auto-close dialog + toast ("Domain added — verification pending"). Cache refresh via `queryClient.invalidateQueries({ queryKey: domainsKeys.all })`.
- **D-04:** Delete-primary dialog renders a replacement dropdown before the confirm button. User must select a replacement to enable the confirm button. Two calls: set_primary → destroy.
- **D-05:** Replacement dropdown lists all active non-primary domains. Subdomain pre-selected.
- **D-06:** Partial failure (set_primary succeeds, destroy fails): show error toast ("Domain deletion failed — a new primary was already designated"), do not retry or rollback.
- **D-07:** Non-primary domain deletion dialog: shows decommission date per DLCX-03. No replacement selector.
- **D-08:** Full replacement of DomainsAdminBoard, DomainsAdminView, SubdomainsSection, CustomDomainList. No backwards-compat shims or dead code.
- **D-09:** Keep and update `useDomainsAdminContext` and all TanStack hooks. Context brain and hook layer are the right shape; only view components get replaced.
- **D-10:** Remove `slotWarning`, `subdomainSlotsBlocked`, `customSlotsBlocked` from `useDomainsAdminContext`. Phase 21 slot-limit UX is superseded.
- **D-11:** Rescue confirmation only fires when the user pressed "Verify now" AND domain status transitions from `phasing_out` → `active` in the verify response. No passive detection on every data load.
- **D-12:** Rescue confirmation is a toast notification ("Domain rescued — phase-out has been cancelled").

### Claude's Discretion

- Exact card layout for each status variant (pending card fields, phasing-out fields, frozen badge copy, last-checked timestamp formatting) — implement per REQUIREMENTS.md specs.
- Whether `useVerifyDomain` hook detects phasing_out → active transition by comparing pre-mutation domain status via pre-mutation cache snapshot or response domain.status.
- New permission constant for domain verification — add to permissions.ts if needed; alternatively gate verify button directly on `hasPermission(role, 'access_admin_panel')`.
- Backend `verify` action implementation: synchronous inline DNS check (mirrors onboarding verify pattern). Run check synchronously in the controller and return result immediately.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DUIV-01 | Domain list renders as vertical card list; each card shows domain URL, plain-language status description, relevant dates, and action controls | Full component replacement produces this; card anatomy in UI-SPEC §Card Status Variants |
| DUIV-02 | Subdomain card displays lock icon with tooltip | shadcn Tooltip must be installed (not yet in codebase); `lucide-react` Lock icon available |
| DUIV-03 | Primary badge on the currently designated primary domain | Existing Badge pattern extended; `bg-sky-500/10 text-sky-700 border-sky-500/40` |
| DUIV-04 | Owner-only action controls: add, delete, set primary, verify | `hasPermission(role, 'manage_brokerage_settings')` gates Owner-only; `Can` component available |
| DUIV-05 | Admin can trigger verify and view status; no mutation controls | `hasPermission(role, 'access_admin_panel')` gates Owner + Admin |
| DUIV-06 | Below-admin: read-only, no action controls | Role check falls through — no controls rendered |
| DADD-01 | 4-step wizard: Enter domain → DNS instructions → Primary preference → Confirm | `Dialog` (already installed) + local useState step state (D-02) |
| DADD-02 | Step 3 shown only when another active domain exists; otherwise auto-primary on verify | Requires new `set_primary_on_verify` boolean column + migration + job update |
| DADD-03 | After submission, domain card appears as Pending immediately | Backend custom action returns domain + domains array; hook updates cache |
| DADD-04 | Unverified domains auto-removed after 7 days; warning at day 5 | Already implemented in DomainVerificationJob; UI shows "Unverified domains are removed after 7 days." |
| DVER-01 | "Verify now" button on pending and phasing-out domains | New `POST /v1/admin/domains/:id/verify` route; `useVerifyDomain` hook already exists |
| DVER-03 | Each card shows last-checked timestamp and verification state | `lastCheckedAt` field now serialized; dayjs relativeTime plugin already used in codebase |
| DVER-04 | Verification failure shows plain-language explanation | `consecutiveFailures > 0` triggers failure reason display; `text-xs text-destructive` |
| DLCX-02 | Dashboard shows confirmation message when phasing-out domain rescued | Rescue toast in `useVerifyDomain` `onSuccess` when previous status was `phasing_out` and response domain.status = `active` |
| DLCX-03 | Delete dialog shows decommission date before user confirms | Non-primary AlertDialog shows decommission = today + 30 days (PHASE_OUT_DURATION); `Dialog` for primary delete |
| DLCX-04 | Delete-primary flow requires new primary designation | `Dialog` (not AlertDialog) with `Select` replacement dropdown; two API calls: set_primary → destroy |
| DPRD-04 | Frozen domain cards show Frozen badge with re-upgrade prompt | Backend index scope must include `status_frozen`; frozen card variant; re-upgrade CTA button |

</phase_requirements>

---

## Summary

Phase 24 is primarily a frontend component replacement with one backend addition. The existing split-section layout (SubdomainsSection / CustomDomainList) is replaced by a unified vertical card list covering all domain lifecycle states. The context layer (`useDomainsAdminContext`) and all TanStack hooks are kept and updated. Only the view components are scrapped.

The single backend change is adding `POST /v1/admin/domains/:id/verify` route and controller action to the admin domains controller. The index and mutation_payload scopes must also include `status_frozen` so frozen cards appear in Phase 24. One additional migration is required: `set_primary_on_verify` boolean column to store the wizard step 3 primary preference, consumed by `DomainVerificationJob#promote_to_active!`.

A pre-existing test conflict must be resolved in Phase 24: `BrokerageDomainSerializerTest` was written for Phase 21 and asserts that `verified`, `verified_at`, `last_checked_at`, and `consecutive_failures` are NOT serialized. The current serializer already exposes all four. The test must be updated to match the real serializer. Additionally, `admin_domains_test.rb` line 293-296 has a test asserting `POST /v1/admin/domains/:id/verify` returns 404 — this must be removed or replaced once the route is added.

**Primary recommendation:** Implement backend additions first (route, scope, migration), then update types and hooks, then build new view components. Treat test cleanup as a Wave 0 gate.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Domain card list rendering | Frontend (SPA) | — | Pure UI; domain data already fetched by existing hook |
| Add domain wizard (4-step) | Frontend (SPA) | API / Backend | Local dialog state; submits to existing POST /v1/admin/domains/custom |
| Primary preference storage | API / Backend | Database | Requires `set_primary_on_verify` boolean column on brokerage_domains |
| Auto-primary on verification | API / Backend (Job) | — | `DomainVerificationJob#promote_to_active!` reads `set_primary_on_verify` |
| On-demand verify (DVER-01) | API / Backend | Frontend | New `POST /v1/admin/domains/:id/verify` controller action with inline DNS check |
| Role-gating (DUIV-04/05/06) | Frontend (SPA) | — | `hasPermission` + `Can` component; backend already guards mutations |
| Frozen domain display (DPRD-04) | Frontend (SPA) | API / Backend | Backend index scope must include `status_frozen`; UI renders frozen card variant |
| Delete-primary flow (DLCX-04) | Frontend (SPA) | API / Backend | Sequential set_primary → destroy calls; replacement selector in Dialog |
| Rescue toast (DLCX-02) | Frontend (SPA) | — | `useVerifyDomain` detects phasing_out → active transition from cache snapshot |

---

## Standard Stack

### Core (already in project)
[VERIFIED: codebase grep]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI rendering | Project standard |
| shadcn/ui | new-york/zinc | Component library | Project standard per components.json |
| TanStack Query | v5 | Server state / cache | Project standard; all domain hooks use it |
| react-hot-toast | project-installed | Toast notifications | Used in all existing mutation hooks |
| dayjs | ^1.11.7 | Date formatting, relative time | Already used in DomainCard + CommentFeedRow |
| lucide-react | project-installed | Icons only | CLAUDE.md directive |
| Rails 7.1 (backend) | 7.1.x | JSON API | Project standard |
| Resolv (Ruby stdlib) | stdlib | DNS lookup | Used in DomainVerificationJob and onboarding verify |

### Supporting (already installed)
[VERIFIED: codebase grep]

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-dialog` | ^1.1.15 | Dialog/modal | Wizard + primary-delete dialog |
| `@radix-ui/react-alert-dialog` | ^1.1.15 | Destructive confirmation | Non-primary delete dialog |
| `@radix-ui/react-select` | ^2.2.6 | Replacement domain dropdown | Primary delete dialog |
| `dayjs/plugin/relativeTime` | included with dayjs | "3 minutes ago" format | Last-checked timestamp on cards |

### Requires Installation
[VERIFIED: package.json + shadcn CLI check]

| Library | Install Command | Purpose | Gap |
|---------|----------------|---------|-----|
| `@radix-ui/react-tooltip` + shadcn tooltip.tsx | `npx shadcn add tooltip` (from frontend/) | Lock icon tooltip on subdomain card (DUIV-02) | Not in package.json or components/ui/ |

**Version verification:** `@radix-ui/react-tooltip` is not in `package.json`. `tooltip.tsx` does not exist in `frontend/src/components/ui/`. Running `npx shadcn add tooltip` installs the Radix package and generates the component file. [VERIFIED: file system check]

**Installation:**
```bash
# From frontend/
npx shadcn add tooltip
```

---

## Architecture Patterns

### System Architecture Diagram

```
User action (click)
        │
        ▼
[DomainCard or Dialog component]
        │ calls action from context
        ▼
[useDomainsAdminContext] ←── state: domains, brokerage, isLoading, error
        │ calls mutate / mutateAsync
        ▼
[TanStack mutation hook]
  useVerifyDomain / useRemoveCustomDomain
  useSetPrimaryDomain / useDecommissionDomain
  useAddCustomDomain
        │
        ▼
[API module] (assets/api/admin/domains/*.ts)
  POST /v1/admin/domains/:id/verify
  DELETE /v1/admin/domains/:id
  PATCH /v1/admin/domains/:id/set_primary
  POST /v1/admin/domains/custom
        │
        ▼
[V1::Admin::DomainsController]
  require_admin! (default) — owner+admin
  require_owner! (mutations except verify)
  BrokerageAuth → Current.brokerage
        │
        ▼
[BrokerageDomain model + DB]
  status: active|phasing_out|pending|frozen|decommissioned
  verified, verified_at, consecutive_failures, last_checked_at
  is_primary, phase_out_at, set_primary_on_verify (new)
```

Data flows back up via `queryClient.invalidateQueries` or `queryClient.setQueryData` in each hook's `onSuccess`. Components re-render from TanStack Query cache.

### Recommended Project Structure

New files go alongside existing ones in the same directories:

```
frontend/src/
├── components/view/admin/domainsAdminView/
│   ├── [DELETE] SubdomainsSection.tsx         # removed per D-08
│   ├── [DELETE] CustomDomainList.tsx          # removed per D-08
│   ├── [DELETE] DomainCard.tsx                # replaced by new card
│   ├── [DELETE] DomainsAdminView.tsx          # replaced
│   ├── [DELETE] AddCustomDomainForm.tsx       # replaced by wizard
│   ├── [DELETE] SlotBanner.tsx                # removed per D-10
│   ├── [DELETE] FreeSlotAccordion.tsx         # removed per D-10
│   ├── [KEEP]   RemoveNowDialog.tsx           # dialog pattern reference
│   ├── [KEEP]   DomainSlugInput.tsx + slugValidation.ts  # keep if still used
│   ├── [NEW]    DomainCardList.tsx            # unified vertical list
│   ├── [NEW]    DomainCard.tsx                # status-variant card (replaces old)
│   ├── [NEW]    AddDomainWizard.tsx           # 4-step Dialog
│   ├── [NEW]    DeleteDomainDialog.tsx        # non-primary AlertDialog
│   └── [NEW]    DeletePrimaryDomainDialog.tsx # primary Dialog with Select
├── containers/adminBoard/domainsAdminBoard/
│   ├── [REPLACE] DomainsAdminBoard.tsx       # simplified entry point
│   └── [UPDATE]  useDomainsAdminContext.ts   # remove slot state, add verify
└── store/hooks/Admin/Domains/
    ├── [UPDATE] useVerifyDomain.ts           # rescue toast detection
    └── [UPDATE] useAddCustomDomain.ts        # remove slot-warning callback
frontend/src/assets/
    ├── types/domainType.ts                   # add pending/frozen, new fields
    └── api/admin/domains/
        └── [UPDATE] verifyDomain.ts          # update response type

backend/
├── config/routes.rb                          # add member { post :verify }
├── app/controllers/v1/admin/
│   └── domains_controller.rb                 # add verify action, update scopes
├── db/migrate/
│   └── [NEW] add_set_primary_on_verify_...rb # boolean column
└── test/
    ├── integration/admin_domains_test.rb      # update/remove 404 verify test, add verify tests
    └── serializers/brokerage_domain_serializer_test.rb  # fix stale assertions
```

### Pattern 1: Status-Variant Domain Card

**What:** A single `DomainCard` component that branches rendering based on `domain.status` and `domain.domainType`.
**When to use:** Always. Each card knows its own variant from props.

```typescript
// Source: 24-UI-SPEC.md §Card Status Variants
// Pattern: no switch statement needed at the list level; card handles all variants

const DomainCard: React.FC<{ domain: BrokerageDomain, role: UserRole | null }> = ({ domain, role }) => {
    const isOwner = role === 'owner'
    const isAdminOrOwner = role === 'owner' || role === 'admin'

    // Render variant based on domain.domainType + domain.status
    if (domain.domainType === 'subdomain') return <SubdomainCardVariant ... />
    if (domain.status === 'frozen') return <FrozenCardVariant ... />
    if (domain.status === 'pending') return <PendingCardVariant ... />
    // etc.
}
```

### Pattern 2: Wizard with Local Step State

**What:** 4-step Dialog with `useState` managing current step index and collected form values.
**When to use:** Transient multi-step form in a Dialog that resets on close.

```typescript
// Source: CONTEXT.md D-02
// State is local to the wizard component; not in context, not in Redux

const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
const [domain, setDomain] = useState('')
const [setPrimaryOnVerify, setSetPrimaryOnVerify] = useState(false)

// On dialog close (onOpenChange = false): reset all state
const handleOpenChange = (open: boolean) => {
    if (!open) { setStep(1); setDomain(''); setSetPrimaryOnVerify(false) }
    setOpen(open)
}
```

### Pattern 3: Rescue Detection in useVerifyDomain

**What:** Detect the phasing_out → active rescue transition in `onSuccess`.
**When to use:** When "Verify now" is pressed on a phasing-out card.

```typescript
// Source: CONTEXT.md D-11, D-12
// Pre-mutation snapshot approach: read domain status from TanStack cache before mutating

const useVerifyDomain = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (domainId: string | number) => verifyDomain(domainId),
        onMutate: (domainId) => {
            // Snapshot pre-mutation status from cache
            const cached = queryClient.getQueryData<FetchDomainsResponse>(domainsKeys.all)
            const previousStatus = cached?.domains.find(d => d.id === domainId)?.status
            return { previousStatus }
        },
        onSuccess: (data, _vars, context) => {
            if (data.domain?.status === 'active' && context?.previousStatus === 'phasing_out') {
                toast.success('Domain rescued — phase-out has been cancelled')
            } else if (data.verified) {
                toast.success('Domain verified successfully')
            } else {
                toast.error(data.error || 'DNS check failed — ensure your DNS records are set correctly')
            }
            queryClient.invalidateQueries({ queryKey: domainsKeys.all })
        },
        onError: () => {
            toast.error('DNS check failed — ensure your DNS records are set correctly')
        },
    })
}
```

The admin verify response must return `{ verified, domain: serialized_domain, domains: [...] }` (not just `{ verified, domain: string }`). This requires updating `verifyDomain.ts` response type and the backend action.

### Pattern 4: Sequential Mutation (Delete-Primary)

**What:** Two sequential API calls — set_primary then destroy.
**When to use:** Delete-primary dialog confirm button.

```typescript
// Source: CONTEXT.md D-04, D-06
// Use mutateAsync for sequential calls; handle partial failure explicitly

const handleConfirmDeletePrimary = async () => {
    try {
        await setPrimaryMutateAsync(replacementId)
        await removeCustomMutateAsync(domain.id)
        toast.success('Domain deleted.')
        onClose()
    } catch (err) {
        // D-06: Partial failure — set_primary may have succeeded
        toast.error(`Domain deletion failed — ${replacementDomain.domain} is now your primary domain.`)
        onClose()
    }
}
```

### Pattern 5: Card Sort Order

**What:** Unified list sorts: subdomain first, then active, then pending, then phasing-out, then frozen.
**When to use:** `DomainCardList` component before rendering.

```typescript
// Source: 24-UI-SPEC.md §Screen Layout
const STATUS_ORDER: Record<DomainStatus, number> = {
    active: 0, pending: 1, phasing_out: 2, frozen: 3, decommissioned: 4
}
const sorted = [...domains].sort((a, b) => {
    if (a.domainType === 'subdomain') return -1
    if (b.domainType === 'subdomain') return 1
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
})
```

### Anti-Patterns to Avoid

- **Passing `setSlotWarning` into mutation hooks:** D-10 removes slot-limit state. `useAddCustomDomain` and `useRemoveCustomDomain` no longer need the callback parameter.
- **Using AlertDialog for primary-delete:** Primary delete needs a `Select` inside, which AlertDialog cannot host reliably. Use regular `Dialog` (D-04).
- **Detecting rescue on every data load:** D-11 is explicit — rescue detection only on Verify now press, not on page refetch.
- **Inline `hasPermission` with hardcoded role strings:** Use `useRole()` + `hasPermission(role, 'access_admin_panel')` — never `role === 'admin'` inline comparisons (fragile, inconsistent).
- **Calling `camelcaseKeys` in hooks:** CLAUDE.md: the Axios interceptor already deep-transforms. Never call `camelcaseKeys` again in hooks.
- **Defining BrokerageDomain inline in component files:** CLAUDE.md: define domain interfaces in `assets/types/` before creating hooks or contexts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip on lock icon | Custom hover div | shadcn `Tooltip` + `TooltipProvider` | Accessibility (keyboard focus), ARIA roles, z-index handling |
| Copy-to-clipboard button | DOM manipulation | `navigator.clipboard.writeText` (already used in DnsInstructions.tsx) | Browser API is reliable; pattern already in codebase |
| Relative time formatting | Custom date math | `dayjs(date).fromNow()` with `relativeTime` plugin (already used in CommentFeedRow) | Edge cases in DST, localization |
| Domain format validation | Regex from scratch | Mirror `BrokerageDomain::RESERVED_SLUGS` + existing `slugValidation.ts` | Already implemented and tested |
| DNS check in verify action | Custom socket code | `Resolv::DNS` (Ruby stdlib) — mirrors existing `DomainVerificationJob#cname_resolves_to_subdomain?` | Already proven; error handling already written |
| Role check logic | Custom middleware or context | `hasPermission(role, permission)` from `@/assets/rbac/permissions.ts` + `Can` component | Centralized, tested |

---

## Critical Pre-Existing Test Conflicts

These must be fixed in Phase 24 — they are not new failures introduced by this phase, but they will block CI:

### Conflict 1: BrokerageDomainSerializerTest — stale assertions
**File:** `backend/test/serializers/brokerage_domain_serializer_test.rb`
**Problem:** Test was written for Phase 21 (6-field serializer). The Phase 22 serializer now exposes 10 fields: `id, domain, domain_type, status, is_primary, phase_out_at, verified, verified_at, last_checked_at, consecutive_failures`. The test asserts verified/verified_at/last_checked_at/consecutive_failures are NOT present and that only 6 keys exist.
**Confirmed failing:** `bundle exec rails test test/serializers/brokerage_domain_serializer_test.rb` produces 2 failures.
**Fix:** Update `test_serializes_only_the_six_lifecycle_attributes` to expect 10 keys. Remove `test_does_NOT_expose_verification_fields_(D-02)` (or invert it: assert these fields ARE present).

### Conflict 2: admin_domains_test.rb — "verify is 404" test
**File:** `backend/test/integration/admin_domains_test.rb` lines 291-296
**Problem:** Test named "POST /v1/admin/domains/:id/verify is no longer routed (404)" asserts the verify route returns 404. Phase 24 adds this route.
**Fix:** Remove or replace this test with new tests that assert the verify action's correct behavior (200 success, DNS not resolved, role gating).

---

## Common Pitfalls

### Pitfall 1: Frozen Domains Missing From Backend Index
**What goes wrong:** `GET /v1/admin/domains` returns `.routable.or(.status_pending)` = active + phasing_out + pending. Frozen domains are excluded. Frozen cards never appear.
**Why it happens:** `.routable` scope is `where(status: [:active, :phasing_out])`. The Phase 22 `frozen` status was added to the model but not to the index scope.
**How to avoid:** Update `index` and `mutation_payload` in `domains_controller.rb` to include `status_frozen`. Both scopes must be updated (index returns the initial list; mutation_payload returns the refreshed list after mutations).
**Warning signs:** Frozen domain cards never appear on the Domains page despite records existing in the database.

### Pitfall 2: `verifyDomain.ts` Response Type Mismatch
**What goes wrong:** The existing `VerifyDomainResponse` type has `domain?: string` (a domain name string). The admin verify action needs to return a serialized domain object (for rescue detection and cache update). Type mismatch causes runtime errors or the rescue toast never fires.
**Why it happens:** The `verifyDomain.ts` API module was written before Phase 24 requirements were specified.
**How to avoid:** Update `VerifyDomainResponse` to `{ verified: boolean; domain?: BrokerageDomain; domains?: BrokerageDomain[]; error?: string }`. Update the backend verify action to return `{ verified, domain: serialized, domains: all_domains }`.

### Pitfall 3: Rescue Detection Requires `onMutate` Snapshot
**What goes wrong:** If rescue detection reads from the cache AFTER `invalidateQueries` has already fired, the domain's old status (phasing_out) is gone and rescue is never detected.
**Why it happens:** `onSuccess` runs after the mutation resolves. If `invalidateQueries` is inside `onSuccess`, the refetch may complete before the status comparison.
**How to avoid:** Use `onMutate` to snapshot the pre-mutation status from the cache and pass it as context to `onSuccess`. This is TanStack Query's intended pattern for optimistic/compare workflows.

### Pitfall 4: Primary Delete Dialog Using AlertDialog
**What goes wrong:** `AlertDialog` is designed for simple confirm/cancel. Putting a `Select` component inside `AlertDialogContent` produces layout issues and accessibility problems (focus trap conflicts).
**Why it happens:** Developer reaches for AlertDialog by default for destructive confirmations.
**How to avoid:** Non-primary delete = AlertDialog (simple). Primary delete = `Dialog` with custom footer (per D-04, UI-SPEC §Primary Domain Delete).

### Pitfall 5: DomainStatus Type Union Missing `pending` and `frozen`
**What goes wrong:** TypeScript exhaustiveness checks fail; status badge switch/map produces undefined for pending and frozen domains.
**Why it happens:** `DomainStatus` in `domainType.ts` currently = `'active' | 'phasing_out' | 'decommissioned'` — missing `'pending'` and `'frozen'`.
**How to avoid:** Update `DomainStatus` union BEFORE implementing any card component. This is flagged as a type contract prerequisite in UI-SPEC §Type Interface Changes Required.

### Pitfall 6: `set_primary_on_verify` Column Not Migrated
**What goes wrong:** The wizard step 3 primary preference is captured in the UI but has no place to be stored. The `POST /v1/admin/domains/custom` action ignores the `set_primary_on_verify` param. The preference is silently dropped. Verified custom domains never become primary even when the user requested it.
**Why it happens:** No `set_primary_on_verify` column exists in `brokerage_domains` schema. It needs a migration.
**How to avoid:** Add migration `add_column :brokerage_domains, :set_primary_on_verify, :boolean, default: false, null: false`. Update the custom action to accept the param. Update `DomainVerificationJob#promote_to_active!` to respect the flag.

### Pitfall 7: Tooltip Not Installed
**What goes wrong:** `import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'` fails — file does not exist.
**Why it happens:** `@radix-ui/react-tooltip` is not in `package.json` and `tooltip.tsx` is not in `components/ui/`.
**How to avoid:** Run `npx shadcn add tooltip` from `frontend/` as a Wave 0 step before implementing DUIV-02.

### Pitfall 8: dayjs.extend(relativeTime) Not Called
**What goes wrong:** `dayjs(date).fromNow()` returns undefined or an unformatted date string.
**Why it happens:** The relativeTime plugin must be explicitly extended before use. It is extended locally in `CommentFeedRow.tsx` — not globally.
**How to avoid:** Call `dayjs.extend(relativeTime)` at the top of the new DomainCard component (or in a shared util file). The local extension pattern (as in CommentFeedRow) is acceptable.

---

## Code Examples

### Backend: verify action (admin domains controller)
```ruby
# Source: pattern mirrors V1::Onboarding::DomainsController#verify + DomainVerificationJob#cname_resolves_to_subdomain?

# POST /v1/admin/domains/:id/verify
# Accessible to admin + owner (default require_admin! from BaseController is correct)
def verify
  domain = Current.brokerage.brokerage_domains.find_by(id: params[:id])
  return render json: { error: "Domain not found" }, status: :not_found unless domain

  unless %w[pending phasing_out].include?(domain.status)
    return render json: { error: "Domain is not in a verifiable state" }, status: :unprocessable_entity
  end

  if cname_resolves_to_subdomain?(domain)
    ApplicationRecord.transaction do
      locked = BrokerageDomain.lock.find(domain.id)
      if locked.status_phasing_out?
        locked.update!(
          status: :active,
          consecutive_failures: 0,
          last_checked_at: Time.current,
          phase_out_at: nil
        )
      elsif locked.status_pending?
        locked.update!(
          status: :active,
          verified: true,
          verified_at: Time.current,
          consecutive_failures: 0,
          last_checked_at: Time.current
        )
        if locked.set_primary_on_verify? ||
           locked.brokerage.brokerage_domains.where(is_primary: true).none?
          locked.brokerage.brokerage_domains.update_all(is_primary: false)
          locked.update!(is_primary: true)
        end
      end
    end
    render json: mutation_payload(domain.reload, :custom), status: :ok
  else
    domain.update_column(:last_checked_at, Time.current)
    render json: {
      verified: false,
      error: "CNAME record not detected",
      domain: ActiveModelSerializers::SerializableResource.new(
        domain.reload, serializer: BrokerageDomainSerializer, adapter: :attributes
      ).as_json
    }, status: :ok
  end
end
```

Note: `mutation_payload` already returns `{ domain, domains }`. The verify action reuses it when successful. For the failure case, it returns `{ verified: false, error: ..., domain: ... }`.

### Backend: updated index scope
```ruby
# Source: domains_controller.rb index action
# Add status_frozen to include frozen domains for DPRD-04
def index
  domains = Current.brokerage.brokerage_domains.routable
    .or(Current.brokerage.brokerage_domains.status_pending)
    .or(Current.brokerage.brokerage_domains.status_frozen)
    .order(:created_at)
  render json: serialize_collection(domains), status: :ok
end

# Same update to mutation_payload helper:
def mutation_payload(updated_domain, domain_type)
  all_domains = Current.brokerage.brokerage_domains.routable
    .or(Current.brokerage.brokerage_domains.status_pending)
    .or(Current.brokerage.brokerage_domains.status_frozen)
    .order(:created_at)
  # ... rest unchanged
end
```

### Backend: route addition
```ruby
# Source: routes.rb — add member block under admin domains resources
namespace :admin do
  resources :domains, only: [:index, :destroy] do
    collection do
      patch :subdomain
      post :custom
    end
    member do
      patch :set_primary
      post :verify   # DVER-01 — add this line
    end
  end
end
```

### Frontend: updated domainType.ts
```typescript
// Source: CONTEXT.md §Integration Points + 24-UI-SPEC.md §Type Interface Changes Required
// [VERIFIED: current domainType.ts read]

export type DomainStatus = 'active' | 'phasing_out' | 'decommissioned' | 'pending' | 'frozen'

export interface BrokerageDomain {
    id: string | number
    domain: string
    domainType: DomainType
    status: DomainStatus
    isPrimary: boolean
    phaseOutAt: string | null
    lastCheckedAt: string | null       // ISO 8601 or null — from Phase 22 serializer
    consecutiveFailures: number        // 0 when no failures
    verified: boolean                  // true if CNAME was ever verified
    verifiedAt: string | null          // ISO 8601 or null
}
```

### Frontend: CNAME wizard step 2 - subdomain lookup
```typescript
// Source: CONTEXT.md §Specific Ideas
// The CNAME target value is the brokerage's active subdomain
// Find it from the domains list already loaded by useFetchDomains

const subdomainDomain = domains.find(d => d.domainType === 'subdomain' && d.status === 'active')
const cnameTarget = subdomainDomain?.domain ?? '' // e.g. "acme.realstate.ca"
```

### Frontend: Tooltip installation and usage
```typescript
// Source: shadcn official — after `npx shadcn add tooltip`
// [ASSUMED: exact generated code may vary, but this matches shadcn new-york pattern]
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Wrap page or section in TooltipProvider (once, high in tree):
// <TooltipProvider>

<Tooltip>
    <TooltipTrigger asChild>
        <button className="inline-flex items-center text-muted-foreground" aria-label="Permanent domain">
            <Lock className="h-4 w-4" />
        </button>
    </TooltipTrigger>
    <TooltipContent>
        <p>This domain is permanent and was assigned at registration.</p>
    </TooltipContent>
</Tooltip>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 21 slot-limit UX (SlotBanner, FreeSlotAccordion, slot state in context) | Removed in Phase 24 (D-08, D-10) | Phase 24 design decision | All slot-related state and components are deleted |
| Split Subdomains / Custom Domains sections | Unified vertical card list | Phase 24 design decision | Simpler component tree; all status variants in one list |
| 6-field BrokerageDomainSerializer | 10-field serializer (Phase 22) | Phase 22 | Serializer test is stale and currently failing |
| Verify route removed ("no longer routed") | `POST /v1/admin/domains/:id/verify` added in Phase 24 | Phase 24 | admin_domains_test.rb has a 404-assert test that must be removed |
| Custom domains created as active (pre-Phase 22) | Created as pending; DomainVerificationJob promotes to active | Phase 22 | Frontend must handle pending status in card list |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `npx shadcn add tooltip` installs the tooltip to `components/ui/tooltip.tsx` with the new-york preset | Standard Stack / Pitfall 7 | Tooltip file structure differs; import paths break |
| A2 | The admin verify action should use the same `cname_resolves_to_subdomain?` helper from DomainVerificationJob (or an extracted shared method) | Code Examples / Backend verify action | DNS check logic differs; could check a different target |
| A3 | `set_primary_on_verify` is the cleanest approach for DADD-02; no alternative storage mechanism (like a separate table or transient UI-only flow) is preferable | DADD-02 analysis | Migration is avoidable if primary preference is handled differently |

---

## Open Questions (RESOLVED)

1. **DADD-02: Primary preference storage approach**
   - RESOLVED: Add a `set_primary_on_verify` boolean migration (`add_column :brokerage_domains, :set_primary_on_verify, :boolean, default: false, null: false`). The wizard step 3 preference is persisted on the domain record; the `custom` action accepts the param and `DomainVerificationJob#promote_to_active!` (and the new verify action) read it to auto-promote on verification. Plan 01 adds the migration + backend wiring; Plan 03 captures the preference in the wizard; Plan 04 sends it via `addCustomDomain`. This is the clean, atomic approach over a transient or separately-enqueued `set_primary` call.
   - What we know: No `set_primary_on_verify` column existed in the schema. The verification job's `promote_to_active!` previously only auto-set primary when no primary existed at all.

2. **`verifyDomain.ts` response shape for rescue detection**
   - RESOLVED: The admin verify action returns the `mutation_payload` shape (`{ domain: serialized, domains: [...] }`) on success, and `{ verified: false, error, domain: serialized_domain }` on DNS failure so the card can update `lastCheckedAt` after a manual check. `VerifyDomainResponse` is updated to `{ verified: boolean; domain?: BrokerageDomain; domains?: BrokerageDomain[]; error?: string }` (full serialized domain object, not a bare string). The hook compares the pre-mutation cached status (via `onMutate` snapshot) against the response `domain.status` to detect the phasing_out → active rescue. Plan 01 implements the backend action; Plan 02 updates the response type and `useVerifyDomain`.
   - What we know: The prior response type was `{ verified: boolean, domain?: string, ... }`, which lacked the new status needed for rescue detection.

3. **SubdomainCardEditForm / DomainSlugInput / slugValidation.ts deletion scope**
   - RESOLVED: These files are out of scope for the new UI and are deleted per D-08 (full replacement). The UI-SPEC subdomain card variant has no "Edit" action — only "Set as primary" — so subdomain slug editing is intentionally removed. Plan 04 Task 3 deletes `SubdomainCardEditForm.tsx`, `DomainSlugInput.tsx`, `slugValidation.ts`, and `slugValidation.test.ts` (each gated on a grep confirming no remaining importer). If subdomain slug editing is needed later, it can be reintroduced as a separate phase.
   - What we know: These files existed in the domainsAdminView directory; Phase 24 removes the subdomain edit-in-card UX.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | `npx shadcn add tooltip` | ✓ | (project running) | — |
| shadcn CLI | Tooltip component install | ✓ | via npx | — |
| Ruby / Rails | Backend verify action | ✓ | 4.0.2 / 7.1 | — |
| Resolv (Ruby stdlib) | DNS check in verify action | ✓ | stdlib | — |
| `@radix-ui/react-tooltip` | DUIV-02 lock icon tooltip | ✗ | not installed | Install via `npx shadcn add tooltip` |

**Missing dependencies with no fallback:**
- None that block execution — tooltip install is a one-command Wave 0 step.

**Missing dependencies with fallback:**
- `@radix-ui/react-tooltip`: not installed; install with `npx shadcn add tooltip` before implementing DUIV-02.

---

## Security Domain

Phase 24 adds one new backend endpoint (`POST /v1/admin/domains/:id/verify`). No new auth flows, no new storage of secrets.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `require_admin!` from BaseController — Cognito JWT already verified |
| V4 Access Control | yes | `require_admin!` (owner + admin); no `require_owner!` needed for verify action |
| V5 Input Validation | yes | `params[:id]` scoped to `Current.brokerage.brokerage_domains.find_by(id: ...)` — tenant isolation |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant cross-read (another brokerage's domain) | Information Disclosure | `Current.brokerage.brokerage_domains.find_by(id: ...)` — existing controller pattern |
| Role escalation on verify | Elevation of Privilege | `require_admin!` in BaseController is the default — verify must NOT add `require_owner!` |
| DNS amplification / SSRF via verify endpoint | Tampering | `Resolv::DNS` queries only the domain name provided; domain must already belong to brokerage |

---

## Sources

### Primary (HIGH confidence)
- Codebase direct reads — `BrokerageDomainSerializer`, `DomainsController`, `BrokerageDomain`, `useVerifyDomain`, `useDomainsAdminContext`, `DomainCard`, `permissions.ts`, `Can.tsx`, `package.json`, `components.json`, `db/schema.rb`, `DomainVerificationJob`, `admin_domains_test.rb`, `brokerage_domain_serializer_test.rb`
- `24-CONTEXT.md` — locked decisions D-01 through D-12
- `24-UI-SPEC.md` — design contract (approved 2026-05-30)
- `REQUIREMENTS.md` — DUIV-01–06, DADD-01–04, DVER-01, DVER-03, DVER-04, DLCX-02–04, DPRD-04

### Secondary (MEDIUM confidence)
- `V1::Onboarding::DomainsController#verify` — reference implementation for synchronous DNS check pattern

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and codebase
- Architecture: HIGH — all files read directly; data flow verified
- Pitfalls: HIGH — Pitfalls 1 and 2 confirmed via test runs; others from code inspection
- Pre-existing test conflicts: HIGH — confirmed via `bundle exec rails test`

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable domain; 30-day window)
