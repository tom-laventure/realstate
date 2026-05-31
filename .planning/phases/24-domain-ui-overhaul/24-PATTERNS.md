# Phase 24: Domain UI Overhaul - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 16 new/modified files
**Analogs found:** 15 / 16

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/assets/types/domainType.ts` | type-def | — | self (extend existing) | exact |
| `frontend/src/assets/api/admin/domains/verifyDomain.ts` | api-module | request-response | `addCustomDomain.ts` | exact |
| `frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts` | hook | request-response | `useSetPrimaryDomain.ts` | exact |
| `frontend/src/store/hooks/Admin/Domains/useAddCustomDomain.ts` | hook | request-response | self (update: remove callback param) | exact |
| `frontend/src/store/hooks/Admin/Domains/useRemoveCustomDomain.ts` | hook | request-response | self (update: remove callback param) | exact |
| `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts` | context | request-response | self (update: remove slot state, add verify) | exact |
| `frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` | container | request-response | self (replace: simplified entry point) | exact |
| `frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx` | component | request-response | `CustomDomainList.tsx` | role-match |
| `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` | component | request-response | `DomainCard.tsx` (replace existing) | exact |
| `frontend/src/components/view/admin/domainsAdminView/AddDomainWizard.tsx` | component | request-response | `RemoveNowDialog.tsx` (Dialog shell) | role-match |
| `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` | component | request-response | `RemoveNowDialog.tsx` | exact |
| `frontend/src/components/view/admin/domainsAdminView/DeletePrimaryDomainDialog.tsx` | component | request-response | `RemoveNowDialog.tsx` (Dialog variant) | role-match |
| `backend/config/routes.rb` | config | — | self (add member post :verify) | exact |
| `backend/app/controllers/v1/admin/domains_controller.rb` | controller | request-response | `v1/onboarding/domains_controller.rb` verify action | role-match |
| `backend/db/migrate/..._add_set_primary_on_verify.rb` | migration | — | `20260530000001_add_domain_health_columns_to_brokerage_domains.rb` | exact |
| `backend/test/integration/admin_domains_test.rb` | test | — | self (update/add verify tests) | exact |
| `backend/test/serializers/brokerage_domain_serializer_test.rb` | test | — | self (fix stale assertions) | exact |

---

## Pattern Assignments

### `frontend/src/assets/types/domainType.ts` (type-def, extend)

**Analog:** self — extend in place

**Current state** (`frontend/src/assets/types/domainType.ts` lines 10-20):
```typescript
export type DomainType = 'subdomain' | 'custom'
export type DomainStatus = 'active' | 'phasing_out' | 'decommissioned'

export interface BrokerageDomain {
    id: string | number
    domain: string
    domainType: DomainType
    status: DomainStatus
    isPrimary: boolean
    phaseOutAt: string | null
}
```

**Required changes — add to DomainStatus and BrokerageDomain:**
```typescript
// Extend DomainStatus (line 11) — add 'pending' | 'frozen'
export type DomainStatus = 'active' | 'phasing_out' | 'decommissioned' | 'pending' | 'frozen'

// Extend BrokerageDomain interface — add four fields after phaseOutAt
export interface BrokerageDomain {
    id: string | number
    domain: string
    domainType: DomainType
    status: DomainStatus
    isPrimary: boolean
    phaseOutAt: string | null
    lastCheckedAt: string | null        // from Phase 22 serializer; camelCased by Axios interceptor
    consecutiveFailures: number         // 0 when no failures
    verified: boolean
    verifiedAt: string | null
}
```

**Also add VerifyDomainResponse to this file or update verifyDomain.ts:**
```typescript
export interface VerifyDomainResponse {
    verified: boolean
    domain?: BrokerageDomain           // serialized domain object (for rescue detection)
    domains?: BrokerageDomain[]        // full refreshed list (mutation_payload shape)
    error?: string
}
```

**Remove from domainType.ts (D-10):** `PhaseOutWarning`, `SlotBlockError` interfaces can remain but `slotWarning` state no longer flows into context.

---

### `frontend/src/assets/api/admin/domains/verifyDomain.ts` (api-module, request-response)

**Analog:** `frontend/src/assets/api/admin/domains/addCustomDomain.ts` (lines 1-9)

**Import pattern** (addCustomDomain.ts lines 1-2):
```typescript
import api from '@/assets/axios/axios'
import { MutationDomainsResponse } from '@/assets/types/domainType'
```

**Core pattern** (addCustomDomain.ts lines 4-8):
```typescript
const addCustomDomain = async (domain: string): Promise<MutationDomainsResponse> => {
    const response = await api.post('/v1/admin/domains/custom', { domain })
    return response.data as MutationDomainsResponse
}
```

**Target — update verifyDomain.ts to match correct response type:**
```typescript
import api from '@/assets/axios/axios'
import { VerifyDomainResponse } from '@/assets/types/domainType'

const verifyDomain = async (domainId: string | number): Promise<VerifyDomainResponse> => {
    const response = await api.post(`/v1/admin/domains/${domainId}/verify`)
    return response.data as VerifyDomainResponse
}

export default verifyDomain
```

Key change: `domain?: string` → `domain?: BrokerageDomain` (serialized object, not domain name string). The Axios interceptor deep-camelCases — never call `camelcaseKeys` again in the hook.

---

### `frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts` (hook, request-response)

**Analog:** `frontend/src/store/hooks/Admin/Domains/useSetPrimaryDomain.ts` (lines 1-19) — same mutation shape; extend with `onMutate` snapshot for rescue detection.

**Import pattern** (useSetPrimaryDomain.ts lines 1-5):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import setPrimaryDomain from '@/assets/api/admin/domains/setPrimaryDomain'
import { MutationDomainsResponse } from '@/assets/types/domainType'
import { domainsKeys } from './useFetchDomains'
```

**Core mutation pattern** (useSetPrimaryDomain.ts lines 7-19):
```typescript
const useSetPrimaryDomain = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => setPrimaryDomain(id),
        onSuccess: (data: MutationDomainsResponse) => {
            queryClient.setQueryData(domainsKeys.all, { domains: data.domains })
            toast.success('Primary domain updated.')
        },
        onError: () => {
            toast.error('Something went wrong. Please try again.')
        },
    })
}
```

**Target — extend with onMutate snapshot for rescue detection (RESEARCH.md Pattern 3):**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import verifyDomain from '@/assets/api/admin/domains/verifyDomain'
import { FetchDomainsResponse, VerifyDomainResponse } from '@/assets/types/domainType'
import { domainsKeys } from './useFetchDomains'

const useVerifyDomain = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (domainId: string | number) => verifyDomain(domainId),
        onMutate: (domainId) => {
            // Snapshot pre-mutation status before cache is invalidated (Pitfall 3)
            const cached = queryClient.getQueryData<FetchDomainsResponse>(domainsKeys.all)
            const previousStatus = cached?.domains.find(d => d.id === domainId)?.status
            return { previousStatus }
        },
        onSuccess: (data: VerifyDomainResponse, _vars, context) => {
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

export default useVerifyDomain
```

---

### `frontend/src/store/hooks/Admin/Domains/useAddCustomDomain.ts` (hook, update)

**Analog:** self — remove `onPhaseOutWarning` callback param (D-10).

**Current signature** (useAddCustomDomain.ts line 7):
```typescript
const useAddCustomDomain = (onPhaseOutWarning?: (warning: PhaseOutWarning) => void) => {
```

**Target — remove callback; no other changes to mutation shape:**
```typescript
const useAddCustomDomain = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (domain: string) => addCustomDomain(domain),
        onSuccess: (data: MutationDomainsResponse) => {
            queryClient.setQueryData(domainsKeys.all, { domains: data.domains })
            toast.success('Domain added — verification pending')
        },
        onError: () => {
            toast.error('Something went wrong. Please try again.')
        },
    })
}
```

`PhaseOutWarning` import can be removed from this file after update.

---

### `frontend/src/store/hooks/Admin/Domains/useRemoveCustomDomain.ts` (hook, update)

**Analog:** self — mirror same callback removal as useAddCustomDomain above.

**Current signature** (useRemoveCustomDomain.ts line 9):
```typescript
const useRemoveCustomDomain = (onPhaseOutWarning?: (warning: PhaseOutWarning) => void) => {
```

**Target — remove callback param; keep rest identical:**
```typescript
const useRemoveCustomDomain = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string | number) => removeDomain(id),
        onSuccess: (data: MutationDomainsResponse) => {
            queryClient.setQueryData(domainsKeys.all, { domains: data.domains })
            toast.success('Domain removed.')
        },
        onError: () => {
            toast.error('Something went wrong. Please try again.')
        },
    })
}
```

---

### `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts` (context, update)

**Analog:** self — remove slot state, add verify action and `mutateAsync` for sequential calls.

**Current imports to remove** (lines 9, 13, 18, 21, 22, 34-41):
- `PhaseOutWarning` from domainType
- `useState` for `slotWarning`
- `setSlotWarning` callbacks passed into `useAddCustomDomain`, `useRemoveCustomDomain`, `useUpdateSubdomain`
- `subdomainSlotsBlocked`, `customSlotsBlocked` computed values

**Import pattern to keep** (useDomainsAdminContext.ts lines 1-8):
```typescript
import { useCallback, useMemo } from 'react'
import useFetchDomains from '@/store/hooks/Admin/Domains/useFetchDomains'
import useFetchBrokerage from '@/store/hooks/Admin/Brokerage/useFetchBrokerage'
import useUpdateSubdomain from '@/store/hooks/Admin/Domains/useUpdateSubdomain'
import useSetPrimaryDomain from '@/store/hooks/Admin/Domains/useSetPrimaryDomain'
import useDecommissionDomain from '@/store/hooks/Admin/Domains/useDecommissionDomain'
import useAddCustomDomain from '@/store/hooks/Admin/Domains/useAddCustomDomain'
import useRemoveCustomDomain from '@/store/hooks/Admin/Domains/useRemoveCustomDomain'
import useVerifyDomain from '@/store/hooks/Admin/Domains/useVerifyDomain'
```

**useMemo return pattern** (useDomainsAdminContext.ts lines 44-67 — keep shape, replace content):
```typescript
return useMemo(() => ({
    state: {
        domains,
        brokerage,
        isLoading: isLoadingDomains || isLoadingBrokerage,
        error: domainsError || brokerageError,
        isPremium,
    },
    actions: {
        updateSubdomain,
        setPrimary,
        setPrimaryAsync,     // mutateAsync variant for sequential delete-primary flow
        decommission,
        addCustom,
        removeCustom,
        removeCustomAsync,   // mutateAsync variant for sequential delete-primary flow
        verify,
    },
}), [...])
```

Key: expose both `mutate` (fire-and-forget) and `mutateAsync` (for sequential set_primary → destroy in DeletePrimaryDomainDialog). Pattern: use `{ mutate, mutateAsync }` destructuring from useMutation return.

---

### `frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` (container, replace)

**Analog:** self — simplify to remove split-section rendering logic.

**Loading/error shell pattern** (DomainsAdminBoard.tsx lines 10-24):
```typescript
if (state.isLoading) {
    return (
        <AdminBoard>
            <div className="p-6 text-sm text-muted-foreground">Loading domains...</div>
        </AdminBoard>
    )
}
if (state.error) {
    return (
        <AdminBoard>
            <div className="p-6 text-sm text-destructive">Error loading domains</div>
        </AdminBoard>
    )
}
```

**Target — simplified entry point (no split-section; single DomainCardList):**
```typescript
import AdminBoard from '../AdminBoard'
import DomainCardList from '@/components/view/admin/domainsAdminView/DomainCardList'
import useDomainsAdminContext from './useDomainsAdminContext'

const DomainsAdminBoard = () => {
    const { state, actions } = useDomainsAdminContext()

    if (state.isLoading) { ... }
    if (state.error) { ... }

    return (
        <AdminBoard>
            <DomainCardList
                domains={state.domains}
                brokerage={state.brokerage}
                actions={actions}
            />
        </AdminBoard>
    )
}
```

---

### `frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx` (component, NEW)

**Analog:** `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` (existing card) + sort pattern from RESEARCH.md Pattern 5.

**Import pattern:**
```typescript
import React from 'react'
import { BrokerageDomain, DomainStatus } from '@/assets/types/domainType'
import DomainCard from './DomainCard'
import AddDomainWizard from './AddDomainWizard'
import Can from '@/components/common/guards/Can'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
```

**Sort pattern** (RESEARCH.md Pattern 5):
```typescript
const STATUS_ORDER: Record<DomainStatus, number> = {
    active: 0, pending: 1, phasing_out: 2, frozen: 3, decommissioned: 4
}
const sorted = [...domains].sort((a, b) => {
    if (a.domainType === 'subdomain') return -1
    if (b.domainType === 'subdomain') return 1
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
})
```

**List render pattern** — vertical `space-y-3` list; "Add domain" button gated by `manage_brokerage_settings` (owner-only):
```typescript
return (
    <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Domains</h2>
            <Can permission="manage_brokerage_settings">
                <Button size="sm" onClick={() => setWizardOpen(true)}>
                    <Plus className="h-4 w-4 mr-1.5" /> Add domain
                </Button>
            </Can>
        </div>
        <div className="space-y-3">
            {sorted.map(domain => (
                <DomainCard key={domain.id} domain={domain} actions={actions} />
            ))}
        </div>
        <AddDomainWizard open={wizardOpen} onOpenChange={setWizardOpen} onAdd={actions.addCustom} />
    </div>
)
```

---

### `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` (component, replace)

**Analog:** existing `DomainCard.tsx` — same Card chrome; replace props interface and variant logic.

**Card chrome pattern** (existing DomainCard.tsx lines 79-100):
```typescript
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// Card shell:
<Card>
    <CardHeader className="space-y-2 p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={domain.domain}>
                    {domain.domain}
                </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {/* badges */}
            </div>
        </div>
    </CardHeader>
    <CardContent className="space-y-3 p-5 pt-0">
        {/* body */}
    </CardContent>
</Card>
```

**Badge color pattern** (existing DomainCard.tsx lines 64-74):
```typescript
// Type badge
<Badge className="border bg-secondary text-secondary-foreground border-border">Subdomain</Badge>
<Badge className="border bg-purple-500/10 text-purple-700 border-purple-500/40">Custom Domain</Badge>

// Status badge
<Badge className="border bg-emerald-500/10 text-emerald-700 border-emerald-500/40">Active</Badge>
<Badge className="border bg-amber-500/10 text-amber-700 border-amber-500/40">Phasing Out</Badge>

// Primary badge (DUIV-03 — sky blue per RESEARCH.md)
<Badge className="border bg-sky-500/10 text-sky-700 border-sky-500/40">Primary</Badge>

// Frozen badge (DPRD-04 — new)
<Badge className="border bg-slate-500/10 text-slate-600 border-slate-500/40">Frozen</Badge>

// Pending badge (new)
<Badge className="border bg-yellow-500/10 text-yellow-700 border-yellow-500/40">Pending</Badge>
```

**RBAC gating pattern** — use `Can` + `useRole` for action controls:
```typescript
import Can from '@/components/common/guards/Can'
import useRole from '@/store/hooks/Auth/useRole'

const { role } = useRole()

// Owner-only actions (add, delete, set primary):
<Can permission="manage_brokerage_settings">
    <Button size="sm" variant="outline" onClick={() => onDelete(domain.id)}>Delete</Button>
</Can>

// Admin + owner actions (verify):
<Can permission="access_admin_panel">
    <Button size="sm" variant="outline" onClick={() => onVerify(domain.id)}>Verify now</Button>
</Can>
```

**Subdomain lock icon pattern** (DUIV-02, requires tooltip install first):
```typescript
import { Lock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

<Tooltip>
    <TooltipTrigger asChild>
        <span className="inline-flex items-center text-muted-foreground cursor-default">
            <Lock className="h-3.5 w-3.5" />
        </span>
    </TooltipTrigger>
    <TooltipContent>
        <p>This domain is permanent and was assigned at registration.</p>
    </TooltipContent>
</Tooltip>
```

**dayjs relativeTime pattern** (mirrors CommentFeedRow — call extend locally):
```typescript
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

// Usage for lastCheckedAt:
const lastChecked = domain.lastCheckedAt ? dayjs(domain.lastCheckedAt).fromNow() : 'Never checked'
```

---

### `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` (component, NEW)

**Analog:** `RemoveNowDialog.tsx` (lines 1-42) — exact AlertDialog pattern for non-primary delete.

**Full pattern to copy from RemoveNowDialog.tsx:**
```typescript
import React from 'react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Props interface:
interface DeleteDomainDialogProps {
    open: boolean
    domain: BrokerageDomain
    onConfirm: () => void
    onCancel: () => void
}

// AlertDialog open pattern (RemoveNowDialog.tsx line 22):
<AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>

// Footer pattern (RemoveNowDialog.tsx lines 29-35):
<AlertDialogFooter>
    <AlertDialogCancel onClick={onCancel}>Keep domain</AlertDialogCancel>
    <AlertDialogAction
        onClick={onConfirm}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
    >Delete domain</AlertDialogAction>
</AlertDialogFooter>
```

**Phase 24 addition in AlertDialogDescription** — show decommission date (DLCX-03):
```typescript
const decommissionDate = dayjs().add(30, 'day').format('MMMM D, YYYY')
// PHASE_OUT_DURATION = 30 days from BrokerageDomain model

<AlertDialogDescription>
    {`${domain.domain} will be decommissioned on ${decommissionDate}. This cannot be undone.`}
</AlertDialogDescription>
```

---

### `frontend/src/components/view/admin/domainsAdminView/DeletePrimaryDomainDialog.tsx` (component, NEW)

**Analog:** `RemoveNowDialog.tsx` shell — but uses `Dialog` (not AlertDialog) because it contains a `Select` dropdown (Pitfall 4).

**Import pattern — use Dialog not AlertDialog (RESEARCH.md Pitfall 4):**
```typescript
import React, { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { BrokerageDomain } from '@/assets/types/domainType'
```

**Dialog open pattern** (mirrors RemoveNowDialog.tsx line 22 but with Dialog):
```typescript
<Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
```

**Replacement dropdown pattern** (D-04, D-05 — subdomain pre-selected, enable confirm only when selected):
```typescript
// activeNonPrimary: all active domains that are not the domain being deleted
const activeDomains = domains.filter(d => d.status === 'active' && d.id !== domain.id)
const defaultReplacement = activeDomains.find(d => d.domainType === 'subdomain') ?? activeDomains[0]
const [replacementId, setReplacementId] = useState<string>(String(defaultReplacement?.id ?? ''))

<Select value={replacementId} onValueChange={setReplacementId}>
    <SelectTrigger><SelectValue placeholder="Select replacement primary" /></SelectTrigger>
    <SelectContent>
        {activeDomains.map(d => (
            <SelectItem key={d.id} value={String(d.id)}>{d.domain}</SelectItem>
        ))}
    </SelectContent>
</Select>

// Confirm disabled until replacement selected:
<Button
    variant="destructive"
    disabled={!replacementId || isPending}
    onClick={handleConfirm}
>Delete domain</Button>
```

**Sequential mutation pattern** (D-04, D-06 — mutateAsync from context):
```typescript
const handleConfirm = async () => {
    try {
        await setPrimaryAsync(replacementId)
        await removeCustomAsync(domain.id)
        toast.success('Domain deleted.')
        onClose()
    } catch {
        // D-06: Partial failure — set_primary may have succeeded
        toast.error('Domain deletion failed — a new primary was already designated.')
        onClose()
    }
}
```

---

### `frontend/src/components/view/admin/domainsAdminView/AddDomainWizard.tsx` (component, NEW)

**Analog:** `RemoveNowDialog.tsx` — Dialog shell pattern; local useState for step state (D-02).

**Dialog import pattern** (not AlertDialog — wizard needs full Dialog):
```typescript
import React, { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
```

**Local step state pattern** (D-02, RESEARCH.md Pattern 2):
```typescript
const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
const [domain, setDomain] = useState('')
const [setPrimaryOnVerify, setSetPrimaryOnVerify] = useState(false)

// Reset on close (D-02):
const handleOpenChange = (open: boolean) => {
    if (!open) {
        setStep(1)
        setDomain('')
        setSetPrimaryOnVerify(false)
    }
    onOpenChange(open)
}
```

**Step 3 conditional render** (DADD-02 — only show when another active domain exists):
```typescript
// domains from props (loaded by context)
const hasOtherActiveDomain = domains.some(d => d.status === 'active' && d.domainType !== 'subdomain')
// Skip step 3 if no other active domains: after step 2, go straight to step 4
const nextStep = (currentStep === 2 && !hasOtherActiveDomain) ? 4 : currentStep + 1
```

**CNAME target lookup** (RESEARCH.md §CNAME wizard step 2):
```typescript
const subdomainDomain = domains.find(d => d.domainType === 'subdomain' && d.status === 'active')
const cnameTarget = subdomainDomain?.domain ?? ''
```

**onSuccess pattern** (D-03 — auto-close + toast + invalidate):
```typescript
// In mutation onSuccess (inside AddDomainWizard or delegated to useAddCustomDomain):
toast.success('Domain added — verification pending')
queryClient.invalidateQueries({ queryKey: domainsKeys.all })
onOpenChange(false)  // auto-close dialog
```

Copy-to-clipboard for CNAME target (RESEARCH.md §Don't Hand-Roll):
```typescript
navigator.clipboard.writeText(cnameTarget)
```

---

### `backend/config/routes.rb` (config, update)

**Analog:** self — add `post :verify` to the existing `member` block.

**Current admin domains block** (routes.rb lines 62-70):
```ruby
resources :domains, only: [:index, :destroy] do
  collection do
    patch :subdomain # DMOD-07
    post :custom # DMOD-08
  end
  member do
    patch :set_primary # DMOD-10
  end
end
```

**Target — add `post :verify` to member block:**
```ruby
resources :domains, only: [:index, :destroy] do
  collection do
    patch :subdomain
    post :custom
  end
  member do
    patch :set_primary
    post :verify   # DVER-01 — Phase 24
  end
end
```

**Onboarding verify route pattern** (routes.rb lines 22-30) — confirms member pattern is correct:
```ruby
resources :domains, only: [] do
  member do
    post :verify
  end
end
```

---

### `backend/app/controllers/v1/admin/domains_controller.rb` (controller, add verify action + scope update)

**Analog 1:** `v1/onboarding/domains_controller.rb` verify action (lines 31-83) — DNS check pattern.
**Analog 2:** self — `set_primary` action (lines 124-146) — transaction + find_by + status check + render pattern.

**before_action pattern** (domains_controller.rb line 6) — verify must NOT be in require_owner! list:
```ruby
before_action :require_owner!, only: %i[subdomain custom destroy set_primary]
# verify is NOT in this list — require_admin! (default from BaseController) is correct for verify
```

**Tenant-scoped find pattern** (domains_controller.rb line 85):
```ruby
domain = Current.brokerage.brokerage_domains.find_by(id: params[:id])
return render json: {error: "Domain not found"}, status: :not_found unless domain
```

**DNS check pattern** (onboarding/domains_controller.rb lines 62-83):
```ruby
require "resolv"

def dns_resolves?(domain, base_domain, server_ip)
  resolver = Resolv::DNS.new
  begin
    cname = resolver.getresource(domain, Resolv::DNS::Resource::IN::CNAME)
    return true if cname.name.to_s.chomp(".").end_with?(base_domain)
  rescue Resolv::ResolvError
    # fall through
  end
  if server_ip.present?
    begin
      addresses = resolver.getaddresses(domain)
      return addresses.any? { |a| a.to_s == server_ip }
    rescue Resolv::ResolvError
      return false
    end
  end
  false
ensure
  resolver&.close
end
```

**Transaction pattern** (domains_controller.rb set_primary action lines 136-140):
```ruby
ApplicationRecord.transaction do
  Current.brokerage.brokerage_domains
    .where(is_primary: true)
    .update_all(is_primary: false)
  domain.update!(is_primary: true)
end
```

**mutation_payload reuse pattern** (domains_controller.rb lines 202-222):
```ruby
render json: mutation_payload(domain.reload, :custom), status: :ok
```

**Scope update — index and mutation_payload must add status_frozen (Pitfall 1):**
```ruby
# In index action (line 11-13) — add .or(status_frozen):
domains = Current.brokerage.brokerage_domains.routable.or(
  Current.brokerage.brokerage_domains.status_pending
).or(
  Current.brokerage.brokerage_domains.status_frozen
).order(:created_at)

# Same three-way or() in mutation_payload (line 203-205).
```

**verify action — insert after set_primary, before private:**
```ruby
# POST /v1/admin/domains/:id/verify
# DVER-01: accessible to admin + owner (default require_admin! from BaseController).
def verify
  domain = Current.brokerage.brokerage_domains.find_by(id: params[:id])
  return render json: {error: "Domain not found"}, status: :not_found unless domain

  unless %w[pending phasing_out].include?(domain.status)
    return render json: {error: "Domain is not in a verifiable state"}, status: :unprocessable_entity
  end

  base_domain = ENV.fetch("APP_BASE_DOMAIN", "realstate.ca")
  server_ip = ENV.fetch("APP_SERVER_IP", nil)

  if dns_resolves?(domain.domain, base_domain, server_ip)
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

**private dns_resolves? method** — copy from onboarding controller verbatim (proven, tested pattern).

---

### `backend/db/migrate/..._add_set_primary_on_verify_to_brokerage_domains.rb` (migration, NEW)

**Analog:** `backend/db/migrate/20260530000001_add_domain_health_columns_to_brokerage_domains.rb` (lines 1-6) — simple add_column migration.

**Pattern to copy:**
```ruby
class AddSetPrimaryOnVerifyToBrokerageDomains < ActiveRecord::Migration[7.1]
  def change
    add_column :brokerage_domains, :set_primary_on_verify, :boolean, null: false, default: false
  end
end
```

---

### `backend/test/integration/admin_domains_test.rb` (test, update)

**Analog:** self — existing test setup and helper pattern.

**Setup pattern** (admin_domains_test.rb lines 1-29):
```ruby
class AdminDomainsTest < ActionDispatch::IntegrationTest
  include ActiveSupport::Testing::TimeHelpers

  setup do
    @brokerage = create(:brokerage, plan: "premium")
    @primary_subdomain = create(:brokerage_domain, brokerage: @brokerage, ...)
    @owner = create(:user)
    @admin = create(:user)
    create(:brokerage_membership, :owner, user: @owner, brokerage: @brokerage)
    create(:brokerage_membership, :admin, user: @admin, brokerage: @brokerage)
  end
```

**Request + assert pattern** (admin_domains_test.rb lines 277-289):
```ruby
test "POST /v1/admin/domains/custom creates pending domain ..." do
  post "/v1/admin/domains/custom",
    params: {domain: "newcustom.acme.com"},
    headers: auth_headers_for(@owner, @brokerage)
  assert_response :ok
  body = JSON.parse(response.body)
  assert body.key?("domain")
  assert body.key?("domains")
  assert_equal "pending", body["domain"]["status"]
end
```

**DNS stub pattern** — for verify tests, stub `dns_resolves?` or use `Resolv::DNS` mock:
```ruby
# Mock at the controller level using mocha or minitest stub:
V1::Admin::DomainsController.any_instance.stubs(:dns_resolves?).returns(true)
```

**Remove test at lines 291-296** (admin_domains_test.rb):
```ruby
# DELETE THIS TEST (replaces with verify success + failure + role tests):
test "POST /v1/admin/domains/:id/verify is no longer routed (404)" do
  post "/v1/admin/domains/#{@primary_subdomain.id}/verify", ...
  assert_response :not_found
end
```

**New tests to add:**
- `POST /v1/admin/domains/:id/verify returns 200 and sets status to active for pending domain (DNS OK)`
- `POST /v1/admin/domains/:id/verify returns 200 verified: false when DNS not resolved`
- `POST /v1/admin/domains/:id/verify returns 200 and rescues phasing_out domain`
- `POST /v1/admin/domains/:id/verify returns 403 for agent role`
- `GET /v1/admin/domains includes frozen domains`

---

### `backend/test/serializers/brokerage_domain_serializer_test.rb` (test, fix stale assertions)

**Analog:** self — fix in-place.

**Remove** `test "does NOT expose verification fields (D-02)"` (lines 35-47) — the current serializer exposes all four fields; this test is inverted.

**Update** `test "serializes only the six lifecycle attributes"` (lines 17-33):
```ruby
test "serializes the ten lifecycle and verification attributes" do
  json = ActiveModelSerializers::SerializableResource.new(
    @domain,
    serializer: BrokerageDomainSerializer,
    adapter: :attributes
  ).as_json

  expected_keys = %w[
    id domain domain_type status is_primary phase_out_at
    verified verified_at last_checked_at consecutive_failures
  ].sort
  actual_keys = json.keys.map(&:to_s).sort
  assert_equal expected_keys, actual_keys

  assert_equal @domain.id,         json["id"] || json[:id]
  assert_equal "acme.example.com", json["domain"] || json[:domain]
  assert_equal "subdomain",        json["domain_type"] || json[:domain_type]
  assert_equal "active",           json["status"] || json[:status]
  assert_equal true,               json["is_primary"] || json[:is_primary]
  assert_equal true,               json["verified"] || json[:verified]
  assert_nil json["verification_token"], "verification_token must NOT be exposed"
end
```

---

## Shared Patterns

### RBAC Gating
**Source:** `frontend/src/components/common/guards/Can.tsx` + `frontend/src/assets/rbac/permissions.ts`
**Apply to:** All new/updated view components with action controls

```typescript
// Owner-only (add, delete, set-primary actions):
<Can permission="manage_brokerage_settings">
    <Button ...>Action</Button>
</Can>

// Admin + owner (verify button):
<Can permission="access_admin_panel">
    <Button ...>Verify now</Button>
</Can>
```

`manage_brokerage_settings` = owner only. `access_admin_panel` = owner + admin. Never hardcode `role === 'admin'` inline.

---

### TanStack Mutation Pattern
**Source:** `frontend/src/store/hooks/Admin/Domains/useSetPrimaryDomain.ts`
**Apply to:** All domain mutation hooks

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { domainsKeys } from './useFetchDomains'

return useMutation({
    mutationFn: ...,
    onSuccess: (data) => {
        queryClient.setQueryData(domainsKeys.all, { domains: data.domains })
        // OR: queryClient.invalidateQueries({ queryKey: domainsKeys.all })
        toast.success('...')
    },
    onError: () => {
        toast.error('Something went wrong. Please try again.')
    },
})
```

Use `setQueryData` when mutation returns the full updated list (avoids refetch). Use `invalidateQueries` when full refetch is correct (e.g., verify — status transitions need authoritative reload).

---

### AlertDialog for Simple Destructive Confirmation
**Source:** `frontend/src/components/view/admin/domainsAdminView/RemoveNowDialog.tsx`
**Apply to:** `DeleteDomainDialog.tsx` (non-primary delete)

```typescript
<AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
    <AlertDialogContent>
        ...
        <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancel}>Keep domain</AlertDialogCancel>
            <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={onConfirm}
            >Delete domain</AlertDialogAction>
        </AlertDialogFooter>
    </AlertDialogContent>
</AlertDialog>
```

---

### Tenant-Scoped Controller Find
**Source:** `backend/app/controllers/v1/admin/domains_controller.rb` lines 85-86
**Apply to:** `verify` action

```ruby
domain = Current.brokerage.brokerage_domains.find_by(id: params[:id])
return render json: {error: "Domain not found"}, status: :not_found unless domain
```

Never use `BrokerageDomain.find_by(id: ...)` alone — always scope through `Current.brokerage`.

---

### Backend Error Rendering Pattern
**Source:** `backend/app/controllers/v1/admin/domains_controller.rb` lines 88-90
**Apply to:** `verify` action status checks

```ruby
return render json: {error: "Domain cannot be deleted in its current state"}, status: :unprocessable_entity
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/components/ui/tooltip.tsx` | ui-component | — | Not yet installed; must run `npx shadcn add tooltip` from `frontend/`. Not a file to write manually. |

---

## Deletion List (D-08)

Files to delete, no analog needed:
- `frontend/src/components/view/admin/domainsAdminView/SubdomainsSection.tsx`
- `frontend/src/components/view/admin/domainsAdminView/CustomDomainList.tsx`
- `frontend/src/components/view/admin/domainsAdminView/DomainsAdminView.tsx`
- `frontend/src/components/view/admin/domainsAdminView/AddCustomDomainForm.tsx`
- `frontend/src/components/view/admin/domainsAdminView/SlotBanner.tsx`
- `frontend/src/components/view/admin/domainsAdminView/FreeSlotAccordion.tsx`
- `frontend/src/components/view/admin/domainsAdminView/SubdomainCardEditForm.tsx`
- `frontend/src/components/view/admin/domainsAdminView/DomainSlugInput.tsx`
- `frontend/src/components/view/admin/domainsAdminView/slugValidation.ts`
- `frontend/src/components/view/admin/domainsAdminView/slugValidation.test.ts`

---

## Metadata

**Analog search scope:** `frontend/src/`, `backend/app/`, `backend/config/`, `backend/test/`
**Files scanned:** 22 source files read directly
**Pattern extraction date:** 2026-05-30
