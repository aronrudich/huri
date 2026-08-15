REVOKE ALL ON FUNCTION public.log_car_event(uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.car_events_from_parked_cars() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.car_events_from_pickups() FROM PUBLIC, anon, authenticated;