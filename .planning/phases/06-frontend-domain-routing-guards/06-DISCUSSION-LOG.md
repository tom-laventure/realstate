# Phase 6: Frontend Domain Routing Guards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 06-frontend-domain-routing-guards
**Areas discussed:** Guard architecture, Not-found page, Subdomain /create redirect UX

---

## Guard Architecture

### Question 1: How should the domain routing split be implemented?

| Option | Description | Selected |
|--------|-------------|----------|
| Root guard component | `<DomainGuard>` at top of main.tsx, reads hostname at render time. Matches existing ProtectedRoute pattern. | ✓ |
| Bootstrap-time router split | main.jsx selects between two separate router configs. Clean separation but doubles route maintenance. | |

**User's choice:** Root guard component

---

### Question 2: Where should DomainGuard live?

| Option | Description | Selected |
|--------|-------------|----------|
| New file in guards/ | `frontend/src/components/common/guards/DomainGuard.tsx` | ✓ |
| Inline in router/main.tsx | Simpler but mixes guard logic with route config | |
| New guards/ subfolder | Overkill for a single component | |

**User's choice:** New file in guards/

---

### Question 3: Domain detection utility vs embedded?

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone utility in helpers/ | `frontend/src/helpers/domain.ts` — pure function, testable, reusable | ✓ |
| Embedded in DomainGuard | Fewer files but not reusable | |

**User's choice:** Standalone utility in helpers/

---

## Not-Found Page

### Question 1: New dedicated component vs adapt ErrorPage?

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated NotFound component | `frontend/src/containers/errorPage/NotFound.tsx` — clean separation of concerns | ✓ |
| Adapt ErrorPage | One fewer file but conflates router errors with domain-based blocking | |
| You decide | Claude picks during planning | |

**User's choice:** New dedicated NotFound component

---

### Question 2: What should the NotFound page say?

| Option | Description | Selected |
|--------|-------------|----------|
| Link to /create | "Page not found" + CTA: "Create a brokerage" | |
| Generic 404, no CTA | "Page not found" — no actionable link | ✓ |
| You decide | Claude picks copy and CTA | |

**User's choice:** Generic 404, no CTA

---

## Subdomain /create Redirect UX

### Question 1: How should the redirect happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Silent `<Navigate to="/" replace />` | React Router replaces history entry; no toast, no delay | ✓ |
| Toast + redirect | Brief explanation toast then navigate; adds delay and flash | |

**User's choice:** Silent `<Navigate to="/" replace />`

---

## Claude's Discretion

None — all gray areas had explicit user decisions.

## Deferred Ideas

None — discussion stayed within phase scope.
