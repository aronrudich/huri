-- 1) Settings + permanent company code on dealerships
ALTER TABLE public.dealerships
  ADD COLUMN IF NOT EXISTS company_code text,
  ADD COLUMN IF NOT EXISTS flagged_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS reminder_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS claim_hide_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  ADD COLUMN IF NOT EXISTS enable_wash boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_parts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_staging boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.dealerships SET company_code = 'JCD29854'
 WHERE id = '00000000-0000-0000-0000-000000000001' AND company_code IS NULL;

-- Any other existing org gets a placeholder code so the unique index can be built.
UPDATE public.dealerships
   SET company_code = upper(regexp_replace(left(slug, 3), '[^A-Za-z0-9]', '', 'g'))
       || lpad((floor(random() * 90000) + 10000)::text, 5, '0')
 WHERE company_code IS NULL;

ALTER TABLE public.dealerships ALTER COLUMN company_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS dealerships_company_code_key
  ON public.dealerships (upper(company_code));

ALTER TABLE public.dealerships
  ADD CONSTRAINT dealerships_settings_sane CHECK (
    flagged_days BETWEEN 1 AND 3650
    AND reminder_minutes BETWEEN 0 AND 1440
    AND claim_hide_minutes BETWEEN 1 AND 1440
  );

DROP TRIGGER IF EXISTS dealerships_touch_updated_at ON public.dealerships;
CREATE TRIGGER dealerships_touch_updated_at
  BEFORE UPDATE ON public.dealerships
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Upper-management helper
CREATE OR REPLACE FUNCTION private.is_upper_management(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = _uid
       AND p.is_active = true
       AND p.status = 'approved'
       AND (
         p.is_owner = true
         OR p.role_name IN (
           'Admin','Manager','Service Manager','Assistant Service Manager',
           'Parts Manager','Director','Service Director','General Manager'
         )
       )
  )
$$;

REVOKE ALL ON FUNCTION private.is_upper_management(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_upper_management(uuid) TO authenticated, service_role;

-- 3) Companies are private: only your own company row is visible
GRANT SELECT, UPDATE ON public.dealerships TO authenticated;
GRANT ALL ON public.dealerships TO service_role;

DROP POLICY IF EXISTS "dealerships readable" ON public.dealerships;

CREATE POLICY "own dealership readable"
  ON public.dealerships FOR SELECT TO authenticated
  USING (id = private.dealership_of(auth.uid()));

CREATE POLICY "upper management updates own dealership"
  ON public.dealerships FOR UPDATE TO authenticated
  USING (id = private.dealership_of(auth.uid()) AND private.is_upper_management(auth.uid()))
  WITH CHECK (id = private.dealership_of(auth.uid()) AND private.is_upper_management(auth.uid()));