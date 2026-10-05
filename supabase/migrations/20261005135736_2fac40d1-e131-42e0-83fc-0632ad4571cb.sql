ALTER TABLE public.help_messages ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE POLICY "help attachments upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'help-attachments' AND ((storage.foldername(name))[1] = auth.uid()::text OR private.is_huri_support(auth.uid())));

CREATE POLICY "help attachments read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'help-attachments' AND ((storage.foldername(name))[1] = auth.uid()::text OR private.is_huri_support(auth.uid())));

CREATE OR REPLACE FUNCTION private.user_in_role_group(_uid uuid, _role_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON r.id = _role_id
    WHERE p.id = _uid
      AND (
        p.role_id = _role_id
        OR (r.name = 'Valet' AND p.role_name IN ('Valet & Parts', 'Valet Supervisor'))
      )
  )
$$;