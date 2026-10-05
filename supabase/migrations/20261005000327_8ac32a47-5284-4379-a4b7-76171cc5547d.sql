ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS customer_arrived_at timestamptz;

CREATE OR REPLACE FUNCTION private.is_huri_support(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _uid
    AND lower(u.email) = 'aron@huri.team' AND u.email_confirmed_at IS NOT NULL)
$$;
GRANT EXECUTE ON FUNCTION private.is_huri_support(uuid) TO authenticated;

CREATE TABLE public.help_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id),
  company_code text NOT NULL,
  dealership_name text NOT NULL DEFAULT '',
  user_name text NOT NULL,
  user_role text NOT NULL,
  user_email text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  hidden_by_user boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  user_read_at timestamptz,
  support_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.help_threads TO authenticated;
GRANT UPDATE (hidden_by_user, user_read_at, support_read_at, status, last_message_at) ON public.help_threads TO authenticated;
GRANT ALL ON public.help_threads TO service_role;
ALTER TABLE public.help_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or support read threads" ON public.help_threads FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_huri_support(auth.uid()));
CREATE POLICY "users create own thread" ON public.help_threads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "own or support update threads" ON public.help_threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.is_huri_support(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR private.is_huri_support(auth.uid()));
CREATE TRIGGER help_threads_touch BEFORE UPDATE ON public.help_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX help_threads_user_idx ON public.help_threads(user_id);

CREATE TABLE public.help_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.help_threads(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('user','support')),
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.help_messages TO authenticated;
GRANT ALL ON public.help_messages TO service_role;
ALTER TABLE public.help_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own thread messages" ON public.help_messages FOR SELECT TO authenticated
  USING (private.is_huri_support(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.help_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "users post to own thread" ON public.help_messages FOR INSERT TO authenticated
  WITH CHECK (
    (sender_type = 'user' AND sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.help_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()))
    OR (sender_type = 'support' AND sender_id = auth.uid() AND private.is_huri_support(auth.uid())));
CREATE INDEX help_messages_thread_idx ON public.help_messages(thread_id, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.help_messages;