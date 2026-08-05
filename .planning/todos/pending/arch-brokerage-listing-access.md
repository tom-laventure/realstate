---
created: 2026-05-21
title: "Rethink listing access model — BrokerageEstate vs board credential JOIN"
area: architecture
resolves_phase: 47
files:
  - backend/app/controllers/v1/admin/board_credentials_controller.rb
  - backend/app/controllers/v1/admin/groups_controller.rb
  - backend/app/jobs/resync_stale_photos_job.rb
  - backend/app/services/brokerages/deletion_cascade_service.rb
  - backend/app/models/brokerage_estate.rb
  - backend/app/models/estate.rb
---

## Problem

`BrokerageEstate` currently serves as both the access layer ("which listings can this brokerage see?") and the management layer ("which listings has this brokerage added to a group?"). Connecting a board auto-populates `BrokerageEstate` with one row per listing on that board. For large boards (1,000–50,000 listings) this creates significant duplication — three brokerages connecting to the same board = 3× the rows, with no additional information stored.

## Proposed Solution

Separate the two concerns:

- **Access**: a brokerage can see any listing whose `real_estate_board_id` matches a board they have a `BrokerageBoardCredential` for. No `BrokerageEstate` row needed — checked via JOIN at query time.
- **Management**: `BrokerageEstate` is only created when a listing is explicitly added to a group (user action). Represents "actively managed" listings, not just accessible ones.

This requires refactoring `GroupEstatesQuery`, the dashboard coordinates endpoint, and any other queries that currently scope through `BrokerageEstate` for access.

## Why deferred

Raised during v1.3 milestone planning. Scope would require significant query-layer refactoring across dashboard endpoints — too broad to include alongside the test board feature. The current approach (auto-populate on connect) is acceptable at current listing volumes (100 test listings, low thousands in prod).

## When to surface

Before adding a second real board integration or when board listing counts exceed ~5,000 per board.
