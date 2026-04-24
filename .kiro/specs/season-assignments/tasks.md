# Implementation Plan: Season Assignments

## Overview

Add active-season + quota validation to the existing POST endpoint, create the org-admin assignments UI (redirect entry point + two-panel page), and wire in the sidebar link.

## Tasks

- [x] 1. Add validation to POST /api/seasons/[id]/assignments
  - [x] 1.1 Add active-season check and quota enforcement
    - In `app/api/seasons/[id]/assignments/route.ts`, after the `assertOrgScope` check, add:
      1. `SEASON_NOT_ACTIVE` — return `unprocessableEntity({ error, code })` when `season.status !== "active"`
      2. `QUOTA_EXCEEDED_REFEREES` — when `season.requiredClubs !== null && refereeIds.length > 4 * season.requiredClubs`
      3. `QUOTA_EXCEEDED_MEAS` — when `season.requiredClubs !== null && matchEventAdminIds.length > season.requiredClubs`
    - Use the existing `unprocessableEntity` helper from `@/lib/api-helpers`
    - Include `limit` and `requested` fields in quota error responses
    - _Requirements: active-season constraint, quota enforcement_

  - [x] 1.2 Add org-scope check for MEA IDs
    - Before persisting `matchEventAdminIds`, verify each user has a `UserRoleScope` with `role.name = "match_event_admin"` and `organizationId` matching `season.league.organizationId`
    - Return `unprocessableEntity({ error, code: "OUT_OF_SCOPE_MEA" })` if any ID fails
    - _Requirements: org-scoping for MEAs_

  - [ ]* 1.3 Write property tests for quota validation logic
    - Create `__tests__/season-assignments.property.test.ts` using fast-check
    - **Property 1: Quota boundary — MEAs at limit always accepted**
      - For any `requiredClubs > 0`, `matchEventAdminIds.length === requiredClubs` passes quota check
      - **Validates: quota enforcement requirement**
    - **Property 2: Quota boundary — MEAs one over limit always rejected**
      - For any `requiredClubs > 0`, `matchEventAdminIds.length === requiredClubs + 1` returns 422
      - **Validates: quota enforcement requirement**
    - **Property 3: Quota boundary — referees at limit always accepted**
      - For any `requiredClubs > 0`, `refereeIds.length === 4 * requiredClubs` passes quota check
      - **Validates: quota enforcement requirement**
    - **Property 4: Quota boundary — referees one over limit always rejected**
      - For any `requiredClubs > 0`, `refereeIds.length === 4 * requiredClubs + 1` returns 422
      - **Validates: quota enforcement requirement**
    - **Property 5: Null requiredClubs — any count accepted**
      - When `requiredClubs = null`, any array length passes quota check
      - **Validates: null quota behavior**

- [x] 2. Create redirect page /dashboard/seasons/assignments
  - Create `app/dashboard/seasons/assignments/page.tsx`
  - Mirror the `squad-management` pattern: fetch `GET /api/seasons` (org-scoped), find active → upcoming → first season, redirect to `/dashboard/seasons/[id]/assignments`
  - Use `getOrganizationId()` from `useAuth` to scope the fetch if needed (the API already scopes by role)
  - Show skeleton while loading, inline error if fetch fails, "No active season found" message if seasons list is empty
  - Guard: if `!isOrgAdmin()`, show "Access restricted to Org Admins."
  - _Requirements: redirect entry point for org admin_

- [x] 3. Create assignments page /dashboard/seasons/[id]/assignments
  - [x] 3.1 Create the page shell with data fetching
    - Create `app/dashboard/seasons/[id]/assignments/page.tsx`
    - Fetch: `GET /api/seasons/[id]`, `GET /api/seasons/[id]/assignments`, `GET /api/referees`, `GET /api/users`
    - Filter users client-side for `match_event_admin` role (`userRoleScopes.some(s => s.role.name === "match_event_admin")`)
    - Initialize `pendingRefereeIds` and `pendingMEAIds` from the assignments response
    - Track `isDirty` (pending differs from saved) and `isSaving`
    - _Requirements: assignments page data layer_

  - [x] 3.2 Implement the two-panel layout
    - Two `Card` components side by side (`grid grid-cols-1 md:grid-cols-2 gap-6`)
    - Left panel: "Match Event Admins" — quota indicator `"X / N assigned"` (or `"X assigned"` when `requiredClubs` is null), list of assigned MEAs with remove `×` button, "+ Add MEA" button
    - Right panel: "Referees" — same structure, quota = `4 * requiredClubs`
    - Quota `Badge`: amber when ≥ 80% of limit, red when at or over limit
    - Warning banner when `season.status !== "active"` (use shadcn `Alert` with amber styling)
    - "Save Changes" `Button` at the bottom, disabled when `!isDirty || isSaving || season.status !== "active"`
    - _Requirements: two-panel UI, quota display, status guard_

  - [x] 3.3 Implement the Add picker Dialog
    - Shared `PickerDialog` component (or inline) opened by "+ Add MEA" / "+ Add Referee"
    - Searchable list (filter by name) showing only unassigned people
    - Clicking a row adds the ID to the pending list and closes the dialog
    - _Requirements: add picker_

  - [x] 3.4 Wire Save to POST /api/seasons/[id]/assignments
    - On Save: POST `{ refereeIds: pendingRefereeIds, matchEventAdminIds: pendingMEAIds }`
    - On 201: mutate SWR cache, reset `isDirty`, `toast.success`
    - On 422 `QUOTA_EXCEEDED_*`: `toast.error("Max N allowed, you selected M")`
    - On 422 `SEASON_NOT_ACTIVE`: `toast.error` with the message
    - On 422 `OUT_OF_SCOPE_MEA`: `toast.error` with the message
    - _Requirements: save flow, error handling_

  - [ ]* 3.5 Write unit tests for quota badge color logic
    - Test the badge color helper: below 80% → default, ≥ 80% → amber, at/over limit → red
    - Test with `requiredClubs = null` → no badge coloring applied
    - _Requirements: quota display_

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add Assignments sidebar link for org admin
  - In `components/dashboard/sidebar.tsx`, add to the `roleNavItems` array inside the `isOrgAdmin()` branch:
    ```typescript
    ...(isOrgAdmin()
      ? [
          { title: "Assignments", href: "/dashboard/seasons/assignments", icon: ClipboardCheck },
        ]
      : []),
    ```
  - `ClipboardCheck` is already imported in the file
  - _Requirements: sidebar navigation for org admin_

- [ ] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `unprocessableEntity` helper already exists in `lib/api-helpers.ts` — use it directly
- The `isOrgAdmin()` helper is available in `useAuth()` via `lib/auth-context.tsx`
- `ClipboardCheck` icon is already imported in `sidebar.tsx`
- Property tests should extract the quota validation logic into a pure function to test it in isolation
