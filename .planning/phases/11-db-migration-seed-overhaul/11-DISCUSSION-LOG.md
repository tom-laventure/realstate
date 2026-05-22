# Phase 11: DB Migration & Seed Overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 11-db-migration-seed-overhaul
**Areas discussed:** GroupEstate in seeds, Board credentials seed, NV address data

---

## GroupEstate in seeds

| Option | Description | Selected |
|--------|-------------|----------|
| Keep GroupEstate rows | Groups show listings immediately; dashboard works out of the box for demos. BrokerageEstate absent until connect. | |
| Remove GroupEstate too | Dashboard starts completely empty. Brokerages must connect to TEST board before anything shows up. Clean slate. | ✓ |
| You decide | Let Claude pick based on dev experience. | |

**User's choice:** No — remove GroupEstate too

---

### GroupEstate follow-up: engagement seeds

| Option | Description | Selected |
|--------|-------------|----------|
| Drop engagement seeds entirely | No ratings, comments, or documents until real usage flows through the app. | ✓ |
| Keep as stubs | Keep seed files but with no data. Documents the hook exists without inserting broken rows. | |

**User's choice:** Yes — drop engagement seeds too

---

## Board credentials seed

| Option | Description | Selected |
|--------|-------------|----------|
| Seed credentials for all 3 brokerages | Board Registrations table pre-populated for each brokerage pointing to TEST board. Consistent with SEED-02. | |
| Seed 1 brokerage only | One starts pre-connected; others test full connect flow. | |
| Drop credential seeding | Board Registrations table starts empty. Full Phase 12 connect flow tested from scratch. | ✓ |

**User's choice:** No — drop credential seeding

---

### Credentials follow-up: file structure

| Option | Description | Selected |
|--------|-------------|----------|
| Boards only, no credential function | Remove seed_board_credentials! entirely from file and seeds.rb. | ✓ |
| Keep function stub | Keep for documentation purposes with no data. | |

**User's choice:** Yes — boards only, no credential function

---

## NV address data

| Option | Description | Selected |
|--------|-------------|----------|
| Claude generates hardcoded list | 100 plausible real NV street addresses with approximate lat/lng. No user effort. | ✓ |
| User provides dataset | CSV or link to source; embedded verbatim. Most accurate. | |

**User's choice:** Claude generates a hardcoded list

---

### NV addresses follow-up: coordinate precision

| Option | Description | Selected |
|--------|-------------|----------|
| Street-level (6 decimal places) | Unique coordinate per specific block. Most realistic for map clustering. | |
| Neighborhood-level (3-4 decimal places) | ~100m accuracy. Listings cluster by neighborhood. Faster to generate. | ✓ |

**User's choice:** Neighborhood-level (3-4 decimal places)

---

### NV addresses follow-up: geographic scope

| Option | Description | Selected |
|--------|-------------|----------|
| North Vancouver only (City + District) | Tight cluster on the map, clear geographic identity. | ✓ |
| Spread across North Shore | Include West Van, Deep Cove, Lynn Valley. More variety. | |

**User's choice:** North Vancouver only (City + District)

---

## Claude's Discretion

None — all areas had explicit user selections.

## Deferred Ideas

- **"Rethink listing access model — BrokerageEstate vs board credential JOIN"** — reviewed pending todo; confirmed deferred (too broad, acceptable at 100 listings). Surface before adding a second real board.
