# New roles (Shuttle, Valet & Shuttle, Admin) + multi-car CP/BL lots

## 1. Roles appear everywhere

Add `Shuttle`, `Valet & Shuttle`, and `Admin` to every place a role can be picked:

- Registration dropdown on the sign-in/register screen
- "Request role change" sheet on the profile page
- The manager/owner "Change role" sheet used on roster entries

The role list becomes one shared list used by all three screens, so future roles only need one edit. Order: Valet, Valet & Parts, Shuttle, Valet & Shuttle, Advisor, Technician, Shop Foreman, Service Manager, Service Director, General Manager, Admin, Other.

The three roles are also inserted into the roles table so approvals and role assignment resolve them properly.

## 2. Admin role

- Admins are the only people notified about new accounts waiting for approval and about role change requests. The current fan-out (owner + every manager/director) is replaced by a fan-out to Admins only.
- Admins get the pending-approvals view on the profile page: pending join requests (approve / deny) and pending role change requests (approve / deny). Non-admins no longer see it.
- Approve/deny/role-set actions on the server require the caller to be an Admin (the account owner keeps access as a safety net so the dealership can never lock itself out).
- Roster list visibility stays as it is today for management roles, plus Admin.

## 3. Shuttle / Valet & Shuttle permissions

These already exist in the app's role capability helper (shuttle-only list for Shuttle, everything except Parts for Valet & Shuttle, matching notifications). This change makes sure both roles are selectable and that the notification fan-outs and pickup-list filters recognise them consistently.

## 4. CP and BL hold unlimited cars

Cause of `duplicate key value violates unique constraint "parked_cars_one_car_per_numbered_spot"`: that unique index treats every location as a single-car spot except `C`, `T`, and `UNKNOWN`. `CP` and `BL` are not in the exception list, so the second car parked in either lot is rejected.

Fix: rebuild the index so uniqueness applies only to real numbered SV spots; `CP`, `BL`, `C`, `T`, `UNKNOWN`, and free-text special locations may hold any number of cars. The existing SV-spot uniqueness (and the "same RO# can't be in two spots" rule) is unchanged, so the duplicate-spot confirmation prompt still works for SV spots.

## Technical notes

- New `ROLE_OPTIONS` exported from `src/lib/roles.ts`; consumed by `src/routes/auth.tsx`, `src/routes/profile.tsx`, `src/components/ChangeRoleSheet.tsx` (fallback list).
- `src/lib/roles.ts`: add `ADMIN_ROLES` / `isAdminRole` helper for approval permissions.
- `src/lib/admin.functions.ts`: `notifyAdmins` targets `role_name = 'Admin'` (plus owner); `assertAdmin` requires Admin or owner.
- Migration: insert the three roles into `public.roles`; drop and recreate `parked_cars_one_car_per_numbered_spot` with a predicate limited to `SV <n>` locations (the existing `parked_cars_unique_sv_spot` index already covers SV, so the broad index is simply dropped).
