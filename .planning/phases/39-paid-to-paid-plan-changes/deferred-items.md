# Deferred Items — Phase 39 Plan 01

Out-of-scope discoveries logged during execution, not fixed (per SCOPE BOUNDARY —
only auto-fix issues directly caused by this plan's changes).

## standardrb: `backend/app/models/brokerage.rb` pre-existing indentation violations

`bundle exec standardrb app/models/brokerage.rb` reports 11
`Layout/MultilineMethodCallIndentation` offenses at lines 55-80, inside the
pre-existing `freeze_custom_domains!` and `unfreeze_custom_domains!` methods
(added in Phase 38, untouched by this plan). The new `billable_seat_count`
method added in this plan (lines 38-43) is standardrb-clean on its own. Not
fixed here — out of scope for this plan's file-touch list.
