
-- 1) Remove overly permissive realtime broadcast policy
DROP POLICY IF EXISTS "authenticated can receive broadcasts" ON realtime.messages;

-- 2) Lock down SECURITY DEFINER functions
-- Trigger function - not callable directly
REVOKE ALL ON FUNCTION public.set_dealership_from_user() FROM PUBLIC, anon, authenticated;

-- Private helper functions used by RLS: revoke from anon (anon has no table access anyway)
REVOKE ALL ON FUNCTION private.is_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_approved(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.dealership_of(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.user_in_role_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_stale_pickups() FROM PUBLIC, anon, authenticated;
