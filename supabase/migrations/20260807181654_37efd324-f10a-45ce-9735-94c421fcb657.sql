ALTER TABLE public.parked_cars ADD COLUMN IF NOT EXISTS is_staged boolean NOT NULL DEFAULT false;
ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS is_staged boolean NOT NULL DEFAULT false;