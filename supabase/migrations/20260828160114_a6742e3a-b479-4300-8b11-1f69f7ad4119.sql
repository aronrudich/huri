ALTER TABLE public.car_events DROP CONSTRAINT car_events_actor_id_fkey;
ALTER TABLE public.car_events ADD CONSTRAINT car_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.car_washes DROP CONSTRAINT car_washes_washed_by_fkey;
ALTER TABLE public.car_washes ADD CONSTRAINT car_washes_washed_by_fkey FOREIGN KEY (washed_by) REFERENCES auth.users(id) ON DELETE SET NULL;