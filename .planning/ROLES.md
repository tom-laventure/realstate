# Roles

Reference for the 5 brokerage roles: what each is for, how access is enforced today, and known gaps. Read this before adding any role-gated feature (backend endpoint or frontend guard/permission).

Single source of truth for the role list itself: `backend/app/constants/roles.rb` (`BROKERAGE_ROLES = %w[owner admin agent staff client]`). Everything below describes how that list is *used* — those usages are not centrally enforced and can drift from this doc; treat file:line pointers as "last known location," not guaranteed current.

## Summary

| Role | Purpose | Scope | Backend check | Frontend permission | Notes |
|---|---|---|---|---|---|
| `owner` | Brokerage founder/principal. Full control including irreversible actions (assigning the owner role, custom domain management). | Brokerage-wide | `require_owner!` (`admin/base_controller.rb`) | `access_admin_panel`, `manage_brokerage_settings`, `manage_users`, `manage_groups` | Only an existing owner can promote another user to owner (`admin/users_controller.rb:107`). |
| `admin` | Day-to-day brokerage administration (users, groups, invitations, board credentials). | Brokerage-wide | `require_admin!` (`admin/base_controller.rb`) — allows `owner` or `admin` | `access_admin_panel`, `manage_users`, `manage_groups` | Cannot manage brokerage-level settings (billing/branding) or assign the owner role. |
| `agent` | Brokerage staff member who works with clients (listings, groups, estates). | Brokerage-wide (counted as a "member") | No dedicated backend check yet — falls through to whatever the endpoint requires | *(none defined — see Gaps)* | Included in `member_count` alongside `staff`/`owner`/`admin` (`admin_brokerages_controller.rb:41`). |
| `staff` | Non-agent brokerage employee (e.g. coordinator, support). | Brokerage-wide (counted as a "member") | No dedicated backend check yet | *(none defined — see Gaps)* | Same membership counting as `agent`. |
| `client` | End customer (homebuyer/seller) working with the brokerage. | **Group-scoped**, not brokerage-wide | Invited at the group level, not brokerage level (`admin/invitations_controller.rb:40` rejects `role == "client"` for brokerage-level invites) | *(none — clients don't use the admin app)* | Explicitly excluded from `member_count`; tracked separately as `client_count` (`admin_brokerages_controller.rb:50`). Membership scope for a client is really "which groups am I in" (`user_groups` table), not a brokerage role in the same sense as the other four. |

## Roles in detail

### owner
The brokerage's principal account. Every brokerage has exactly one path to create an owner: whoever completes onboarding gets `role: "owner"` on their membership (`onboarding/brokerages_controller.rb:87`). Owner is required for anything that changes who else can become an owner, and (per code comments) for custom domain mutations (`admin/domains_controller.rb:5`).

### admin
Trusted staff who can run the brokerage day-to-day but shouldn't hold the irreversible powers reserved for `owner`. `require_admin!` treats `owner` and `admin` as equivalent for most admin endpoints — if a route needs to be *owner-only*, it must explicitly call `require_owner!` instead (see `require_owner!` in `admin/base_controller.rb`, currently unused outside that definition — confirm current call sites before relying on this).

### agent / staff
Both are "member" roles with no admin capabilities. As of this writing, `ROLE_PERMISSIONS` in the frontend (`assets/rbac/permissions.ts`) maps both to `[]` — this reflects that no agent/staff-specific features have been built yet, **not** a deliberate decision that these roles should always be permissionless. Don't assume `[]` is intentional when adding a feature aimed at agents or staff — check current requirements first.

### client
Structurally different from the other four roles. A client isn't invited to the brokerage as a whole — they're invited into a specific `group` (`admin/invitations_controller.rb:40`), and their access is scoped to the estates/data visible to that group. Backend counts of "brokerage members" deliberately exclude `client` (`member_roles = %w[agent staff owner admin]`, `admin_brokerages_controller.rb:41`). Clients never authenticate into the admin app, so no frontend permission exists for them.

## Known gaps

- **`agent`/`staff` have zero frontend permissions.** Not a design decision — just nothing built for these roles yet. Verify against current requirements before treating this as settled behavior.
- **Backend enforcement is inconsistent.** `admin/base_controller.rb` centralizes `require_admin!`/`require_owner!`, but other controllers do it inline — e.g. `onboarding/domains_controller.rb:38` re-implements the same `owner`/`admin` check ad hoc (`membership&.role&.in?(%w[owner admin])`) instead of reusing the shared pattern. New code should converge toward the shared pattern (see below), not add a third variant.

## Gating a new feature

- **Backend:** if the endpoint lives under (or can live under) `V1::Admin`, inherit from `Admin::BaseController` and use `require_admin!` or `require_owner!`. If it can't (e.g. it's outside the `/v1/admin/**` namespace but still needs a role check), replicate the same membership lookup pattern rather than inventing a new one — don't add another one-off `membership&.role&.in?(...)` check.
- **Frontend:** add a new entry to the `Permission` union and `ROLE_PERMISSIONS` map in `assets/rbac/permissions.ts`, then gate UI with `<Can permission="...">` (component-level) or `RequireRole` (route-level). Avoid comparing `role` strings directly in components — that bypasses the permission map and makes the mapping harder to audit.
