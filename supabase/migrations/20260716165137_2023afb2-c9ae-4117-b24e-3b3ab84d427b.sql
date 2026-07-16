CREATE UNIQUE INDEX IF NOT EXISTS parked_cars_one_active_ro_per_dealership
ON public.parked_cars (dealership_id, lower(btrim(ro_number)))
WHERE ro_number IS NOT NULL AND btrim(ro_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS parked_cars_one_car_per_real_spot_per_dealership
ON public.parked_cars (dealership_id, upper(lot_position))
WHERE lot_position IS NOT NULL AND upper(lot_position) NOT IN ('0', 'UNKNOWN');