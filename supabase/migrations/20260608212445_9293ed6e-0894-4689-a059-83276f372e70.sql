
-- ROLES (dynamic)
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_group boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.roles TO authenticated;
GRANT SELECT ON public.roles TO anon;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable by all" ON public.roles FOR SELECT USING (true);
CREATE POLICY "auth can add roles" ON public.roles FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO public.roles (name) VALUES
  ('Advisor'), ('Technician'), ('Valet'), ('Manager'), ('Director');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  nickname text,
  email text NOT NULL,
  phone text,
  role_id uuid REFERENCES public.roles(id),
  role_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- MESSAGES
-- thread_id groups DMs/group blasts. For DM: deterministic from sorted pair. For group: 'group:<role_id>'.
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread_idx ON public.messages (thread_id, created_at DESC);
CREATE INDEX messages_recipient_idx ON public.messages (recipient_id);
CREATE INDEX messages_recipient_role_idx ON public.messages (recipient_role_id);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages readable by auth" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "messages insert by auth" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    (is_anonymous = true AND sender_id IS NULL)
    OR (is_anonymous = false AND sender_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- PARKED CARS
CREATE TABLE public.parked_cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_number text NOT NULL UNIQUE,
  ro_number text,
  car_model text,
  lot_position text NOT NULL DEFAULT 'UNKNOWN',
  notes text,
  parked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX parked_cars_lot_idx ON public.parked_cars (lot_position);
CREATE INDEX parked_cars_ro_idx ON public.parked_cars (ro_number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parked_cars TO authenticated;
GRANT ALL ON public.parked_cars TO service_role;
ALTER TABLE public.parked_cars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parked_cars readable by auth" ON public.parked_cars FOR SELECT TO authenticated USING (true);
CREATE POLICY "parked_cars insert by auth" ON public.parked_cars FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "parked_cars update by auth" ON public.parked_cars FOR UPDATE TO authenticated USING (true);
CREATE POLICY "parked_cars delete by auth" ON public.parked_cars FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.parked_cars;

-- PICKUP REQUESTS
CREATE TABLE public.pickup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_number text,
  ro_number text,
  advisor_name text,
  car_model text,
  status text NOT NULL DEFAULT 'unclaimed' CHECK (status IN ('unclaimed','claimed','completed')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pickup_status_idx ON public.pickup_requests (status, created_at);
GRANT SELECT, INSERT, UPDATE ON public.pickup_requests TO authenticated;
GRANT ALL ON public.pickup_requests TO service_role;
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pickups readable by auth" ON public.pickup_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "pickups insert by auth" ON public.pickup_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pickups update by auth" ON public.pickup_requests FOR UPDATE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pickup_requests;

-- PUSH SUBSCRIPTIONS
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subs_user_idx ON public.push_subscriptions (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push own select" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "push own insert" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "push own delete" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- updated_at trigger for parked_cars
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER parked_cars_touch BEFORE UPDATE ON public.parked_cars
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-archive function: marks claimed pickups complete after 45 min and clears parked car spot
CREATE OR REPLACE FUNCTION public.archive_stale_pickups() RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.parked_cars pc SET lot_position = 'UNKNOWN'
    FROM public.pickup_requests pr
    WHERE pr.status = 'claimed'
      AND pr.claimed_at < now() - interval '45 minutes'
      AND pr.tag_number IS NOT NULL
      AND pc.tag_number = pr.tag_number;
  UPDATE public.pickup_requests
    SET status = 'completed', completed_at = now()
    WHERE status = 'claimed' AND claimed_at < now() - interval '45 minutes';
END; $$;
GRANT EXECUTE ON FUNCTION public.archive_stale_pickups() TO authenticated, anon;
