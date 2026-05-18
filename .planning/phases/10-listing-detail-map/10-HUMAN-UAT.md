---
status: resolved
phase: 10-listing-detail-map
source: [10-VERIFICATION.md]
started: 2026-05-18T00:00:00.000Z
updated: 2026-05-18T00:00:00.000Z
---

## Current Test

Approved via Task 3 checkpoint during phase execution.

## Tests

### 1. Map renders on a listing with coordinates
expected: "Property location" label, h-64 map, fill-primary MapPin at property coords, NavigationControl top-right, zoom ~14
result: approved

### 2. Map absent on a listing without coordinates
expected: No empty container — map section completely absent between summary card and tabs
result: approved

### 3. Map persists across tab switches
expected: Map stays visible above tabs; no re-mount/flash when switching Details/Comments/Dates/Documents
result: approved

### 4. cooperativeGestures scroll behaviour
expected: Scroll wheel scrolls the page, not the map; Ctrl/Cmd+scroll zooms the map
result: approved

### 5. Token-missing placeholder
expected: "Map token not configured" in dashed-border h-64 container when VITE_MAPBOX_TOKEN is empty
result: approved

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
