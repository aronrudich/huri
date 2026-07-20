ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_dealership_phone_uidx
  ON public.profiles (dealership_id, phone_number)
  WHERE phone_number IS NOT NULL;