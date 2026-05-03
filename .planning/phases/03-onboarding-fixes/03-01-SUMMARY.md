---
plan: 03-01
phase: 03-onboarding-fixes
status: complete
completed: 2026-05-03
---

# Plan 03-01 Summary: Domain Wizard Error Handling & SuccessStep Fix

## What Was Built

Fixed ONB-01: domain wizard error handling failures, incorrect SuccessStep redirect, and missing DNS verification button for Premium users.

## Files Modified

### Backend
- `backend/app/controllers/v1/onboarding/brokerages_controller.rb` (lines 51-52, 57-70, 79-88)
  - Added `subdomain_domain = nil` / `custom_domain_record = nil` before transaction block
  - Captured `BrokerageDomain.create!` return values to named variables
  - Extended response to include `subdomain_id` and `custom_domain_id`

### Frontend
- `frontend/src/assets/api/onboarding/createBrokerage.ts`
  - Added `subdomainId?: number` and `customDomainId?: number | null` to `CreateBrokerageResponse.domains`
- `frontend/src/store/hooks/Auth/useCreateBrokerage.ts`
  - Removed `onError` toast handler — mutation now throws on error for callers to handle inline
- `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx`
  - Replaced `toast.error(detail)` with `throw new Error(detail)` in `submit()` so DomainStep catch block receives the message
- `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` (lines 67-80)
  - Replaced bare `await actions.submit(domain)` with `try/catch` that sets `errors.subdomain` from server response
- `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx`
  - Replaced `useNavigate` with `window.location.href` for cross-domain navigation
  - Added DNS verify state machine (`idle | checking | verified | not_yet`) using existing `useVerifyDomain` hook (CLAUDE.md compliant — no direct API import)
  - "Check DNS status" button with Loader2 spinner state
  - "Domain verified" green badge on success
  - "Not yet verified — DNS may still be propagating." message on failure
  - Two-CTA verified layout: "Go to your custom domain" (primary) + "Go to subdomain" (outline)

## Decisions Implemented

- **D-01**: Inline subdomain error under SubdomainInput (not toast) — DomainStep catch sets `errors.subdomain`
- **D-02**: Context `submit()` throws on `data.error` so DomainStep can catch
- **D-03**: Toast removed from `useCreateBrokerage` — mutation throws cleanly
- **D-05**: Backend response includes `subdomain_id` and `custom_domain_id`
- **D-06**: DNS verify via existing `useVerifyDomain` hook — no direct API call from component
- **D-07**: Manual-trigger only (no polling)
- **D-08**: `window.location.href` for cross-domain navigation after brokerage creation

## CLAUDE.md Compliance

- SuccessStep uses `useVerifyDomain` hook — no direct import of `verifyDomain` API module
- No `camelcaseKeys` calls in hook files
- Icons via `lucide-react` only

## Verification

- `bundle exec standardrb app/controllers/v1/onboarding/brokerages_controller.rb` — exits 0 ✓
- All acceptance criteria grep gates pass ✓
- Note: `npx tsc --noEmit` fails with pre-existing env issue (`moduleResolution: "bundler"` requires TS 5.0+ but project uses 4.9.5); Vite handles TS transpilation independently

## Deviations

None — all tasks implemented as specified.

## Self-Check: PASSED
