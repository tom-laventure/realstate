# Phase 43: Home Page & Legal Pages - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 43-Home Page & Legal Pages
**Areas discussed:** Nav/header brand mark, Middle-of-scroll CTA + microinteractions, Feature section content, Hero & value-prop copy, Contact info

---

## Nav/Header Brand Mark

| Option | Description | Selected |
|--------|-------------|----------|
| Text wordmark | "RealtyBase" in Slate primary color, clean sans-serif, no image asset needed | ✓ |
| Simple generated mark | Minimal icon/monogram paired with wordmark, requires a small design pass | |

**User's choice:** Text wordmark (Recommended)
**Notes:** No company logo asset exists anywhere in the codebase — `VITE_BRAND_LOGO_URL` currently points at a specific test brokerage's (id 4914) uploaded logo, not a company brand mark.

---

## Middle-of-Scroll CTA + Microinteractions

| Option | Description | Selected |
|--------|-------------|----------|
| Extra CTA yes, animation via CSS-only | 2nd "Get Started" CTA after value-prop section (pure markup); hover/transition polish via CSS-only, no JS | ✓ |
| Skip both for this phase | Only hero+closing CTA, no motion polish | |

**User's choice:** Extra CTA yes, animation via CSS-only (Recommended)
**Notes:** Resolves the tension with Phase 42's "zero JS by default" lock — CSS-only motion, no JS animation library.

---

## Feature Section Content

**Round 1 (tier A):** MLS/board-synced listings, Group collaboration, Role-based access, Multi-tenant isolation — all selected
**Round 2 (tier B):** Custom domain, Client sharing — selected; Calendar sync, Map view — not selected
**Free-text addition:** Smart filter-set/client pairing ("The ability to create filter sets that allow for the automatic pairing of client groups with matching listings")

**Follow-up — feature count (7, one over the 3-6 guideline):**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep all 7 | All distinct capabilities worth showing; group visually to avoid crowding | ✓ |
| Trim to 6 | Drop one to stay within research guideline | |

**User's choice:** Keep all 7 (Recommended)

---

## Hero & Value-Prop Copy Angle

| Option | Description | Selected |
|--------|-------------|----------|
| Scattered tools/data | Lead with fragmentation pain — listings/coordination/board data spread across disconnected tools | ✓ |
| Lack of control/visibility | Lead with owner's lack of oversight over agents/listings/clients | |
| Let me write the direction | User provides the angle | |

**User's choice:** Scattered tools/data (Recommended)

---

## Contact Info

| Option | Description | Selected |
|--------|-------------|----------|
| hello@realtybase.ca + "RealtyBase" | Simple on-brand support address; product name as placeholder legal entity name | ✓ |
| Let me specify | User provides actual email/entity name | |

**User's choice:** hello@realtybase.ca + "RealtyBase" (Recommended)

---

## Wrap-up check

**Question:** Anything else to clarify, or ready for context?
**User's choice:** Ready for context (Recommended)

## Claude's Discretion

- Exact hero/subhead/feature-pair copy wording (grounded in the locked framing angle)
- Visual grouping/layout of the 7 feature pairs
- "RealtyBase" vs "RealtyBase Inc." in legal boilerplate

## Deferred Ideas

- `arch-brokerage-listing-access.md` pending todo — weak keyword match ("app", "estate") only, same conclusion as Phase 42: unrelated. Left untouched.
