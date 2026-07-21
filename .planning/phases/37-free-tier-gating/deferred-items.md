# Deferred Items — Phase 37 Free-Tier Gating

Out-of-scope issues discovered during execution but not fixed (SCOPE BOUNDARY rule).

## From Plan 37-02

- **`backend/app/controllers/v1/account/calendar/connections_controller.rb:52`** — `Lint/UselessAssignment: Useless assignment to variable - 'e'` (standardrb). Pre-existing in `#create_apple`'s `rescue => e` block (introduced in commit `e981f72`, before this plan). Not touched by Plan 37-02's diff (guard clause was inserted earlier in the method, at the top). Left as-is per scope boundary.
