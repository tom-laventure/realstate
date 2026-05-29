---
status: partial
phase: 21-frontend-redirect-guard-and-domains-admin
source: [21-VERIFICATION.md]
started: 2026-05-29T00:00:00Z
updated: 2026-05-29T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Subdomain admin sidebar — Domains nav position and Globe icon
expected: 'Domains' nav item appears after 'Listing Groups' in the subdomain admin SideNav with a Globe icon
result: [pending]

### 2. Portal admin sidebar — Domains nav position
expected: 'Domains' nav item appears after 'Groups' in PortalAdminSideNav with a Globe icon
result: [pending]

### 3. Non-Pro brokerage Pro gate visual
expected: Locked card shows Lock icon, 'Custom domains require a Pro plan', 'Upgrade to Pro to add custom domains to your brokerage.', 'Upgrade to Pro' button
result: [pending]

### 4. Add domain form toggle interaction
expected: Clicking 'Add domain' shows AddCustomDomainForm inline; clicking 'Discard' hides it; submitting a valid hostname calls addCustom and clears the form
result: [pending]

### 5. Phasing-out card countdown + Remove now dialog
expected: Card shows countdown 'N days remaining · decommissions MMM D'; clicking 'Remove now' opens AlertDialog with exact copy from UI-SPEC; clicking 'Remove domain' calls decommission
result: [pending]

### 6. Slot-blocked state (2 phasing-out subdomains)
expected: Edit buttons disabled with 'Unavailable until MMM D, YYYY' tooltip; red 'No subdomain slots available until...' banner; 'Free a slot now?' accordion listing each phasing-out subdomain with Remove now button
result: [pending]

### 7. Redirect guard — back button history behavior
expected: After redirect from phasing-out subdomain to primary domain, clicking browser Back does NOT return to the phasing-out domain (window.location.replace, not href)
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
