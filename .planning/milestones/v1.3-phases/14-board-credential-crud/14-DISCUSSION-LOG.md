# Phase 14: Board Credential CRUD - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 14-board-credential-crud
**Areas discussed:** Row actions UX, Edit credentials flow, Delete confirmation

---

## Row Actions UX

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown menu (⋯) | MoreHorizontal icon opens DropdownMenu with Edit/Delete options. Clean, minimal, room to grow. | ✓ |
| Two inline icon buttons | Pencil + Trash2 always visible in Actions column. | |
| You decide | Claude picks the pattern. | |

**User's choice:** Dropdown menu (⋯)

**Notes:** None.

---

### Row Actions UX — Column placement

| Option | Description | Selected |
|--------|-------------|----------|
| 5th column — Actions | Change grid-cols-4 → grid-cols-5, narrow Actions header, ⋯ button right-aligned. | ✓ |
| Overlay Connected column | Keep 4 columns, float ⋯ button inside Connected date cell. | |

**User's choice:** 5th column — Actions

---

## Edit Credentials Flow

| Option | Description | Selected |
|--------|-------------|----------|
| New EditBoardCredentialDialog | Fresh dialog, pre-populated. Clean separation from ConnectBoardDialog multi-step logic. | ✓ |
| Reuse ConnectBoardDialog with edit mode | Add editCredential prop. Risks entangling flows. | |

**User's choice:** New EditBoardCredentialDialog

---

### Edit credentials flow — Test board behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Status-only form | Board name + read-only "Test board — no credentials required" notice. Submit re-verifies. | ✓ |
| Same form as real boards | Show username/password fields empty. Works but misleading UX. | |

**User's choice:** Status-only form (Recommended)

---

## Delete Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmation dialog | AlertDialog: "Delete [Board Name] connection? This cannot be undone." Cancel / Delete. | ✓ |
| Immediate delete with toast | Fire on click, show toast. Faster but risky. | |

**User's choice:** Confirmation dialog (Recommended)

---

## Claude's Discretion

None — all decision areas had user selections.

## Deferred Ideas

None — discussion stayed within phase scope.
