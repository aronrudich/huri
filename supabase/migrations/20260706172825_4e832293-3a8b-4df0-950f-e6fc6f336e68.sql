
DROP POLICY IF EXISTS "messages read approved" ON public.messages;

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
        WHERE p.id = auth.uid()
          AND p.role_id = messages.recipient_role_id
      )
    )
  )
);
