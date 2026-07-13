CREATE TABLE IF NOT EXISTS public.thread_hides (
  user_id uuid NOT NULL,
  thread_id text NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  dealership_id uuid NOT NULL DEFAULT private.dealership_of(auth.uid()),
  PRIMARY KEY (user_id, thread_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_hides TO authenticated;
GRANT ALL ON public.thread_hides TO service_role;

ALTER TABLE public.thread_hides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thread hides own rows" ON public.thread_hides;
CREATE POLICY "thread hides own rows"
ON public.thread_hides
FOR ALL
TO authenticated
USING (user_id = auth.uid() AND dealership_id = private.dealership_of(auth.uid()))
WITH CHECK (user_id = auth.uid() AND dealership_id = private.dealership_of(auth.uid()));

CREATE OR REPLACE FUNCTION public.archive_stale_pickups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.parked_cars pc
    SET lot_position = 'UNKNOWN'
    FROM public.pickup_requests pr
    WHERE pr.status = 'claimed'
      AND pr.claimed_at <= now() - interval '60 minutes'
      AND pr.ro_number IS NOT NULL
      AND pc.ro_number = pr.ro_number
      AND pc.dealership_id = pr.dealership_id;

  UPDATE public.pickup_requests
    SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE status = 'claimed'
      AND claimed_at <= now() - interval '60 minutes';
END;
$function$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'thread_hides'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_hides;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive-stale-pickups-every-minute') THEN
    PERFORM cron.unschedule('archive-stale-pickups-every-minute');
  END IF;

  PERFORM cron.schedule(
    'archive-stale-pickups-every-minute',
    '* * * * *',
    'SELECT public.archive_stale_pickups();'
  );
END $$;

SELECT public.archive_stale_pickups();