SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '20s';
CREATE INDEX IF NOT EXISTS car_events_location_snapshot_idx
ON public.car_events (dealership_id, ro_number, created_at DESC, id DESC)
WHERE ro_number IS NOT NULL AND event_type IN ('logged', 'moved', 'deleted');
CREATE INDEX IF NOT EXISTS pickup_requests_ro_history_idx
ON public.pickup_requests (dealership_id, ro_number, created_at, id);
COMMENT ON INDEX public.car_events_location_snapshot_idx IS 'Supports ordered historical lot snapshots without changing report eligibility or history.';
COMMENT ON INDEX public.pickup_requests_ro_history_idx IS 'Supports tenant-scoped per-RO custody lookbacks and vehicle history without changing request data.';