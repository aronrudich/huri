DROP POLICY IF EXISTS "recipients can mark read" ON public.messages;

CREATE POLICY "recipients can mark read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  private.is_approved(auth.uid())
  AND dealership_id = private.dealership_of(auth.uid())
  AND (
    recipient_id = auth.uid()
    OR (recipient_role_id IS NOT NULL AND private.user_in_role_group(auth.uid(), recipient_role_id))
    OR thread_id LIKE ('group:%:' || auth.uid()::text)
  )
)
WITH CHECK (
  private.is_approved(auth.uid())
  AND dealership_id = private.dealership_of(auth.uid())
  AND (
    recipient_id = auth.uid()
    OR (recipient_role_id IS NOT NULL AND private.user_in_role_group(auth.uid(), recipient_role_id))
    OR thread_id LIKE ('group:%:' || auth.uid()::text)
  )
);