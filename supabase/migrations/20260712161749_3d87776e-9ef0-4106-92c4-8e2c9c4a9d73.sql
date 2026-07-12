
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS messages_thread_read_idx ON public.messages (thread_id, read_at);

DROP POLICY IF EXISTS "recipients can mark read" ON public.messages;
CREATE POLICY "recipients can mark read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  recipient_id = auth.uid()
  OR (
    recipient_role_id IS NOT NULL
    AND recipient_role_id IN (
      SELECT role_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  OR thread_id LIKE 'group:%:' || auth.uid()::text
)
WITH CHECK (
  recipient_id = auth.uid()
  OR (
    recipient_role_id IS NOT NULL
    AND recipient_role_id IN (
      SELECT role_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  OR thread_id LIKE 'group:%:' || auth.uid()::text
);
