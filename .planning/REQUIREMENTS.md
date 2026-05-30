# Requirements — v1.6 Domain Management v2

**Milestone:** v1.6 — Domain Management v2
**Status:** Active

---

## DUIV — Domain List UI

- [ ] **DUIV-01**: Domain list page renders as a vertical list of cards with no column headers; each card displays the domain URL, a plain-language description of what its current status means for the brokerage and its visitors, relevant dates (e.g. decommission date for phasing-out domains), and applicable action controls
- [ ] **DUIV-02**: Subdomain card displays a lock icon; hovering the lock shows a tooltip: "This domain is permanent and was assigned at registration." No action controls other than "Set as primary" appear on the subdomain card
- [ ] **DUIV-03**: A Primary badge is displayed on whichever domain is currently designated as primary
- [ ] **DUIV-04**: Owner-only action controls: add custom domain, delete custom domain, set as primary, trigger manual verification check
- [ ] **DUIV-05**: Admin-role users can trigger a manual verification check and view domain status; no mutation controls
- [ ] **DUIV-06**: All roles below Admin see the domain list in read-only mode with no action controls

## DADD — Add Custom Domain

- [ ] **DADD-01**: Adding a custom domain is a 4-step wizard: (1) Enter domain — user inputs the domain; (2) DNS instructions — user sees the exact CNAME record to add and a note that verification confirms the CNAME resolves correctly; (3) Primary preference — user is asked whether to auto-set this domain as primary once verification succeeds, with clear indication of which domain is currently primary and what will change; (4) Confirm — user submits, domain appears in the list with Pending verification status
- [ ] **DADD-02**: Primary preference step (step 3) is shown only when another active domain already exists; if no other active domain exists, the new domain becomes primary automatically upon verification success without prompting
- [ ] **DADD-03**: After submission, the domain card appears in the list with a Pending verification status immediately
- [ ] **DADD-04**: Unverified (pending) domains that are not verified within 7 days are automatically removed; Owner-role users receive an email warning at day 5 with a direct link to the Domains dashboard

## DVER — DNS Verification

- [ ] **DVER-01**: A "Verify now" button is available on any domain in a pending or phasing-out state; pressing it triggers an on-demand verification job
- [ ] **DVER-02**: Background verification polling runs every 30 minutes for all pending (unverified) and phasing-out domains as a fallback
- [ ] **DVER-03**: Each domain card shows the last-checked timestamp and the current verification state
- [ ] **DVER-04**: When verification fails, the domain card displays a plain-language explanation of what was not found (e.g. "CNAME record not detected")
- [ ] **DVER-05**: Simultaneous registrations of the same domain by different brokerages are resolved by first-to-verify wins; no deeper conflict resolution is implemented

## DHLT — Domain Health

- [ ] **DHLT-01**: Active custom domains are checked every 30 minutes to confirm their CNAME configuration remains valid
- [ ] **DHLT-02**: After 3 consecutive failed health checks (~90 minutes of consistent failure), the domain is automatically moved to Phasing out status
- [ ] **DHLT-03**: When a domain is auto-moved to Phasing out by health failure, all Owner-role users are notified by email; the email includes: which domain failed, the failure reason in plain language, the decommission date, and a direct link to the Domains dashboard
- [ ] **DHLT-04**: If the auto-phased-out domain was the brokerage's primary domain, the health failure email explicitly calls this out, notes that the subdomain is now serving as fallback primary, and prompts the owner to either fix and re-verify or designate a new primary
- [ ] **DHLT-05**: Health check cadence (default: 30 minutes) and phase-out duration (default: 30 days) are exposed as named constants in the codebase — not hardcoded inline — so future adjustment requires only a constant change

## DLCX — Domain Lifecycle

- [ ] **DLCX-01**: If verification succeeds at any point before a phasing-out domain's decommission date, the domain is fully restored to Active status and the phase-out is cancelled
- [ ] **DLCX-02**: The Domains dashboard displays a confirmation message when a previously phasing-out domain has been successfully rescued
- [ ] **DLCX-03**: Deleting a custom domain triggers a phase-out period rather than immediate removal; the deletion confirmation dialog shows the decommission date before the user confirms
- [ ] **DLCX-04**: If the domain being deleted is the current primary domain, the deletion flow requires the user to designate a new primary before confirming; the subdomain is pre-selected as the suggested replacement; the confirmation prompt explains that email links and redirects will update to the new primary

## DPRI — Primary Domain

- [ ] **DPRI-01**: Any fully active domain can be set as primary (Owner only)
- [ ] **DPRI-02**: Domains in Phasing out or Pending verification status cannot be set as primary
- [ ] **DPRI-03**: All system-generated links (invitation emails, notifications) use the primary domain
- [ ] **DPRI-04**: Requests to any non-primary domain are 301-redirected to the equivalent path on the primary domain

## DPRD — Pro Plan Downgrade

- [ ] **DPRD-01**: When a brokerage plan downgrades from Pro, all custom domains are frozen — no adding, deleting, or setting as primary is permitted while frozen
- [ ] **DPRD-02**: Frozen custom domains remain live but serve only a redirect to the subdomain rather than the full brokerage site
- [ ] **DPRD-03**: The subdomain automatically becomes the primary domain when a brokerage downgrades from Pro
- [ ] **DPRD-04**: Frozen domain cards display a Frozen badge with a plain-language explanation ("This domain is inactive due to your current plan") and a prompt to re-upgrade to restore full functionality
- [ ] **DPRD-05**: Owner-role users receive an email notification when the brokerage plan downgrades, explaining the effect on their custom domains
- [ ] **DPRD-06**: When a brokerage re-upgrades to Pro, all frozen custom domains are restored to their previous active state

---

## Future Requirements (v1.7+)

- Multi-domain round-robin / load balancing
- Server-side 301 redirect at the Caddy/proxy layer (current: client-side redirect on app init)
- Richer conflict resolution for simultaneous domain registrations beyond first-to-verify

## Out of Scope

- Multi-domain round-robin / load balancing — not needed at current scale; separate milestone
- Server-side 301 at the proxy/Caddy layer — client-side redirect continues from v1.5; full proxy-layer implementation is a separate infrastructure milestone
- Deeper conflict resolution for simultaneous domain claims — first-to-verify is sufficient; no complex arbitration
- Apple / Microsoft social login — separate auth milestone
- Two-way calendar sync — separate calendar milestone
- Microsoft / Apple CalDAV calendar providers — adapters built; activation deferred to v2

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DUIV-01 | — | Pending |
| DUIV-02 | — | Pending |
| DUIV-03 | — | Pending |
| DUIV-04 | — | Pending |
| DUIV-05 | — | Pending |
| DUIV-06 | — | Pending |
| DADD-01 | — | Pending |
| DADD-02 | — | Pending |
| DADD-03 | — | Pending |
| DADD-04 | — | Pending |
| DVER-01 | — | Pending |
| DVER-02 | — | Pending |
| DVER-03 | — | Pending |
| DVER-04 | — | Pending |
| DVER-05 | — | Pending |
| DHLT-01 | — | Pending |
| DHLT-02 | — | Pending |
| DHLT-03 | — | Pending |
| DHLT-04 | — | Pending |
| DHLT-05 | — | Pending |
| DLCX-01 | — | Pending |
| DLCX-02 | — | Pending |
| DLCX-03 | — | Pending |
| DLCX-04 | — | Pending |
| DPRI-01 | — | Pending |
| DPRI-02 | — | Pending |
| DPRI-03 | — | Pending |
| DPRI-04 | — | Pending |
| DPRD-01 | — | Pending |
| DPRD-02 | — | Pending |
| DPRD-03 | — | Pending |
| DPRD-04 | — | Pending |
| DPRD-05 | — | Pending |
| DPRD-06 | — | Pending |
