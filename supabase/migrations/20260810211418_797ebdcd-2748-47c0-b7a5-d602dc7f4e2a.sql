DROP INDEX IF EXISTS public.parked_cars_one_car_per_numbered_spot;

CREATE UNIQUE INDEX parked_cars_one_car_per_numbered_spot
ON public.parked_cars (dealership_id, upper(btrim(lot_position)))
WHERE upper(btrim(lot_position)) ~ '^SV ([1-9]|[1-9][0-9]|1[0-3][0-9]|14[0-7])$';

INSERT INTO public.roles (name, is_group)
VALUES ('Shuttle', true), ('Valet & Shuttle', true), ('Admin', true)
ON CONFLICT (name) DO NOTHING;