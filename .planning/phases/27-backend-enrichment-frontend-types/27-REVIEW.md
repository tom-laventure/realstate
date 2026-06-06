---
phase: 27-backend-enrichment-frontend-types
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - backend/app/controllers/v1/account/admin_brokerages_controller.rb
  - frontend/src/assets/types/adminBrokerageType.ts
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-06-05
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two files reviewed: the Rails controller that returns enriched brokerage data for admin users, and the TypeScript type that describes its response shape. The controller has two critical bugs — one that crashes with a `NoMethodError` when a soft-deleted user is the owner of a brokerage, and one that produces a duplicate-brokerage response when a user holds both `admin` and `owner` memberships in the same brokerage. There is also a warning about the `all_memberships` query not guarding the soft-deleted `User` join.

---

## Critical Issues

### CR-01: Nil user dereference crashes response when an owner membership belongs to a soft-deleted user

**File:** `backend/app/controllers/v1/account/admin_brokerages_controller.rb:48`

**Issue:** The `owners` map at line 48 calls `r.user.first_name` and `r.user.last_name` on every membership whose role is `"owner"`. The query at line 28–31 uses `.includes(:user)` but does NOT guard against soft-deleted users — `User` uses `acts_as_paranoid`, so `r.user` can return `nil` for a deleted user record. When that happens, `r.user.first_name` raises `NoMethodError`, causing a 500 for every caller of this endpoint until the dangling membership is manually cleaned up.

The CLAUDE.md project rule is explicit: "This applies to **every model touched by a query**, including joined tables."

**Fix:** Add a `without_deleted` scope on the `User` join. The safest approach guards it at the query level and defensively skips nil users at serialization time:

```ruby
# Line 28-31: guard the user join
all_memberships = BrokerageMembership
  .without_deleted
  .includes(:user)
  .where(brokerage_id: brokerage_ids)
  .where(users: { deleted_at: nil })  # guard soft-deleted users via explicit join condition

# Line 47-49: defensive nil guard in the map (belt-and-suspenders)
owners: group
  .select { |r| r.role == "owner" && r.user.present? }
  .map { |r| { first_name: r.user.first_name, last_name: r.user.last_name } }
```

Note: to use the `where(users: { deleted_at: nil })` clause you will need to change `includes` to `joins` for the user association, or use `eager_load` instead of `includes` so Rails emits a JOIN rather than a separate SELECT.

---

### CR-02: Duplicate brokerage entries in response when user holds both `admin` and `owner` roles in the same brokerage

**File:** `backend/app/controllers/v1/account/admin_brokerages_controller.rb:19-25` and `37`

**Issue:** `admin_memberships` at line 19 queries for memberships with `role IN ('admin', 'owner')`. Rails returns **one row per membership record**, not one row per brokerage. If a user was first created as `admin` and then promoted to `owner` (leaving both rows in the DB), or if any other duplication exists, the outer `filter_map` at line 37 iterates all of them and emits one response entry per membership. The client receives two objects with the same `id`, which is a correctness bug — the frontend type `AdminBrokerage` models a single object per `id`.

Even without duplicate rows, the query semantically over-fetches: for a user who is both `admin` and `owner` of the same brokerage (a plausible data state if roles are additive), the endpoint will emit duplicate JSON objects.

**Fix:** Deduplicate by `brokerage_id` before building the response, picking the highest-privilege role:

```ruby
# After collecting admin_memberships, deduplicate by brokerage_id
# preferring 'owner' over 'admin' if both exist
deduped_memberships = admin_memberships
  .group_by(&:brokerage_id)
  .values
  .map { |members| members.min_by { |m| m.role == "owner" ? 0 : 1 } }

render json: {
  admin_brokerages: deduped_memberships.filter_map { |m|
    next if m.brokerage.nil?
    group = memberships_by_brokerage[m.brokerage_id] || []
    {
      id:           m.brokerage.id,
      name:         m.brokerage.name,
      role:         m.role,
      client_count: group.count { |r| r.role == "client" },
      member_count: group.count { |r| member_roles.include?(r.role) },
      owners:       group
                      .select { |r| r.role == "owner" && r.user.present? }
                      .map    { |r| { first_name: r.user.first_name, last_name: r.user.last_name } }
    }
  }
}
```

---

## Warnings

### WR-01: `all_memberships` query does not guard soft-deleted users at the DB level, only at the AR `includes` layer

**File:** `backend/app/controllers/v1/account/admin_brokerages_controller.rb:28-31`

**Issue:** The `all_memberships` query fetches memberships with `.includes(:user)` but has no constraint preventing soft-deleted `User` rows from being loaded. While `acts_as_paranoid` does add a default scope on `User.find_*` style lookups, it does **not** automatically filter associated records loaded via `includes` unless the association itself declares `-> { without_deleted }`. As confirmed in `user.rb`, no such scope is declared on `BrokerageMembership#user`. This means `r.user` for a membership whose user was soft-deleted returns `nil` rather than raising — which silently corrupts `client_count` and `member_count` (soft-deleted users are still counted as members) and causes the crash described in CR-01 for owners.

This is a standalone warning because the count corruption exists independently of the crash path: a soft-deleted client or agent still increments `client_count` or `member_count`.

**Fix:** Add a DB-level guard to exclude memberships for deleted users:

```ruby
all_memberships = BrokerageMembership
  .without_deleted
  .joins(:user)
  .where(users: { deleted_at: nil })
  .includes(:user)
  .where(brokerage_id: brokerage_ids)
```

Using `joins` before `includes` forces a INNER JOIN on `users` that the `where` clause can filter against, ensuring deleted users are excluded from counts and serialization.

---

_Reviewed: 2026-06-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
