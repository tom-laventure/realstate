# Requirements: RealState SaaS Platform — v1.8

**Defined:** 2026-06-03
**Core Value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## v1 Requirements

Requirements for v1.8 release. Each maps to roadmap phases.

### Routing

- [x] **ROUTE-01**: Unauthenticated user visiting `/` on the main domain is redirected to `/dashboard`, which then redirects to `/auth/login` if not signed in
- [x] **ROUTE-02**: Unauthenticated user visiting `/` on any brokerage subdomain is redirected to `/auth/login` immediately — no blank-screen flash from domain lookup

## Future Requirements

Deferred from prior milestones — not in current roadmap.

### Carry-forward

- S3 favicon upload outside transaction (CR-02, pre-existing)
- Brokerage switch preserving active tab position (UX, v1.4 deferral)
- Deep-link into admin panel with brokerage context preserved (UX, v1.4 deferral)
- Rethink listing access model — BrokerageEstate vs board credential JOIN (Architecture, v1.6 deferral)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Authenticated root `/` redirect | Authenticated users already land correctly via ProtectedRoute children |
| Backend routing changes | Both fixes are frontend-only router restructuring |
| Loading spinners for domain redirect | D-02 intentional design decision — blank is correct for the redirect path |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROUTE-01 | Phase 26 | Complete |
| ROUTE-02 | Phase 26 | Complete |

**Coverage:**
- v1 requirements: 2 total
- Mapped to phases: 2
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-03 after initial definition*
