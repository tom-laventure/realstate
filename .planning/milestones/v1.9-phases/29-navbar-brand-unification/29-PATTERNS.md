# Phase 29: Navbar Brand Unification - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 4 (1 create, 3 modify)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/containers/portal/DashboardNavBar.tsx` | component | request-response | `frontend/src/containers/portal/PortalNavBar.tsx` | exact |
| `frontend/src/containers/portal/BrokerageSelection.tsx` | component | request-response | `frontend/src/containers/portal/PortalNavBar.tsx` (integration point) | role-match |
| `frontend/src/containers/portal/PortalNavBar.tsx` | component | request-response | self (existing file, surgical edit) | exact |
| `frontend/.env.example` | config | — | self (existing file, append entry) | exact |

---

## Pattern Assignments

### `frontend/src/containers/portal/DashboardNavBar.tsx` (component, request-response)

**Primary analog:** `frontend/src/containers/portal/PortalNavBar.tsx`
**Secondary analog:** `frontend/src/components/navbar/NavBar.tsx` (account dropdown pattern)

**Imports pattern** — copy from `PortalNavBar.tsx` lines 1-17, strip brokerage-specific hooks, add `UserCircle` from `NavBar.tsx` line 1:

```tsx
import { signOut } from 'aws-amplify/auth'
import { useNavigate } from 'react-router-dom'
import { UserCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { clearToken } from '@/lib/auth'
import { useAppDispatch } from '@/store/hooks/useDispatch'
import { clearActiveBrokerage } from '@/store/reducers/activeBrokerage'
```

**Sign-out pattern** — copy verbatim from `PortalNavBar.tsx` lines 34-39 (D-05 requires exact mirror):

```tsx
const handleSignOut = async () => {
    await signOut({ global: true }).catch(() => null)
    dispatch(clearActiveBrokerage())
    clearToken()
    window.location.href = '/auth/login'
}
```

**Brand logo conditional render pattern** — copy from `PortalNavBar.tsx` lines 58-64, swap `brokerageData.logoUrl` for `import.meta.env.VITE_BRAND_LOGO_URL`:

```tsx
{import.meta.env.VITE_BRAND_LOGO_URL && (
    <img
        src={import.meta.env.VITE_BRAND_LOGO_URL}
        alt="Brand logo"
        className="h-7 max-w-[7rem] object-contain"
    />
)}
```

Note: `h-7` (28px) matches the visual weight of the removed brokerage logo (`h-6`) while being slightly larger for a platform-level brand mark. Adjust to `h-8` if needed after visual review.

**Header shell pattern** — copy from `PortalNavBar.tsx` lines 47-49 (bg, border, height are shared across all navbars):

```tsx
<header className="border-b border-sidebar-border bg-sidebar">
    <div className="flex h-16 items-center justify-between gap-3 px-4">
```

**Account dropdown pattern** — copy from `NavBar.tsx` lines 101-115 (UserCircle trigger + Account Settings + Sign Out):

```tsx
<DropdownMenu>
    <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="account menu" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <UserCircle className="h-5 w-5" />
        </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => navigate('/account')}>
            Account Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
            Sign Out
        </DropdownMenuItem>
    </DropdownMenuContent>
</DropdownMenu>
```

**Complete component shell** — the full file structure mirrors `PortalNavBar.tsx`:

```tsx
const DashboardNavBar = () => {
    const dispatch = useAppDispatch()
    const navigate = useNavigate()

    const handleSignOut = async () => { /* ... */ }

    return (
        <header className="border-b border-sidebar-border bg-sidebar">
            <div className="flex h-16 items-center justify-between gap-3 px-4">
                {/* Left: static brand logo */}
                <div>
                    {import.meta.env.VITE_BRAND_LOGO_URL && (
                        <img src={import.meta.env.VITE_BRAND_LOGO_URL} alt="Brand logo" className="h-7 max-w-[7rem] object-contain" />
                    )}
                </div>

                {/* Right: account dropdown */}
                <div className="flex items-center gap-2">
                    {/* DropdownMenu from NavBar.tsx lines 101-115 */}
                </div>
            </div>
        </header>
    )
}

export default DashboardNavBar
```

---

### `frontend/src/containers/portal/BrokerageSelection.tsx` (modify — add DashboardNavBar at top)

**Analog:** `frontend/src/containers/portal/BrokerageSelection.tsx` (self — surgical addition)

**Change:** Add `import DashboardNavBar from './DashboardNavBar'` to the import block and render `<DashboardNavBar />` as the first child of the outermost return `<div>` (before the loading spinner and before the card grid).

**Integration point** — current outermost JSX in `BrokerageSelection.tsx` lines 58-84 (the `min-h-screen` div). Wrap or prepend:

```tsx
// Option A: Fragment wrapper (if DashboardNavBar is outside the min-h-screen div)
return (
    <>
        <DashboardNavBar />
        <div className="min-h-screen bg-background pt-12 px-6 md:px-8">
            ...
        </div>
    </>
)
```

Note: The loading state (lines 34-50) also returns a full-screen div — `DashboardNavBar` should appear above it too. Restructure the component to always render `<DashboardNavBar />` first, then the conditional body.

**Import addition** (top of file, after existing imports):

```tsx
import DashboardNavBar from './DashboardNavBar'
```

---

### `frontend/src/containers/portal/PortalNavBar.tsx` (modify — brand logo + trigger cleanup)

**Analog:** self (surgical edits at two locations)

**Change 1 — Remove brokerage logo from trigger** (lines 58-64). Delete the entire conditional img block inside `<DropdownMenuTrigger>`:

```tsx
// REMOVE these lines (58-64):
{brokerageData?.logoUrl && (
    <img
        src={brokerageData.logoUrl}
        alt={brokerageData.name}
        className="h-6 max-w-[5rem] object-contain"
    />
)}
```

After removal, the trigger contains only `{activeBrokerage.name}` + `<ChevronDown />`.

**Change 2 — Add brand logo left of DropdownMenu** (line 51, inside the left `<div>`). Insert before `<DropdownMenu>`:

```tsx
{/* Left: brand logo + brokerage switcher (D-08, D-09, D-10) */}
<div className="flex items-center gap-3">
    {import.meta.env.VITE_BRAND_LOGO_URL && (
        <button
            onClick={() => navigate('/dashboard')}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label="Go to brokerage selection"
        >
            <img
                src={import.meta.env.VITE_BRAND_LOGO_URL}
                alt="Brand logo"
                className="h-7 max-w-[7rem] object-contain"
            />
        </button>
    )}
    <DropdownMenu>
        ...
    </DropdownMenu>
</div>
```

**Button style choice:** Plain `<button>` element with minimal classes keeps the implementation consistent with the D-09 decision note ("button or plain `<button>`"). `variant="ghost"` Button from shadcn is equally valid — see `PortalNavBar.tsx` lines 104-111 for a ghost Button pattern already in this file.

**No new imports needed** — `navigate` already imported (line 23), `import.meta.env` is globally available.

---

### `frontend/.env.example` (modify — append env var)

**Analog:** `frontend/.env.example` lines 1-10 (self — append entry)

**Change:** Append one line at the end of the file:

```
VITE_BRAND_LOGO_URL=
```

Matches the established pattern of `KEY=` with a blank default for optional/secret values (consistent with lines 2, 4, 9, 10 of `.env.example`).

---

## Shared Patterns

### Sign-Out Flow
**Source:** `frontend/src/containers/portal/PortalNavBar.tsx` lines 34-39
**Apply to:** `DashboardNavBar.tsx` (required, D-05 specifies exact mirror)

```tsx
const handleSignOut = async () => {
    await signOut({ global: true }).catch(() => null)
    dispatch(clearActiveBrokerage())
    clearToken()
    window.location.href = '/auth/login'
}
```

### Brand Logo Conditional Render
**Source:** Pattern derived from `NavBar.tsx` lines 44-51 (`displayLogoUrl && <img ...>`) and `PortalNavBar.tsx` lines 58-64 (`brokerageData?.logoUrl && <img ...>`)
**Apply to:** `DashboardNavBar.tsx` (static, no click), `PortalNavBar.tsx` (clickable, navigate to `/dashboard`)

```tsx
// Static (DashboardNavBar — D-03):
{import.meta.env.VITE_BRAND_LOGO_URL && (
    <img src={import.meta.env.VITE_BRAND_LOGO_URL} alt="Brand logo" className="h-7 max-w-[7rem] object-contain" />
)}

// Clickable (PortalNavBar — D-09, D-10):
{import.meta.env.VITE_BRAND_LOGO_URL && (
    <button onClick={() => navigate('/dashboard')} ...>
        <img src={import.meta.env.VITE_BRAND_LOGO_URL} alt="Brand logo" className="h-7 max-w-[7rem] object-contain" />
    </button>
)}
```

### Navbar Header Shell
**Source:** `frontend/src/containers/portal/PortalNavBar.tsx` lines 47-49 and `frontend/src/components/navbar/NavBar.tsx` lines 30-31
**Apply to:** `DashboardNavBar.tsx` (all portal navbars share `border-b border-sidebar-border bg-sidebar` + `flex h-16 items-center justify-between gap-3 px-4`)

```tsx
<header className="border-b border-sidebar-border bg-sidebar">
    <div className="flex h-16 items-center justify-between gap-3 px-4">
```

### Account Dropdown (UserCircle + Account Settings + Sign Out)
**Source:** `frontend/src/components/navbar/NavBar.tsx` lines 101-115
**Apply to:** `DashboardNavBar.tsx` right side

```tsx
<DropdownMenu>
    <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="account menu"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <UserCircle className="h-5 w-5" />
        </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => navigate('/account')}>
            Account Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
            Sign Out
        </DropdownMenuItem>
    </DropdownMenuContent>
</DropdownMenu>
```

---

## No Analog Found

All files have direct analogs in the codebase. No entries.

---

## Metadata

**Analog search scope:** `frontend/src/containers/portal/`, `frontend/src/components/navbar/`
**Files scanned:** 6 source files, 1 config file
**Pattern extraction date:** 2026-06-06
