REVOKE EXECUTE ON FUNCTION public.log_car_event(uuid, text, text, text, text, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.archive_stale_pickups() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.directory_for(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.message_recipients_for(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.add_tech_car_on_pickup_complete() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.car_events_from_parked_cars() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.car_events_from_pickups() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.record_wash_on_leaving_wash() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_dealership_from_user() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.log_car_event(uuid, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_stale_pickups() TO service_role;
GRANT EXECUTE ON FUNCTION public.directory_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.message_recipients_for(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.assign_lot_position(uuid, text, text, text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_pickup_request(uuid) TO authenticated, service_role;