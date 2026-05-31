# Phase 24: Domain UI Overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 24-Domain-UI-Overhaul
**Areas discussed:** Wizard surface & state, Delete-primary flow, Card list refactor scope, Rescue confirmation trigger

---

## Wizard surface & state

### Q1: Where does the 4-step "Add domain" wizard live on the page?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal/Dialog overlay | Pops over the card list. Consistent with shadcn Dialog (RemoveNowDialog exists). Dismissible with escape. | ✓ |
| Inline page expansion | Add button reveals multi-step form inline. New pattern for this codebase. | |
| Side drawer/Sheet | Slides in from the right. Wider than a dialog. | |

**User's choice:** Modal/Dialog overlay

---

### Q2: Where does the wizard's step state live?

| Option | Description | Selected |
|--------|-------------|----------|
| Local Dialog component state | useState inside wizard Dialog. State resets on close — correct for transient flow. | ✓ |
| useDomainsAdminContext | Context brain owns step + form values. Adds wizard concerns to domain context. | |
| Redux slice (createBrokerageWizard pattern) | Overkill for an in-dialog wizard; that pattern is for full-page multi-screen flows. | |

**User's choice:** Local Dialog component state

---

### Q3: How does the wizard close after submission?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-close + toast | Dialog closes, card list refetches, toast: "Domain added — verification pending". | ✓ |
| Show a success step in the wizard | 5th step with confirmation + "Done" button. | |

**User's choice:** Auto-close + toast

---

## Delete-primary flow

### Q1: How does the UI handle deleting the primary domain?

| Option | Description | Selected |
|--------|-------------|----------|
| Replacement selector inside the delete dialog | Dialog detects primary status, shows replacement dropdown before confirm. Two API calls: set_primary → destroy. | ✓ |
| Block and redirect to "set primary first" | Warning dialog prompts user to set primary first, then come back to delete. | |

**User's choice:** Replacement selector inside the delete dialog

---

### Q2: What's in the replacement dropdown?

| Option | Description | Selected |
|--------|-------------|----------|
| All active non-primary domains as options | Dropdown lists all active non-primary domains. Subdomain pre-selected. Covers DPRI-01. | ✓ |
| Subdomain only, pre-selected, no dropdown | Simplified — just tells user "subdomain will become primary". Ignores multi-active-domain case. | |

**User's choice:** All active non-primary domains as options (subdomain pre-selected)

---

### Q3: Partial failure (set_primary succeeds, destroy fails)?

| Option | Description | Selected |
|--------|-------------|----------|
| Show error toast, don't retry | Toast: "Domain deletion failed — a new primary was already designated." Primary change stands. | ✓ |
| Attempt to revert set_primary on destroy failure | Re-call set_primary on original domain. Complex, can create retry loops. | |

**User's choice:** Show error toast, don't retry. Primary change stands.

---

## Card list refactor scope

### Q1: How to approach existing DomainsAdminBoard components?

| Option | Description | Selected |
|--------|-------------|----------|
| Full replacement — new unified structure | Replace DomainsAdminBoard, DomainsAdminView, SubdomainsSection, CustomDomainList. Keep and update context + TanStack hooks. | ✓ |
| Surgical extension of existing components | Add new statuses/actions to existing split-section components. Split-section shape leaks into every new card. | |

**User's choice:** Full replacement of view components; keep/update context and hooks.

---

### Q2: Keep or remove slot-limit state from context?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it | slotWarning, subdomainSlotsBlocked, customSlotsBlocked are Phase 21 UX. Phase 24 replaces this page. No backwards-compat shims. | ✓ |
| Keep it just in case | Preserve in case slot-limit concept returns. Adds dead state with no current consumer. | |

**User's choice:** Remove slot-limit state entirely.

---

## Rescue confirmation trigger

### Q1: When does the UI show the rescue confirmation?

| Option | Description | Selected |
|--------|-------------|----------|
| Only when user pressed "Verify now" and status changed | useVerifyDomain onSuccess detects phasing_out → active transition. No passive detection. | ✓ |
| Detect on every data load | Compare previous vs. new statuses on each refetch. Catches background rescues user didn't trigger. | |

**User's choice:** Only when user pressed "Verify now" and status transitioned to active.

---

### Q2: Where does the rescue confirmation appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Toast notification | useVerifyDomain fires toast: "Domain rescued — phase-out has been cancelled." Consistent with all other mutation feedback. | ✓ |
| Inline on the domain card | Brief success banner on the card, auto-dismisses. Requires transient per-card state. | |

**User's choice:** Toast notification.

---

## Claude's Discretion

- Exact card layout for each status variant (field ordering, date formatting, status label copy)
- Whether rescue detection compares pre-mutation status vs. inspects response domain.status
- Whether to add a new permission constant for domain verification or gate directly on role
- Verify action implementation: synchronous inline DNS check (recommended, mirrors onboarding verify) vs. async job enqueue

## Deferred Ideas

None — discussion stayed within phase scope.
