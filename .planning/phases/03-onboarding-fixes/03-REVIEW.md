---
phase: 03-onboarding-fixes
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - frontend/src/containers/dashboard/home/HomepageContext.tsx
  - frontend/src/containers/dashboard/home/Homepage.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 03: Code Review Report (Gap Closure — Welcome Banner)

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

These two files implement the Homepage context and view for the welcome-banner gap closure (plan steps 03-05). The overall structure follows the established Context/hook pattern correctly. One critical type-safety bug is present: the code accesses `.id` on a `group` object whose TypeScript interface only declares `.uid`, and at runtime the API actually sends the `id` key — meaning `.uid` is always `undefined` while `.id` is used without type coverage. Three warnings cover a `useMemo` stability problem caused by a non-memoized derived array in deps, a silent error UX regression when banner dismissal fails, and incomplete group coverage in the banner for users in more than six groups. Two informational items cover a redundant `useNavigate` instantiation and a stale `onError` pattern.

---

## Critical Issues

### CR-01: `group` type declares `.uid` but runtime access uses `.id` — `singleGroupId` is always `undefined` per TypeScript types

**File:** `frontend/src/containers/dashboard/home/HomepageContext.tsx:108`

**Issue:** `redirectGroups` is typed as `group[]`, where the `group` interface (in `assets/types/groupType.ts`) declares `uid: string` and has no `id` field. Line 108 accesses `redirectGroups[0].id`. With `"strict": true` in `tsconfig.json`, this is a type error — `.id` does not exist on `group`.

At runtime the value of `.id` is defined (the `GroupSerializer` serializes `def id; object.uid; end`, so the JSON key is `id`), but `.uid` is always `undefined` at runtime because the JSON never contains a `uid` key. The type and the runtime contract are inverted:

- TypeScript thinks: `group.uid` is valid, `group.id` does not exist.
- Runtime reality: `group.uid` is `undefined`, `group.id` holds the correct value.

The single-group redirect (`singleGroupId`) works today only because the runtime value happens to be correct, but the `group` type used by every other consumer of `useFetchUserGroups` (e.g., `GroupsSection`, `selectGroup`) will silently receive `undefined` for `.uid` wherever that field is used. The canonical fix is to reconcile the type with the serializer contract.

**Fix — Option A (preferred): align the `group` interface to match what the API sends:**
```ts
// assets/types/groupType.ts
interface group {
    id: string      // was `uid`; the serializer sends `id` (mapped from uid)
    name: string
    createdAt: string
    updatedAt: string
    active: boolean
    memberCount: number
    lastActiveAt: string | null
}
```
Then update all call sites that reference `.uid` to use `.id`.

**Fix — Option B: keep `uid` in the type but fix the serializer to send `uid` as the key:**
```ruby
# group_serializer.rb
attributes :name, :uid, :created_at, :updated_at, :active, :last_active_at
# remove the `def id` override
```
Then update `HomepageContext.tsx:108` to `redirectGroups[0].uid`.

---

## Warnings

### WR-01: `groupNames` derived array breaks `useMemo` stability — context value recreated on every render

**File:** `frontend/src/containers/dashboard/home/HomepageContext.tsx:101, 172`

**Issue:** `groupNames` is computed on line 101 with `.map()`, which creates a new array reference on every render. It is placed directly in the `useMemo` dependency array at line 172. Because the array reference changes every render (even when the underlying data is unchanged), the `useMemo` re-runs on every render cycle regardless of whether any actual data changed. This defeats the purpose of `useMemo` for the context value and causes every consumer of `useHomepageContext` to re-render on every parent render.

**Fix:** Derive `groupNames` inside the `useMemo` body, or stabilize it with its own `useMemo` keyed on `groupsQuery.data`:
```tsx
// Option A — derive inside the outer useMemo:
return useMemo(() => {
    const groupNames = (groupsQuery.data?.groups ?? []).map((g: { name: string }) => g.name)
    return {
        state: {
            ...
            groupNames,
        },
        ...
    }
}, [
    // replace `groupNames` dep with `groupsQuery.data`
    groupsQuery.data,
    ...
])
```

```tsx
// Option B — own useMemo:
const groupNames = useMemo(
    () => (groupsQuery.data?.groups ?? []).map((g: { name: string }) => g.name),
    [groupsQuery.data]
)
```

---

### WR-02: Banner dismissed optimistically — API failure leaves backend state inconsistent with no user feedback

**File:** `frontend/src/containers/dashboard/home/HomepageContext.tsx:95-98`

**Issue:** `dismissBanner` calls `setBannerVisible(false)` before firing `dismissMutation.mutate()`. The `onError` handler in `useDismissWelcome` only calls `console.error` — it does not restore `bannerVisible` to `true`. If the API call fails (network error, 404 membership not found, etc.), the banner disappears from the UI permanently for the current session, but `welcomed_at` in the database remains `null`. On the next page load, the backend will again return `showWelcomeBanner: true` and the banner will reappear, creating a confusing on/off cycle that the user cannot resolve.

**Fix:** Either restore visibility on error or show a toast:
```tsx
const dismissBanner = useCallback(() => {
    setBannerVisible(false)
    dismissMutation.mutate(undefined, {
        onError: () => {
            setBannerVisible(true)  // restore on failure
            toast.error('Could not dismiss the banner. Please try again.')
        },
    })
}, [dismissMutation])
```

---

### WR-03: Banner group names truncated at first page (max 6 groups) — users with more groups see incomplete list

**File:** `frontend/src/containers/dashboard/home/HomepageContext.tsx:79, 101`

**Issue:** `useFetchAccountGroups` is called with `{ pagination: { page: 1 } }` and no `perPage` override. `fetchAccountGroups` spreads the pagination object as `params: { ...pagination }`, which sends only `page=1` — no `per_page`. The backend `groups_controller.rb` defaults to `items: params[:per_page].presence || 6`, meaning at most 6 group names are fetched. A user who is a member of 7 or more groups will see an incomplete list in the welcome banner with no indication that more groups exist.

**Fix:** Either pass a high `perPage` value sufficient to cover realistic group membership, or use `paginate=false` if the endpoint supports it:
```tsx
const groupsQuery = useFetchAccountGroups({ pagination: { page: 1, perPage: 50 } })
```
If the backend `/v1/account/groups` endpoint does not yet support `paginate=false`, add that support (per the CLAUDE.md pattern) for this use case.

---

## Info

### IN-01: `Homepage` instantiates a redundant `useNavigate` — navigation responsibility already split correctly

**File:** `frontend/src/containers/dashboard/home/Homepage.tsx:11`

**Issue:** `Homepage` calls `useNavigate()` at line 11 for the single-group redirect effect. `HomepageContext` also calls `useNavigate()` at line 16 for the `selectGroup` action. Both instances are valid React Router hooks and functionally correct, but the duplication could suggest that the single-group redirect logic belongs in the context (alongside the existing `isSingleGroup`/`singleGroupId` state) rather than in the component. This is a minor coupling concern, not a bug.

**Suggestion:** Move the redirect `useEffect` into `HomepageContext` alongside the `isSingleGroup` derivation, where the navigation logic already lives (`selectGroup`). The component can then remain a pure render layer with no direct `useNavigate` dependency.

---

### IN-02: `useGetAccountProfile` uses deprecated TanStack Query v5 `onError` option

**File:** `frontend/src/store/hooks/Account/useGetAccountProfile.tsx:12-15`

**Issue:** The `onError` callback on `useQuery` was removed in TanStack Query v5. It is silently ignored — the `toast.error('Failed to fetch profile')` call will never execute on profile fetch failure. This means `HomepageContext`'s banner hydration (`profileQuery.data?.showWelcomeBanner`) will silently fail to load with no user-visible error when the profile endpoint is unreachable.

This same issue was flagged as WR-04 in the prior review for `useFetchDashboardBrokerage`. The same fix applies:

**Fix:**
```tsx
const useGetAccountProfile = () => {
    const { isLoading, data, isError, error, refetch } = useQuery({
        queryKey: accountProfileKeys.all,
        queryFn: getAccountProfile,
        retry: false,
    })

    useEffect(() => {
        if (error) {
            toast.error('Failed to fetch profile')
            console.error('Failed to fetch profile:', error)
        }
    }, [error])

    return { isLoading, data: data?.user, isError, error, refetch }
}
```

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
