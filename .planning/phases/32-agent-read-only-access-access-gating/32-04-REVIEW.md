---
phase: 32-agent-read-only-access-access-gating
reviewed: 2026-07-10T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - frontend/src/store/hooks/Admin/Invitations/useFetchBrokerageInvitations.tsx
  - frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx
  - frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.test.tsx
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 32-04: Code Review Report

**Reviewed:** 2026-07-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The core requirement of this gap-closure plan — never issuing `GET /v1/admin/invitations` for agent-role users — is implemented correctly. `useFetchBrokerageInvitations` correctly threads a new `options.enabled` flag into `useQuery({ enabled: options?.enabled ?? true })` using `??` (not `||`, which would have incorrectly coerced `false` back to `true`). `useBrokerageUsersAdminContext` computes `canManageUsers` via `usePermission('manage_users')`, which fails closed (`usePermission` returns `false` while the role hasn't loaded yet or is absent), so there is no window where an unresolved role results in an enabled fetch. Defense-in-depth is also present at the UI layer: `UsersAdminBoard.tsx` wraps `InvitationsView` in `<Can permission="manage_users">`, so the invitations UI is hidden for agents independent of the data-fetch gating. The new test file directly asserts the `enabled` flag passed to the hook for `agent` (false) and `admin` (true) roles, and both tests pass (`npx vitest run` verified locally).

No blocking defects were found. One pre-existing correctness risk in `useUsersAdminContext.tsx`'s `useMemo` dependency array is worth flagging because it is adjacent to (and currently masks) the new gating logic, plus a few minor quality items.

## Warnings

### WR-01: `useMemo` in `useBrokerageUsersAdminContext` omits `invitationsQuery`, `groupsQuery`, and `inviteFilter` from its dependency array

**File:** `frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx:42-60`
**Issue:** The returned `state` object reads `groupsQuery.data`, `invitationsQuery.data`, `invitationsQuery.data?.meta?.pagination`, and `invitationsQuery.isLoading`, but the `useMemo` dependency array only lists `[query, groupFilter, searchUsers, agentFilter, usersPage, invitationsPage]`. Neither `groupsQuery`, `invitationsQuery`, nor `inviteFilter` are included.

This currently "works" only by accident: `useFetchBrokerageUsers` (and every `useQuery`-based hook in this file) returns a fresh object literal `{ isLoading, data, isError, error, refetch }` on every render, so `query`'s reference changes on essentially every re-render of the component, which happens to force the `useMemo` to recompute whenever any sibling query (including `invitationsQuery`) updates and triggers a re-render. If `useFetchBrokerageUsers` (or any hook whose result is a dependency) is ever memoized/stabilized in the future — a very plausible refactor — this becomes a real stale-closure bug: the invitations list, invitations pagination meta, and the aggregate `isLoading` flag would stop updating when `invitationsQuery` transitions from disabled/empty (agent) to enabled/loaded (admin), or whenever invitations data changes on its own render cycle without `query`'s identity also changing.

This is directly adjacent to the new gating logic added in this plan (`canManageUsers` → `invitationsQuery`'s `enabled`), since the very hook whose data now depends on a permission check is one of the ones missing from the deps array.

**Fix:**
```tsx
}), [query, groupsQuery, invitationsQuery, groupFilter, searchUsers, agentFilter, inviteFilter, usersPage, invitationsPage])
```
Alternatively, run this through `eslint-plugin-react-hooks`'s `exhaustive-deps` rule (currently not enforceable in this checkout — `npx eslint` fails locally due to an unrelated ESM/CJS config issue in `.eslintrc.js`, which is itself worth fixing separately) to catch this class of bug automatically.

## Info

### IN-01: `onSearchInvite` parameter shadows the outer `query` binding

**File:** `frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx:56`
**Issue:** `onSearchInvite: (query: string) => { }` — the parameter `query` shadows the outer `const query = useFetchBrokerageUsers(...)` declared at line 26. The handler body is a no-op, so there's no active bug today, but the shadowing is confusing for future maintainers who might reasonably assume `query` inside this closure refers to the users query result, and any future implementation of this handler risks silently referencing the wrong `query`.
**Fix:** Rename the parameter, e.g. `onSearchInvite: (searchTerm: string) => { }`, and wire it to `setSearchInvites`/an actual invitation-search API call rather than leaving the handler as a stub (the stub itself also indicates invitation search filtering is not yet functional).

### IN-02: Test coverage for the gating change is narrow

**File:** `frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.test.tsx:39-49`
**Issue:** Only `agent` (no `manage_users`) and `admin` (has `manage_users`) are exercised. `owner` also has `manage_users` and `staff`/`client` also lack it (per `frontend/src/assets/rbac/permissions.ts`), but none of these are covered. There's also no test for the "role not yet loaded" state (`isUserLoaded === false`), which is the actual fail-closed path that protects against a flash of enabled fetching before the role resolves — this is arguably the most security-relevant case to lock down with a regression test, since it's what actually prevents an initial-render leak.
**Fix:** Add cases for `owner`, `staff`/`client`, and an explicit "role not loaded yet" scenario (e.g. omit `membership` from `preloadedState.account` or set `account.id: ''`) asserting `enabled: false`.

### IN-03: `useFetchBrokerageInvitations` doesn't set `keepPreviousData`, unlike the sibling users query

**File:** `frontend/src/store/hooks/Admin/Invitations/useFetchBrokerageInvitations.tsx:12-21`
**Issue:** `useFetchBrokerageUsers` sets `keepPreviousData: true` so pagination doesn't flash an empty/loading state between pages. `useFetchBrokerageInvitations` doesn't, so paging through invitations (for admin/owner users) will briefly show a loading/empty state on every page change, inconsistent with the users table UX.
**Fix:**
```tsx
const { isLoading, data, isError, error, refetch } = useQuery({
    queryKey: brokerageInvitationsKeys.list({ ...params }),
    queryFn: async () => fetchBrokerageInvitations(params),
    retry: false,
    enabled: options?.enabled ?? true,
    keepPreviousData: true,
    onError: (err: AxiosErrorType) => { ... }
})
```

---

_Reviewed: 2026-07-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
