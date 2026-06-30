
-- Approval system
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pending_role_name TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending','approved'));

-- Backfill: all existing accounts are approved; aron@oremor.net is the owner + Manager
UPDATE public.profiles SET status = 'approved' WHERE status IS NULL OR status = 'pending';
UPDATE public.profiles SET is_owner = true, role_name = 'Manager'
  WHERE lower(email) = 'aron@oremor.net';

-- Helper to check ownership without recursion
CREATE OR REPLACE FUNCTION private.is_owner(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND is_owner = true)
$$;

CREATE OR REPLACE FUNCTION private.is_approved(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND status = 'approved' AND is_active = true)
$$;

-- Tighten profiles policies: pending users can read their own row; approved users see other approved; owner sees all
DROP POLICY IF EXISTS "profiles self or manager read" ON public.profiles;
CREATE POLICY "profiles read" ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR private.is_owner(auth.uid())
    OR (private.is_approved(auth.uid()) AND status = 'approved' AND is_active = true)
  );

-- Lock down messages so pending users cannot read or send
DROP POLICY IF EXISTS "messages readable by auth" ON public.messages;
DROP POLICY IF EXISTS "messages insert by auth" ON public.messages;
CREATE POLICY "messages read approved" ON public.messages FOR SELECT
  USING (private.is_approved(auth.uid()));
CREATE POLICY "messages insert approved" ON public.messages FOR INSERT
  WITH CHECK (private.is_approved(auth.uid()) AND sender_id = auth.uid());
