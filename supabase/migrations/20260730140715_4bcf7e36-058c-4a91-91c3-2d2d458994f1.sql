CREATE OR REPLACE FUNCTION public.archive_stale_pickups()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Technician-submitted pickups: the car ends up in the tech lot / a bay -> Lot T.
  UPDATE public.parked_cars pc
    SET lot_position = 'T'
    FROM public.pickup_requests pr
    WHERE pr.status = 'claimed'
      AND pr.claimed_at <= now() - interval '60 minutes'
      AND pr.ro_number IS NOT NULL
      AND pr.source_role IN ('Technician', 'Shop Foreman')
      AND pc.ro_number = pr.ro_number
      AND pc.dealership_id = pr.dealership_id;

  -- Everyone else: the car left for the customer, location unknown until re-parked.
  UPDATE public.parked_cars pc
    SET lot_position = 'UNKNOWN'
    FROM public.pickup_requests pr
    WHERE pr.status = 'claimed'
      AND pr.claimed_at <= now() - interval '60 minutes'
      AND pr.ro_number IS NOT NULL
      AND (pr.source_role IS NULL OR pr.source_role NOT IN ('Technician', 'Shop Foreman'))
      AND pc.ro_number = pr.ro_number
      AND pc.dealership_id = pr.dealership_id;

  UPDATE public.pickup_requests
    SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE status = 'claimed'
      AND claimed_at <= now() - interval '60 minutes';
END;
$function$;