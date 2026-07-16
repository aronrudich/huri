ALTER TABLE public.pickup_requests
  ADD COLUMN IF NOT EXISTS lot_position text,
  ADD COLUMN IF NOT EXISTS car_notes text;