---
status: complete
phase: 21-frontend-redirect-guard-and-domains-admin
source: [21-VERIFICATION.md]
started: 2026-05-29T00:00:00Z
updated: 2026-05-29T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Subdomain admin sidebar — Domains nav position and Globe icon
expected: 'Domains' nav item appears after 'Listing Groups' in the subdomain admin SideNav with a Globe icon
result: pass

### 2. Portal admin sidebar — Domains nav position
expected: 'Domains' nav item appears after 'Groups' in PortalAdminSideNav with a Globe icon
result: issue
reported: "I see it in the sidebar, but it is not in the top level portal. eg http://localhost:3000/dashboard/1"
severity: major

### 3. Non-Pro brokerage Pro gate visual
expected: Locked card shows Lock icon, 'Custom domains require a Pro plan', 'Upgrade to Pro to add custom domains to your brokerage.', 'Upgrade to Pro' button
result: pass

### 4. Add domain form toggle interaction
expected: Clicking 'Add domain' shows AddCustomDomainForm inline; clicking 'Discard' hides it; submitting a valid hostname calls addCustom and clears the form
result: pass

### 5. Phasing-out card countdown + Remove now dialog
expected: Card shows countdown 'N days remaining · decommissions MMM D'; clicking 'Remove now' opens AlertDialog with exact copy from UI-SPEC; clicking 'Remove domain' calls decommission
result: pass

### 6. Slot-blocked state (2 phasing-out subdomains)
expected: Edit buttons disabled with 'Unavailable until MMM D, YYYY' tooltip; red 'No subdomain slots available until...' banner; 'Free a slot now?' accordion listing each phasing-out subdomain with Remove now button
result: pass

### 7. Redirect guard — back button history behavior
expected: After redirect from phasing-out subdomain to primary domain, clicking browser Back does NOT return to the phasing-out domain (window.location.replace, not href)
result: pass

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "'Domains' nav item appears after 'Groups' in PortalAdminSideNav with a Globe icon"
  status: fixed
  reason: "User reported: I see it in the sidebar, but it is not in the top level portal. eg http://localhost:3000/dashboard/1"
  fix: "Added Domains card (Globe icon, /admin/domains) to PortalShell.tsx 2×2 grid"
  severity: major
  test: 2

- truth: "Primary badge only shown on the domain that is the active redirect target"
  status: fixed
  reason: "User reported: when a primary domain is moved to phasing out it keeps the primary tag"
  fix: "DomainCard.tsx: changed domain.isPrimary to domain.isPrimary && isActive"
  severity: major
  test: ad-hoc
