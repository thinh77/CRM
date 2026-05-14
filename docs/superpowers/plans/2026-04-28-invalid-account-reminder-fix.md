# Invalid Account Reminder Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove cross-account cache leakage for invalid-account reminder/list data, while keeping admin able to inspect `invalidAccount=true` on Customers page and never showing popup for admin.

**Architecture:** Keep backend permission behavior unchanged. Fix leakage in frontend by scoping React Query keys by logged-in user ID and gating popup query by admin status. This isolates per-account cache entries and preserves existing server authorization rules.

**Tech Stack:** React 19, TypeScript, Zustand, TanStack React Query, Vite, ESLint

---

## File structure and responsibilities

- **Modify:** `client/src/components/customers/InvalidAccountReminderModal.tsx`
  - Owns reminder popup fetch/display behavior.
  - Add user-aware query key and admin gating.
- **Modify:** `client/src/pages/CustomersPage.tsx`
  - Owns customers list query.
  - Add user-aware query key to prevent cross-account cache reuse.
- **Reference only:** `client/src/stores/authStore.ts`
  - Confirms user/admin state source (`user`, `isAdmin()`).

## Task 1: Fix popup scope and cache isolation

**Files:**
- Modify: `client/src/components/customers/InvalidAccountReminderModal.tsx`
- Verify: `client/src/stores/authStore.ts`

- [ ] **Step 1: Capture failing regression scenario (manual failing test)**

Run app and reproduce:
1. Login account A (has invalid-account customers) -> popup appears.
2. Logout.
3. Login account B -> old A popup data currently appears (bug).

Expected (current/failing): B sees stale A popup data without hard reload.

- [ ] **Step 2: Implement minimal popup fix**

Apply these changes in `InvalidAccountReminderModal.tsx`:

```tsx
import { useAuthStore } from "@/stores/authStore";

const { user, isAdmin } = useAuthStore();
const userId = user?.id;
const shouldRunReminder = Boolean(userId) && !isAdmin();

const { data } = useQuery({
  queryKey: ["customers", "invalid-account-reminder", userId],
  queryFn: () =>
    customersApi
      .list({ invalidAccount: true, limit: PREVIEW_LIMIT, page: 1 })
      .then((res) => res.data),
  enabled: shouldRunReminder,
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
});

if (!shouldRunReminder || !data || data.pagination.total === 0) return null;
```

Notes:
- Keep API call unchanged to preserve backend behavior.
- Admin popup suppression is frontend gating only.

- [ ] **Step 3: Verify popup behavior after fix**

Manual checks:
1. Admin login -> popup does not show.
2. Consultant login with invalid customers -> popup shows.
3. Account switch A -> B without reload -> B never sees A reminder rows.

Expected: all checks pass.

## Task 2: Isolate Customers page list cache by account

**Files:**
- Modify: `client/src/pages/CustomersPage.tsx`

- [ ] **Step 1: Add user ID to customers query key**

Update query state usage:

```tsx
const { hasPermission, user } = useAuthStore();

const { data, isLoading } = useQuery({
  queryKey: ["customers", user?.id, filters],
  queryFn: () => customersApi.list(filters).then((res) => res.data),
});
```

This ensures `/customers?invalidAccount=true` no longer reuses prior account cache entries.

- [ ] **Step 2: Verify invalid-account filter behavior**

Manual checks:
1. Admin opens `/customers?invalidAccount=true` -> still sees invalid-account list (read_all behavior unchanged).
2. Non-admin opens same filter -> sees only own-scope data per backend permissions.
3. Logout/login another account -> list data refreshes for new account.

Expected: permission behavior unchanged, no stale cross-account rows.

## Task 3: Quality gates and final verification

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Run frontend lint**

Run:
```bash
cd client && npm run lint
```

Expected: lint passes without new errors from changed files.

- [ ] **Step 2: Run frontend build**

Run:
```bash
cd client && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Regression walkthrough**

Execute end-to-end checks:
1. Account switch popup regression (A -> logout -> B).
2. Admin popup suppression.
3. Admin invalid-account filter access retained.

Expected: all three scenarios pass.

## Notes

- Backend intentionally unchanged for this fix.
- Git commit steps are intentionally omitted in this plan per current session request to skip git operations.

