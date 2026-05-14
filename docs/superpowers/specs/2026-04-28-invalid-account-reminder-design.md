# Design: Fix invalid-account reminder leaking across account switches

## Problem

Popup "Có khách hàng cần cập nhật số tài khoản" is showing stale data from a previous login session when users logout/login without full page reload. Current query cache key is not user-scoped and uses `staleTime: Infinity`, so cached results can be reused across accounts.

There is also a role behavior requirement:
- Admin must **not** see the popup.
- Admin must still be able to filter `invalidAccount=true` on Customers page to review all invalid customers.
- Non-admin users keep existing data scope behavior.

## Goals

1. Prevent any invalid-account reminder data from leaking between different logged-in accounts.
2. Keep Customers page invalid-account filter behavior unchanged for permission model (admin/read_all can still review all).
3. Show popup only for eligible users (logged-in, non-admin).

## Non-goals

1. No backend API contract changes for invalid-account filtering.
2. No new endpoint for reminder data.
3. No global react-query cache reset strategy in this change.

## Proposed design

### 1) Popup eligibility and user-scoped cache

Update `client/src/components/customers/InvalidAccountReminderModal.tsx`:
- Read `user` and `isAdmin()` from auth store.
- Build reminder query key with user identity:
  - From: `["customers", "invalid-account-reminder"]`
  - To: `["customers", "invalid-account-reminder", user?.id]`
- Gate query execution using `enabled`:
  - Must have logged-in user
  - Must **not** be admin

Result:
- Popup is never fetched/shown for admin.
- Reminder query cache is isolated per account, so account B never reuses account A reminder payload.

### 2) Customers page user-scoped cache key

Update `client/src/pages/CustomersPage.tsx` list query:
- Include `user?.id` in `queryKey` for customer list query.

Result:
- When switching accounts without full reload, list data (including `invalidAccount=true` view) no longer reuses previous account cache entry.
- Existing backend permission behavior remains intact:
  - admin/read_all can still inspect all invalid-account customers
  - non-read_all users are still restricted by consultant scope

### 3) Backend behavior

No backend code changes for this bugfix.

Reason:
- Existing `customers` API already enforces permission-based row scope.
- Required behavior for admin invalid-account review is already supported.

## Data flow after change

1. User logs in.
2. Main layout mounts reminder modal.
3. If user is admin: reminder query is disabled -> no popup.
4. If user is non-admin: reminder query runs under a user-specific query key.
5. User logs out and logs in with another account:
   - New user gets a different query key
   - Fresh fetch occurs for new account scope
   - No stale cross-account reminder UI

## Error handling

1. Keep existing API/query error handling behavior unchanged.
2. Do not introduce silent fallbacks that mask auth/scope issues.
3. If reminder query fails, modal remains hidden by existing conditional rendering.

## Validation scenarios

1. **Cross-account isolation**
   - Login account A (has invalid-account reminder) -> popup shows A data.
   - Logout -> login account B -> popup must not show A data.

2. **Admin behavior**
   - Login admin account -> popup does not appear.
   - Open Customers page and filter `STK sai format` -> admin can still see invalid-account list.

3. **Non-admin behavior**
   - Login consultant account with invalid customers -> popup appears with own scope.
   - Navigate `/customers?invalidAccount=true` -> data follows existing permission scope.

