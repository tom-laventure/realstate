# Phase 31: Agent Dashboard Access & Group Management - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 7 (all modified, no new files — this phase is gate-widening, not scaffolding)
**Analogs found:** 7 / 7

All files in this phase are **modifications to existing files**, not net-new files. Because every file has itself (or a structurally identical sibling) as the closest analog, this map focuses on the exact line ranges to change and the established conventions each change must follow, rather than a separate "analog file" for each target.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|----------------|------|-----------|-----------------|---------------|
| `frontend/src/components/common/shells/appShellAdmin/AppShellAdmin.tsx` | component (route gate) | request-response | itself — one-line array literal change | exact |
| `backend/app/controllers/v1/account/admin_brokerages_controller.rb` | controller | CRUD (read) | `backend/app/controllers/v1/admin/base_controller.rb` (`require_agent_or_above!`) | role-match (established `%w[owner admin agent]` convention) |
| `frontend/src/assets/rbac/permissions.ts` | config (RBAC map) | transform | itself — add one array value to `ROLE_PERMISSIONS.agent` | exact |
| `frontend/src/components/sidenav/SideNav.tsx` | component | request-response | itself — filter existing nav-item array by permission before render | exact |
| `frontend/src/components/sidenav/useSideNavContext.ts` | hook | request-response | itself — expose one more derived boolean/role from `usePermission`/`useRole` | exact |
| `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` | component | request-response | `frontend/src/components/sidenav/SideNav.tsx` (Admin section, `canAccessAdmin` gating pattern) + `useSideNavContext.ts` (permission hook usage) | role-match |
| `frontend/src/components/common/guards/RequireRole.test.tsx` (new assertions, not new file) | test | request-response | itself — existing agent-role fixtures already present, add a passing case | exact |

## Pattern Assignments

### `frontend/src/components/common/shells/appShellAdmin/AppShellAdmin.tsx` (component, route gate)

**Analog:** itself (`frontend/src/components/common/shells/appShellAdmin/AppShellAdmin.tsx`, line 29)

**Current code (line 29):**
```tsx
<RequireRole roles={['owner', 'admin']}>
    <Outlet />
</RequireRole>
```

**Required change (D-02):** add `'agent'` to the array — no other structural change needed:
```tsx
<RequireRole roles={['owner', 'admin', 'agent']}>
    <Outlet />
</RequireRole>
```

**Underlying gate mechanics** — `frontend/src/components/common/guards/RequireRole.tsx` (full file, 31 lines, already read in full):
```tsx
const RequireRole = ({ roles, redirectTo = '/', children }: RequireRoleProps) => {
    const { role, isUserLoaded } = useRole()

    // On the main domain, portal access is validated upstream by PortalShell's
    // brokerage validation. RequireRole reads account.membership?.role which is
    // never populated on the main domain — bypass to avoid blank panels.
    if (isMainDomain()) return <>{children}</>

    if (!isUserLoaded) return null

    if (!role || !roles.includes(role)) {
        return <Navigate to={redirectTo} replace />
    }

    return <>{children}</>
}
```
No changes needed to `RequireRole.tsx` itself — confirmed no-op on main domain per its own comment, consistent with D-01's separate main-domain fix.

---

### `backend/app/controllers/v1/account/admin_brokerages_controller.rb` (controller, CRUD read, D-01)

**Analog:** `backend/app/controllers/v1/admin/base_controller.rb` lines 13-17 (establishes the `%w[owner admin agent]` role-array convention already used elsewhere in the codebase for "agent and above" checks):
```ruby
def require_agent_or_above!
  unless current_membership && %w[owner admin agent].include?(current_membership.role)
    render_forbidden
  end
end
```

**Target change** — `backend/app/controllers/v1/account/admin_brokerages_controller.rb` line 22, inside `#index`:
```ruby
admin_memberships = BrokerageMembership
  .without_deleted
  .includes(:brokerage)
  .where(user_id: Current.user.id, role: %w[admin owner])
```
Change `role: %w[admin owner]` to `role: %w[admin owner agent]`.

**Downstream consequence to verify (not a code change, a read-check):** line 25-27's dedup logic and lines 43-57's per-brokerage aggregation already treat `role` generically (`m.role`) and `owners` is separately filtered to `r.role == "owner"` (line 53) — agents will not leak into `owners`. `member_roles` on line 41 (`%w[agent staff owner admin]`) already includes `agent`, so `member_count` is unaffected. No other line in this file needs to change.

**Response shape note (Claude's Discretion item):** the `admin_brokerages` key name and `role` field are already generic enough to carry `"agent"` as a value with no schema change — no renaming needed.

---

### `frontend/src/assets/rbac/permissions.ts` (config, RBAC map)

**Analog:** itself, full file (21 lines, already read in full):
```typescript
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    owner: ['access_admin_panel', 'manage_brokerage_settings', 'manage_users', 'manage_groups'],
    admin: ['access_admin_panel', 'manage_users', 'manage_groups'],
    agent: [],
    staff: [],
    client: [],
}
```

**Required change (locked decision, not discretionary):**
```typescript
agent: ['access_admin_panel', 'manage_groups'],
```
No new `Permission` union values — reuse the existing 4. `hasPermission`/`usePermission`/`Can` all key off this map with no other code changes required; `Can permission="manage_groups"` on `GeneralDashboard.tsx` line 64 and `useSideNavContext.ts`'s `canAccessAdmin` (`usePermission('access_admin_panel')`, line 9) pick this up automatically.

---

### `frontend/src/components/sidenav/useSideNavContext.ts` (hook) + `frontend/src/components/sidenav/SideNav.tsx` (component) — subdomain Admin nav narrowing (D-03)

**Analog:** itself — current full files already read in full (51 lines and 276 lines respectively).

**Current hook shape** — `useSideNavContext.ts` lines 6-9, 27-47:
```typescript
const useSideNavContext = () => {
    const navigate = useNavigate()
    const { groupId } = useParams<{ groupId?: string }>()
    const canAccessAdmin = usePermission('access_admin_panel')
    ...
    return useMemo(() => ({
        state: { groupId, hasGroupContext, selectedGroup, isLoadingSelectedGroup, canAccessAdmin },
        actions: { goToHome, navigateTo },
    }), [groupId, hasGroupContext, selectedGroup, isLoadingSelectedGroup, canAccessAdmin, goToHome, navigateTo])
}
```

**Suggested extension (Claude's Discretion — keep `canAccessAdmin` reusable for Phase 32):** add a second derived boolean, e.g. `isGroupsOnlyAdmin` (or `role === 'agent'` via `useRole`), to `state`, and include it in the `useMemo` dependency array — do not replace `canAccessAdmin`, since Phase 32 will reuse it unmodified to gate the *whole* Admin section while this new flag narrows *which items* render inside it.

**Current nav-item render block** — `SideNav.tsx` lines 199-257 (the `state.canAccessAdmin &&` block), each item is a hardcoded `NavButton`:
```tsx
{state.canAccessAdmin && (
    <>
        <div className="my-1 h-px bg-sidebar-border" />
        <div>
            <button onClick={() => setAdminOpen(o => !o)} ...>Admin</button>
            {adminOpen && (
                <div className="mt-0.5 space-y-0.5">
                    <NavButton label="Brokerage" ... path="/admin/brokerage" onNavigate={handleNavigate} />
                    <NavButton label="Board Registrations" ... path="/admin/boards" onNavigate={handleNavigate} />
                    <NavButton label="Users" ... path="/admin/users" onNavigate={handleNavigate} />
                    <NavButton label="Listing Groups" ... path="/admin/groups" onNavigate={handleNavigate} />
                    <NavButton label="Domains" ... path="/admin/domains" onNavigate={handleNavigate} />
                    <NavButton label="Settings" ... path="/admin/settings" exact onNavigate={handleNavigate} />
                </div>
            )}
        </div>
    </>
)}
```

**Required change:** wrap each non-Groups `NavButton` with the new discretionary flag (e.g. `!state.isGroupsOnlyAdmin && <NavButton .../>`), or conditionally build an array of item descriptors and `.filter()` before mapping (mirrors the array-driven pattern already used in `PortalAdminSideNav.tsx`'s `items` array below). Keep `Listing Groups`/`/admin/groups` unconditional inside the `canAccessAdmin` block for all roles.

---

### `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` (component) — main-domain Admin nav narrowing (D-03)

**Analog:** `frontend/src/components/sidenav/SideNav.tsx`'s array-of-items → `.map()` render pattern is the structural analog for the `items` array already present in this file, and `useSideNavContext.ts`'s `usePermission`/`useRole` usage is the analog for *how* to gate it (per CLAUDE.md's Component → Context → Hook rule — do not do a raw string role comparison).

**Current code — full file already read in full (47 lines), currently zero permission gating:**
```tsx
const items = [
    { label: 'Brokerage', icon: Building2, path: '/admin/brokerage' },
    { label: 'Board Registrations', icon: ClipboardList, path: '/admin/boards' },
    { label: 'Users', icon: Users, path: '/admin/users' },
    { label: 'Groups', icon: Layers3, path: '/admin/groups' },
    { label: 'Domains', icon: Globe, path: '/admin/domains' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
]

const PortalAdminSideNav = () => {
    const location = useLocation()
    const navigate = useNavigate()

    return (
        <aside ...>
            <nav className="flex-1 space-y-0.5 p-2">
                {items.map(({ label, icon: Icon, path }) => { ... })}
            </nav>
        </aside>
    )
}
```

**Required change (Claude's Discretion on exact mechanism):** add a permission or role check per item, e.g. tag each item with a `groupsOnly?: boolean` or filter the array using `usePermission`/`useRole` (per CLAUDE.md, prefer the existing `usePermission` hook over ad-hoc role string comparisons, matching `useSideNavContext.ts`'s convention):
```tsx
import useRole from '@/store/hooks/Auth/useRole'
// ...
const PortalAdminSideNav = () => {
    const { role } = useRole()
    const visibleItems = role === 'agent' ? items.filter(i => i.label === 'Groups') : items
    // ...
    {visibleItems.map(({ label, icon: Icon, path }) => { ... })}
}
```
Note this file has **no existing gating to preserve** (unlike `SideNav.tsx`'s `canAccessAdmin` wrapper) — it renders unconditionally today for whoever reaches `PortalAdminShell`, so this is a net-new filter, not a narrowing of an existing one.

---

### Test pattern — `frontend/src/components/common/guards/RequireRole.test.tsx`

**Analog:** itself, full file already read in full (88 lines). Already has `loadedAgentState` fixture (lines 19-29) used today to assert agent is **redirected** (line 51-68, `roles={['admin']}`). Phase 31 will make agent a *passing* role for `AppShellAdmin`'s actual gate (`['owner','admin','agent']`), so a new `it(...)` block should assert:
```tsx
it('renders children when agent role is included in allowed roles', () => {
  renderWithProviders(
    <Routes>
      <Route path="/" element={
        <RequireRole roles={['owner', 'admin', 'agent']}>
          <div>Admin Panel</div>
        </RequireRole>
      } />
      <Route path="/no-access" element={<div>No Access</div>} />
    </Routes>,
    { route: '/', preloadedState: loadedAgentState }
  )
  expect(screen.getByText('Admin Panel')).toBeInTheDocument()
})
```
Reuse `loadedAgentState` as-is — no new fixture needed.

**Backend test convention** — only one backend controller test exists in the repo today: `backend/test/controllers/v1/domains_controller_test.rb` (Minitest `ActionDispatch::IntegrationTest`, `require "test_helper"`, `create(:factory_name)` via FactoryBot, `test "description" do ... end` blocks, `assert_response`/`JSON.parse(response.body)`). No test file currently exists for `V1::Account::AdminBrokeragesController` — if a test is added for the D-01 change, follow this file's structure (class name `V1::Account::AdminBrokeragesControllerTest`, `setup do` block creating a brokerage + memberships via factories, `assert_response :ok` + JSON body assertions on `admin_brokerages` including an agent-role brokerage).

---

## Shared Patterns

### Permission-based UI gating
**Source:** `frontend/src/components/common/guards/Can.tsx` (full file, 17 lines) + `frontend/src/store/hooks/Auth/usePermission.ts` (full file, 11 lines)
**Apply to:** No new call sites needed this phase — `Can permission="manage_groups"` on `frontend/src/containers/dashboard/general/GeneralDashboard.tsx` line 64 and `canAccessAdmin` (`usePermission('access_admin_panel')`) in `useSideNavContext.ts` line 9 both pick up the new `ROLE_PERMISSIONS.agent` entries automatically once `permissions.ts` is updated — no code changes to `Can.tsx`, `usePermission.ts`, or `GeneralDashboard.tsx`.
```tsx
const usePermission = (permission: Permission): boolean => {
    const { role, isUserLoaded } = useRole()
    if (!isUserLoaded || !role) return false
    return hasPermission(role, permission)
}
```

### Role-array convention (backend)
**Source:** `backend/app/controllers/v1/admin/base_controller.rb` lines 13-30 (`require_agent_or_above!`, `require_admin!`, `require_owner!`)
**Apply to:** `admin_brokerages_controller.rb`'s `%w[admin owner]` → `%w[admin owner agent]` change — matches the existing `%w[owner admin agent]` idiom used elsewhere for "agent and above" checks. No new before_action needed since this controller does its own inline query filtering rather than a gate.

### Main-domain vs. subdomain dual gating
**Source:** `frontend/src/router/admin/AdminDomainShell.tsx` (full file, 12 lines) — `isMainDomain() ? <PortalAdminShell /> : <AppShellAdmin />`
**Apply to:** Both `AppShellAdmin.tsx` (`RequireRole`) and `PortalAdminSideNav.tsx` (new nav filter) must be updated in tandem — they are two independent code paths for the same logical "agent can reach admin/groups" requirement. Confirmed via `RequireRole.tsx`'s own `isMainDomain()` early-return: subdomain gate fixes have zero effect on the main-domain path, and vice versa.

## No Analog Found

None. Every file in scope is an existing file with itself as the exact-match analog (this phase widens existing gates rather than introducing new architectural patterns).

## Metadata

**Analog search scope:** `frontend/src/components/common/{shells,sidenav,guards}`, `frontend/src/assets/rbac`, `frontend/src/store/hooks/Auth`, `frontend/src/assets/types`, `frontend/src/containers/dashboard/general`, `backend/app/controllers/v1/{account,admin}`, `backend/test/controllers`
**Files scanned:** 16
**Pattern extraction date:** 2026-07-09
