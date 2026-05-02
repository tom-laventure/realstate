---
phase: 01-security-foundation
depth: standard
files_reviewed: 41
status: findings
findings:
  critical: 3
  warning: 7
  info: 1
  total: 11
---

# Phase 01 Code Review

## Summary

41 files reviewed across the backend Rails API and React/TypeScript frontend. Three critical issues were found: a tenant-isolation bypass via Origin header trust in BrokerageAuth, soft-delete leaks on group_estates joins throughout the query layer, and a non-functional delete-user confirmation in the admin frontend. Seven additional warnings cover authorization gaps, an unguarded filter_set_id enumeration risk, a fragile private-method call, a dev-path credential bypass, and soft-delete gaps in three controllers. One info item covers an effectively dead rate-limit rule.

## Findings

### CR-001 [CRITICAL] Origin header trusted over Host — full tenant isolation bypass
**File:** `backend/app/controllers/concerns/brokerage_auth.rb:26-30`
**Issue:** `extract_domain_from_request` prefers the `Origin` header over the `Host` header when resolving the current brokerage. The `Origin` header is entirely attacker-controlled — any client can set it to any value. An authenticated user of brokerage A can include `Origin: https://brokerage-b.realstate.ca` on every request, causing `Current.brokerage` to resolve to brokerage B, bypassing all per-brokerage data scoping.
**Impact:** Complete multi-tenant data isolation bypass. Any authenticated user can read and write data belonging to any other brokerage on the platform.
**Fix:** Remove the Origin header preference entirely. Use `request.host.downcase` unconditionally:
```ruby
def extract_domain_from_request
  request.host.downcase
end
```

### CR-002 [CRITICAL] GroupEstatesQuery raw SQL subqueries missing soft-delete guard on group_estates
**File:** `backend/app/queries/group_estates_query.rb:44-52, 191-199, 234-244, 257-264`
**Issue:** Methods `filter_by_rejection`, `filter_by_min_user_rating`, `filter_by_pending_review`, and `filter_by_favorites` embed raw SQL correlated subqueries referencing `group_estates` without `AND group_estates.deleted_at IS NULL`. When GroupEstate rows are soft-deleted, old deleted rows remain and subqueries match against them, producing incorrect filter results.
**Impact:** Incorrect filter behavior after any group estate removal/restore cycle. Deleted group_estate state leaks into user-visible results. Per CLAUDE.md: "Guard the joined model too."
**Fix:** Add `AND group_estates.deleted_at IS NULL` to every raw SQL subquery referencing group_estates. Example for `filter_by_rejection`:
```ruby
scope.where(
  ActiveRecord::Base.sanitize_sql_array([
    "NOT EXISTS (
      SELECT 1 FROM estate_rejections er
      JOIN group_estates ge ON ge.estate_id = estates.id
        AND ge.group_id = ? AND ge.deleted_at IS NULL
      WHERE er.group_estate_id = ge.id AND er.user_id = ?
    )",
    @group.id, @current_user.id
  ])
)
```

### CR-003 [CRITICAL] UsersListView delete-user confirmation is a no-op
**File:** `frontend/src/components/view/admin/usersAdminView/UsersListView.tsx:62-65`
**Issue:** `handleConfirmDeleteUser` closes the confirmation popup but never calls any delete API or mutation. The trash icon and confirmation dialog appear functional but the operation silently does nothing.
**Impact:** Admins cannot remove users from the brokerage via this UI path. The feature is entirely broken despite appearing to work.
**Fix:** Add an `onDeleteUser: (userId: string) => void` prop and call it in `handleConfirmDeleteUser`:
```tsx
const handleConfirmDeleteUser = () => {
    if (!confirmPopup) return
    onDeleteUser(confirmPopup.id)
    setConfirmPopup(null)
}
```

### CR-004 [WARNING] GroupEstate soft-delete not guarded in set_group_estate (3 dashboard controllers)
**Files:**
- `backend/app/controllers/v1/dashboard/group/estate_comments_controller.rb`
- `backend/app/controllers/v1/dashboard/group/estate_documents_controller.rb`
- `backend/app/controllers/v1/dashboard/group/estates_controller.rb`
**Issue:** All three `set_group_estate` methods call `GroupEstate.find_by!(group: @group, estate: estate)` without `.without_deleted`. Soft-deleted GroupEstate records are found and accepted, allowing users to post comments, upload documents, and rate estates no longer active in the group.
**Impact:** Post-removal interactions succeed against invalid group memberships; potential NoMethodError in serializers on soft-deleted associations.
**Fix:** `@group_estate = GroupEstate.without_deleted.find_by!(group: @group, estate: estate)`

### CR-005 [WARNING] NotificationsController `read` action missing brokerage scope
**File:** `backend/app/controllers/v1/dashboard/notifications_controller.rb:52-60`
**Issue:** The `read` action scopes the lookup only to `user_id: Current.user.id`, without the brokerage join used in `index`. A user with multi-brokerage membership can mark notifications from another brokerage as read.
**Impact:** Cross-brokerage notification read-state write.
**Fix:**
```ruby
notification = Notification.without_deleted
  .where(user_id: Current.user.id)
  .joins(:group)
  .where(groups: {brokerage_id: Current.brokerage.id})
  .find(params[:id])
```

### CR-006 [WARNING] filter_by_source uses unvalidated filter_set_id from URL param
**File:** `backend/app/queries/group_estates_query.rb:88-93`
**Issue:** When `source` param is `"filter_set:<id>"`, the filter_set_id is parsed from the URL and used in a raw SQL EXISTS clause without verifying the filter set belongs to the current group.
**Impact:** Information disclosure — allows enumeration of filter set IDs across groups/brokerages via result set size.
**Fix:** Validate before use:
```ruby
filter_set_id = source.split(":").last.to_i
return scope unless @group.group_filter_sets.exists?(id: filter_set_id)
```

### CR-007 [WARNING] sanitize_sql_array called via .send on private method
**File:** `backend/app/queries/group_estates_query.rb:45, 192, 237, 259`
**Issue:** Four call sites use `ActiveRecord::Base.send(:sanitize_sql_array, ...)`. `sanitize_sql_array` has been public since Rails 5.2 — `.send` is unnecessary and suppresses warnings.
**Impact:** Fragile code that may break silently on Rails upgrade.
**Fix:** `ActiveRecord::Base.sanitize_sql_array([...])`

### CR-008 [WARNING] BoardCredentialsController dev path writes raw ciphertext columns and skips validations
**File:** `backend/app/controllers/v1/admin/board_credentials_controller.rb:44-53`
**Issue:** Under `Rails.env.development?`, the controller writes directly to `rets_username_ciphertext`/`rets_password_ciphertext` and calls `save(validate: false)`. If `RAILS_ENV` is misconfigured in CI or staging, unencrypted strings are persisted and uniqueness constraints are bypassed.
**Impact:** Credentials stored unencrypted; validation errors silently swallowed outside production.
**Fix:** Write through normal accessors and keep validations; configure a dev encryption key.

### CR-009 [WARNING] GroupEstatesController active_listings_count missing without_deleted
**File:** `backend/app/controllers/v1/admin/group/estates_controller.rb:9`
**Issue:** `active_listings_count = group.estates.count` does not apply `.without_deleted`, producing an inflated count when soft-deleted group_estates or estates exist.
**Impact:** Incorrect active listing count in admin UI.
**Fix:** `active_listings_count = group.estates.without_deleted.count`

### CR-010 [WARNING] GroupsController total_active_filters counts filters from soft-deleted groups
**File:** `backend/app/controllers/v1/admin/groups_controller.rb:20-24`
**Issue:** `total_active_filters` joins to `groups` without filtering `groups.deleted_at IS NULL`, inflating the brokerage-level stat.
**Impact:** Incorrect stat in admin dashboard.
**Fix:** Add `.where(groups: {deleted_at: nil})` to the join condition.

### CR-011 [INFO] Rack::Attack rate limit targets /v1/sessions which does not exist
**File:** `backend/config/initializers/rack_attack.rb:3-5`
**Issue:** The throttle targets `POST /v1/sessions`, but the app uses AWS Cognito JWTs and has no sessions endpoint. This path never matches — rate limiting is effectively disabled.
**Impact:** Auth brute-force protection absent at the Rails layer. Invitation token endpoints unprotected.
**Fix:** Target endpoints that actually accept tokens (e.g., `/validate_token`, `/accept_invitation`), or document that rate limiting is handled at the Cognito/CDN layer.
