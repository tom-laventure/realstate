---
phase: 01-security-foundation
fixed_at: 2026-05-01T00:00:00Z
review_path: .planning/phases/01-security-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-05-01
**Source review:** `.planning/phases/01-security-foundation/01-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (3 Critical, 7 Warning; CR-011 Info excluded by fix_scope)
- Fixed: 10
- Skipped: 0

## Fixed Issues

### CR-001: Origin header trusted over Host — full tenant isolation bypass

**Files modified:** `backend/app/controllers/concerns/brokerage_auth.rb`
**Commit:** e7de7fc
**Applied fix:** Removed the entire Origin header preference block. `extract_domain_from_request` now returns `request.host.downcase` unconditionally, eliminating the attacker-controlled tenant bypass.

---

### CR-002: GroupEstatesQuery raw SQL subqueries missing soft-delete guard on group_estates

**Files modified:** `backend/app/queries/group_estates_query.rb`
**Commit:** eb4e081
**Applied fix:** Rewrote the raw SQL subqueries in `filter_by_rejection`, `filter_by_min_user_rating`, `filter_by_pending_review`, and `filter_by_favorites` to use an explicit `JOIN group_estates ge ON ge.estate_id = estates.id AND ge.group_id = ? AND ge.deleted_at IS NULL` pattern, ensuring deleted group_estate rows are excluded from all filter result sets. Fixed alongside CR-006 and CR-007 (same file, one atomic commit).

---

### CR-003: UsersListView delete-user confirmation is a no-op

**Files modified:** `frontend/src/components/view/admin/usersAdminView/UsersListView.tsx`, `frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx`
**Commit:** 9c947a7
**Applied fix:** Added `onDeleteUser: (userId: string) => void` prop to `UsersListViewProps`, updated the destructuring in the component signature, and called `onDeleteUser(confirmPopup.id)` in `handleConfirmDeleteUser` before clearing the popup. In `UsersAdminBoard`, imported and instantiated `useDeleteUserFromBrokerage`, created a `handleDeleteUser` wrapper calling `deleteUser({ userId })`, and passed it as `onDeleteUser` to `UsersListView`.

---

### CR-004: GroupEstate soft-delete not guarded in set_group_estate (3 dashboard controllers)

**Files modified:** `backend/app/controllers/v1/dashboard/group/estate_comments_controller.rb`, `backend/app/controllers/v1/dashboard/group/estate_documents_controller.rb`, `backend/app/controllers/v1/dashboard/group/estates_controller.rb`
**Commit:** b5dfcc8
**Applied fix:** Changed `GroupEstate.find_by!(...)` to `GroupEstate.without_deleted.find_by!(...)` in `set_group_estate` across all three controllers, preventing soft-deleted group memberships from being found and accepted.

---

### CR-005: NotificationsController `read` action missing brokerage scope

**Files modified:** `backend/app/controllers/v1/dashboard/notifications_controller.rb`
**Commit:** 02a27e5
**Applied fix:** Added `.joins(:group).where(groups: {brokerage_id: Current.brokerage.id})` to the notification lookup in the `read` action, matching the same brokerage scoping already present in the `index` action.

---

### CR-006: filter_by_source uses unvalidated filter_set_id from URL param

**Files modified:** `backend/app/queries/group_estates_query.rb`
**Commit:** eb4e081
**Applied fix:** Added `return scope unless @group.group_filter_sets.exists?(id: filter_set_id)` before the SQL EXISTS clause in the `filter_set:<id>` branch of `filter_by_source`, ensuring the filter set belongs to the current group before using its ID in a query. Fixed alongside CR-002 and CR-007 (same file, one atomic commit).

---

### CR-007: sanitize_sql_array called via .send on private method

**Files modified:** `backend/app/queries/group_estates_query.rb`
**Commit:** eb4e081
**Applied fix:** Replaced all four `ActiveRecord::Base.send(:sanitize_sql_array, ...)` calls with the public `ActiveRecord::Base.sanitize_sql_array(...)` form across `filter_by_rejection`, `filter_by_min_user_rating`, `filter_by_min_group_rating`, `filter_by_pending_review`, and `filter_by_favorites`. Fixed alongside CR-002 and CR-006 (same file, one atomic commit).

---

### CR-008: BoardCredentialsController dev path writes raw ciphertext columns and skips validations

**Files modified:** `backend/app/controllers/v1/admin/board_credentials_controller.rb`
**Commit:** e3842ff
**Applied fix:** Removed the `if Rails.env.development?` branch that wrote to `rets_username_ciphertext`/`rets_password_ciphertext` directly and called `save(validate: false)`. Now uses `credential.rets_username = username` and `credential.rets_password = password` unconditionally (the normal encrypted accessors), and `credential.save` with full validations in all environments.

---

### CR-009: GroupEstatesController active_listings_count missing without_deleted

**Files modified:** `backend/app/controllers/v1/admin/group/estates_controller.rb`
**Commit:** aa4cc5c
**Applied fix:** Changed `group.estates.count` to `group.estates.without_deleted.count` so soft-deleted estates are excluded from the active listing count shown in the admin UI.

---

### CR-010: GroupsController total_active_filters counts filters from soft-deleted groups

**Files modified:** `backend/app/controllers/v1/admin/groups_controller.rb`
**Commit:** ccbcb4d
**Applied fix:** Added `deleted_at: nil` to the `where(groups: {...})` condition in the `total_active_filters` query so filters belonging to soft-deleted groups are excluded from the brokerage-level stat.

---

_Fixed: 2026-05-01_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
