CREATE INDEX IF NOT EXISTS car_events_dealership_created_idx ON public.car_events (dealership_id, created_at);
CREATE OR REPLACE FUNCTION public.lot_snapshot_at(_at timestamptz)
RETURNS TABLE(dealership_id uuid, ro_number text, event_type text, detail text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT DISTINCT ON (e.dealership_id, e.ro_number) e.dealership_id, e.ro_number, e.event_type, e.detail, e.created_at
  FROM public.car_events e
  WHERE e.created_at < _at AND e.ro_number IS NOT NULL
    AND e.event_type IN ('logged','moved','deleted')
  ORDER BY e.dealership_id, e.ro_number, e.created_at DESC, e.id DESC
$$;
GRANT EXECUTE ON FUNCTION public.lot_snapshot_at(timestamptz) TO authenticated;