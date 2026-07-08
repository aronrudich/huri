
-- 1. source_role column on pickup_requests
ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS source_role text;
UPDATE public.pickup_requests SET source_role = 'Advisor' WHERE source_role IS NULL;

-- 2. Migrate legacy group thread ids -> per-starter format
DO $$
DECLARE
  r RECORD;
  starter uuid;
  new_tid text;
BEGIN
  FOR r IN
    SELECT DISTINCT thread_id
    FROM public.messages
    WHERE thread_id LIKE 'group:%'
      AND thread_id !~ '^group:[^:]+:[^:]+$'
  LOOP
    SELECT sender_id INTO starter
    FROM public.messages
    WHERE thread_id = r.thread_id AND sender_id IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1;
    IF starter IS NOT NULL THEN
      new_tid := r.thread_id || ':' || starter::text;
      UPDATE public.messages SET thread_id = new_tid WHERE thread_id = r.thread_id;
    END IF;
  END LOOP;
END $$;

-- 3. Update messages SELECT policy: allow starter of a group thread to read replies
DROP POLICY IF EXISTS "messages read own or addressed" ON public.messages;
CREATE POLICY "messages read own or addressed"
ON public.messages
FOR SELECT
TO authenticated
USING (
  private.is_approved(auth.uid())
  AND (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (
      recipient_role_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role_id = messages.recipient_role_id
      )
    )
    OR (
      thread_id LIKE 'group:%:' || auth.uid()::text
    )
  )
);
