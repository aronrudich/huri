ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_avatar boolean GENERATED ALWAYS AS (avatar_url IS NOT NULL) STORED,
  ADD COLUMN IF NOT EXISTS avatar_version text GENERATED ALWAYS AS (md5(coalesce(avatar_url, ''))) STORED;

CREATE OR REPLACE FUNCTION public.directory_for(_uid uuid)
RETURNS TABLE (
  id uuid, full_name text, nickname text, role_name text, role_id uuid,
  is_active boolean, has_avatar boolean, avatar_version text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.nickname, p.role_name, p.role_id,
         p.is_active, p.has_avatar, p.avatar_version
  FROM public.profiles p
  WHERE p.dealership_id = (SELECT dealership_id FROM public.profiles WHERE id = _uid)
$$;

CREATE OR REPLACE FUNCTION public.message_recipients_for(_uid uuid)
RETURNS TABLE (
  id uuid, full_name text, nickname text, role_name text,
  has_avatar boolean, avatar_version text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.nickname, p.role_name, p.has_avatar, p.avatar_version
  FROM public.profiles p
  WHERE p.dealership_id = (SELECT dealership_id FROM public.profiles WHERE id = _uid)
    AND p.is_active = true
    AND p.status = 'approved'
    AND p.id <> _uid
  ORDER BY p.full_name ASC
$$;

GRANT EXECUTE ON FUNCTION public.directory_for(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.message_recipients_for(uuid) TO authenticated, service_role;