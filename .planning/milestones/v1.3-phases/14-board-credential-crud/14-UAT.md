---
status: complete
phase: 14-board-credential-crud
source: [14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md]
started: 2026-05-24T12:35:00Z
updated: 2026-05-24T12:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Actions Column Visible
expected: On the Board Registrations page (Admin → Brokerage), each connected board row shows a ⋯ button in the far-right "Actions" column. Clicking it reveals two menu items: "Edit credentials" and "Delete connection".
result: pass

### 2. Delete Connection — Confirmation Dialog
expected: Clicking "Delete connection" in the ⋯ dropdown opens an AlertDialog with title "Delete [Board Name] connection?" and body "This cannot be undone." Two buttons appear: "Cancel" (closes dialog, no change) and a red "Delete" button (confirms deletion).
result: pass

### 3. Delete Connection — Row Removed
expected: Clicking the red "Delete" button in the confirmation dialog removes that board from the registrations list. No page refresh needed — row disappears immediately.
result: pass

### 4. Edit Credentials — Real Board
expected: Clicking "Edit credentials" for a real MLS board opens a dialog with "RETS Username" and "RETS Password" inputs. Submitting with valid credentials closes the dialog and shows a "Board credentials updated." success toast.
result: pass

### 5. Edit Credentials — Test Board
expected: Clicking "Edit credentials" for a test board opens a dialog showing a blue info notice ("Test board — no credentials required.") and a "Re-verify connection" button (no username/password fields). Clicking "Re-verify connection" closes the dialog and shows "Board connection verified." toast.
result: pass

### 6. Edit Credentials — Inline Error on Failure
expected: Submitting invalid credentials for a real board shows an error message inline below the form fields (not a toast). The dialog stays open so the user can correct and retry.
result: skipped
reason: no real board with bad credentials available to test

## Summary

total: 6
passed: 5
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[none yet]
