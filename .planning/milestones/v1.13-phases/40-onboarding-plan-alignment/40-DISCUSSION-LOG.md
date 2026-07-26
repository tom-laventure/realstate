# Phase 40: Onboarding Plan Alignment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 40-onboarding-plan-alignment
**Areas discussed:** Plan-tier data source, Plan card content, Custom domain step UX

---

## Plan-tier data source

| Option | Description | Selected |
|--------|-------------|----------|
| New public GET endpoint | Add an unauthenticated endpoint (e.g. GET /v1/onboarding/plan_tiers) that serializes AppConstants::PLAN_TIERS. Frontend fetches it on mount. Single source of truth stays in the backend constant — no drift risk, but it's a new endpoint + hook + loading state. | ✓ |
| Frontend-mirrored constant | Hand-write a matching TS constant (price/mo, seat cap, feature flags) alongside the wizard, same values as the backend file. Zero new endpoint/loading state, but the two files can drift if someone edits one and forgets the other. | |

**User's choice:** New public GET endpoint
**Notes:** Route to live under the existing `namespace :onboarding` block in `backend/config/routes.rb`.

---

## Plan card content

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror PLAN-TIERS.md, highlight Growth | Feature bullets follow the flags already defined (real boards, clients, custom domain, calendar sync) plus seat cap wording ("1 seat" / "5 seats" / "Unlimited seats" for Free). Growth gets the 'Recommended' badge as the flagship paid tier. | ✓ |
| Mirror PLAN-TIERS.md, no highlight | Same feature bullets and seat-cap wording, but no tier is visually recommended — all three cards presented as equal, neutral choices. | |

**User's choice:** Mirror PLAN-TIERS.md, highlight Growth
**Notes:** None additional.

---

## Custom domain step UX

| Option | Description | Selected |
|--------|-------------|----------|
| Optional field, plain skip | Independent/Growth show the custom domain input with 'optional' in the label/placeholder, no required-field error. Leaving it blank just proceeds. | |
| Optional field with explicit nudge | Same optional field, but add a small explanatory line to make the optionality and later-path explicit. | |
| (Free-text) Yes/No confirmation toggle | User proposed a different flow than either preset option: a "Do you currently own a custom domain?" Yes/No toggle with a subheader on where to get one (domain broker examples). Clicking No hides the input and shows "That's alright, this can be added later." Clicking Yes reveals the (still-optional) input. | ✓ |

**User's choice:** Yes/No confirmation toggle (free-text override of the presented options)
**Notes:** User explicitly delegated exact wording of the subheader/domain-broker examples and the "no" reassurance message to Claude's discretion.

---

## Claude's Discretion

- Exact copy for the domain-broker subheader and "no" reassurance message.
- Default state (Yes/No) of the toggle on first render — recommended defaulting to No/collapsed.
- Internal naming for the new plan-tier serializer/service object and frontend hook.

## Deferred Ideas

None — discussion stayed within phase scope. One todo ("Rethink listing access model") was reviewed via todo-matching but not folded — unrelated to this phase's domain, already tracked for v1.14+.
