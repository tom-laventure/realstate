# Phase 15: Backend API & BrokerageAuth Extension - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 15-Backend API & BrokerageAuth Extension
**Areas discussed:** BrokerageAuth extension strategy, admin_brokerages endpoint auth, admin_brokerages response shape

---

## BrokerageAuth Extension Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Extend BrokerageAuth inline | Add main-domain branch inside the existing concern. Zero admin controller changes. | ✓ |
| New AdminBrokerageAuth concern | Separate concern included in V1::Admin::ApplicationController. More isolated but requires concern inclusion. | |
| Override in AdminApplicationController | before_action in admin base controller re-resolves from header. Mixes resolution into controller layer. | |

**User's choice:** Extend BrokerageAuth inline (recommended)
**Notes:** Single concern handles all cases — no controller changes needed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| BrokerageAuth only resolves brokerage | No role check in concern. CognitoAuth handles membership; controller handles admin/owner check. | ✓ |
| BrokerageAuth validates admin/owner membership | Centralizes check but couples tenant resolution to role logic; Current.user may not be set yet. | |

**User's choice:** BrokerageAuth only resolves brokerage
**Notes:** Clean separation — concern does resolution, auth concern does membership, controller does role.

---

| Option | Description | Selected |
|--------|-------------|----------|
| { error: "X-Brokerage-Id header required" } | Clear, actionable message for missing header on main domain. | ✓ |
| { error: "Bad Request" } | Generic Rails default. | |
| You decide | Leave to planner. | |

**User's choice:** `{ error: "X-Brokerage-Id header required" }` with HTTP 400

---

## admin_brokerages Endpoint Auth

| Option | Description | Selected |
|--------|-------------|----------|
| Skip BrokerageAuth entirely — CognitoAuth only | New standalone controller, skip_before_action :resolve_brokerage, skip_brokerage_membership? = true. | ✓ |
| Modify BrokerageAuth to allow nil brokerage on main domain | Main domain + no header = nil brokerage, no 400. Controller handles nil. | |

**User's choice:** Skip BrokerageAuth entirely — CognitoAuth only

---

| Option | Description | Selected |
|--------|-------------|----------|
| New standalone controller, skip_before_action | V1::Account::AdminBrokeragesController. Minimal, self-contained. | ✓ |
| New base controller V1::Account::CrossTenantController | Second base class for cross-tenant account controllers. | |
| Override in existing AccountController | skip_before_action only: [:admin_brokerages]. Least new files. | |

**User's choice:** New standalone controller with skip_before_action :resolve_brokerage

---

| Option | Description | Selected |
|--------|-------------|----------|
| Main-domain only (include MainDomainOnly concern) | Prevents subdomain admins calling portal endpoint. Existing /v1/admin/** unaffected. | ✓ |
| Any domain — no restriction | Simpler; data is read-only and safe regardless of origin. | |

**User's choice:** Main-domain only
**Notes:** User asked if subdomain admin access would be affected — clarified that only this new endpoint is restricted; all existing /v1/admin/** routes on subdomains remain fully accessible.

---

## admin_brokerages Response Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Include subdomain URL now | { id, name, role, subdomain_url } — Phase 17 will need it for redirect. Avoids future change. | |
| Minimal — name, id, role only | Exactly what BE-01 requires. Phase 17 can extend if needed. | ✓ |

**User's choice:** Minimal — name, id, role only
**Notes:** No speculative fields.

---

| Option | Description | Selected |
|--------|-------------|----------|
| { admin_brokerages: [...] } | Descriptive root key matching endpoint name. Consistent with existing patterns. | ✓ |
| { brokerages: [...] } | Simpler but ambiguous with brokerage endpoints. | |

**User's choice:** `{ admin_brokerages: [...] }`

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline JSON in controller | render json: { admin_brokerages: ... }. Simple flat structure doesn't warrant a serializer. | ✓ |
| Dedicated AdminBrokerageSerializer | Formal serializer class. More files, easier to extend. | |

**User's choice:** Inline JSON in controller

---

## Claude's Discretion

- Integration with how `main_domain?` helper is extracted/shared between `BrokerageAuth` and `MainDomainOnly` — planner decides whether to extract a shared module or duplicate the logic

## Deferred Ideas

None — discussion stayed within phase scope.
