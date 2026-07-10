
-- Dealerships (multi-tenant)
CREATE TABLE IF NOT EXISTS public.dealerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dealerships TO authenticated, anon;
GRANT ALL ON public.dealerships TO service_role;
ALTER TABLE public.dealerships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dealerships readable" ON public.dealerships;
CREATE POLICY "dealerships readable" ON public.dealerships FOR SELECT USING (true);

INSERT INTO public.dealerships (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Ontario Jeep Chrysler Dodge Ram Fiat', 'ontario-jcdr')
ON CONFLICT (id) DO NOTHING;

-- Add dealership_id to tenant tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dealership_id uuid REFERENCES public.dealerships(id) DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET dealership_id='00000000-0000-0000-0000-000000000001' WHERE dealership_id IS NULL;
ALTER TABLE public.profiles ALTER COLUMN dealership_id SET NOT NULL;

ALTER TABLE public.parked_cars ADD COLUMN IF NOT EXISTS dealership_id uuid REFERENCES public.dealerships(id) DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.parked_cars SET dealership_id='00000000-0000-0000-0000-000000000001' WHERE dealership_id IS NULL;
ALTER TABLE public.parked_cars ALTER COLUMN dealership_id SET NOT NULL;

ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS dealership_id uuid REFERENCES public.dealerships(id) DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.pickup_requests SET dealership_id='00000000-0000-0000-0000-000000000001' WHERE dealership_id IS NULL;
ALTER TABLE public.pickup_requests ALTER COLUMN dealership_id SET NOT NULL;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS dealership_id uuid REFERENCES public.dealerships(id) DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.messages SET dealership_id='00000000-0000-0000-0000-000000000001' WHERE dealership_id IS NULL;
ALTER TABLE public.messages ALTER COLUMN dealership_id SET NOT NULL;

-- Helpers
CREATE OR REPLACE FUNCTION private.dealership_of(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT dealership_id FROM public.profiles WHERE id = _uid
$$;

CREATE OR REPLACE FUNCTION private.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND is_active = true AND status = 'approved'
      AND (is_owner = true
           OR role_name IN ('Manager','Service Manager','Service Director','General Manager','Director'))
  )
$$;

CREATE OR REPLACE FUNCTION private.user_in_role_group(_uid uuid, _role_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON r.id = _role_id
    WHERE p.id = _uid
      AND (
        p.role_id = _role_id
        OR (r.name = 'Valet' AND p.role_name = 'Valet & Parts')
      )
  )
$$;

-- Trigger to auto-set dealership_id from the caller's profile
CREATE OR REPLACE FUNCTION public.set_dealership_from_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.dealership_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.dealership_id := private.dealership_of(auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS parked_cars_set_dealership ON public.parked_cars;
CREATE TRIGGER parked_cars_set_dealership BEFORE INSERT ON public.parked_cars
FOR EACH ROW EXECUTE FUNCTION public.set_dealership_from_user();

DROP TRIGGER IF EXISTS pickups_set_dealership ON public.pickup_requests;
CREATE TRIGGER pickups_set_dealership BEFORE INSERT ON public.pickup_requests
FOR EACH ROW EXECUTE FUNCTION public.set_dealership_from_user();

DROP TRIGGER IF EXISTS messages_set_dealership ON public.messages;
CREATE TRIGGER messages_set_dealership BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.set_dealership_from_user();

-- Tenant-scoped RLS
DROP POLICY IF EXISTS "profiles read" ON public.profiles;
CREATE POLICY "profiles read" ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR private.is_owner(auth.uid())
  OR (
    private.is_approved(auth.uid())
    AND status = 'approved' AND is_active = true
    AND dealership_id = private.dealership_of(auth.uid())
  )
);

DROP POLICY IF EXISTS "messages read own or addressed" ON public.messages;
CREATE POLICY "messages read own or addressed" ON public.messages FOR SELECT USING (
  private.is_approved(auth.uid())
  AND dealership_id = private.dealership_of(auth.uid())
  AND (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (recipient_role_id IS NOT NULL AND private.user_in_role_group(auth.uid(), recipient_role_id))
    OR thread_id ~~ ('group:%:' || auth.uid()::text)
  )
);

DROP POLICY IF EXISTS "parked_cars readable by auth" ON public.parked_cars;
CREATE POLICY "parked_cars readable by tenant" ON public.parked_cars FOR SELECT USING (
  dealership_id = private.dealership_of(auth.uid())
);

DROP POLICY IF EXISTS "pickups readable by auth" ON public.pickup_requests;
CREATE POLICY "pickups readable by tenant" ON public.pickup_requests FOR SELECT USING (
  dealership_id = private.dealership_of(auth.uid())
);
