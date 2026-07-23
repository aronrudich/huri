DROP POLICY IF EXISTS "messages read own or addressed" ON public.messages;
CREATE POLICY "messages read own or addressed" ON public.messages FOR SELECT USING (
  private.is_approved(auth.uid())
  AND dealership_id = private.dealership_of(auth.uid())
  AND (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (recipient_role_id IS NOT NULL AND private.user_in_role_group(auth.uid(), recipient_role_id))
    OR thread_id ~~ ('group:%:' || auth.uid()::text)
    OR (thread_id ~~ 'gm:%' AND thread_id ~~ ('%' || auth.uid()::text || '%'))
  )
);