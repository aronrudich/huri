CREATE OR REPLACE FUNCTION public.assign_lot_position(_target_id uuid,_ro_number text,_position text,_car_model text,_notes text,_confirm_displace boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,private AS $$
DECLARE n numeric; company uuid; pos text=upper(btrim(coalesce(_position,'UNKNOWN'))); target public.parked_cars; occupant public.parked_cars; result uuid;
BEGIN
 company=private.dealership_of(auth.uid());
 IF company IS NULL OR NOT private.is_active_employee(auth.uid()) OR NOT private.is_approved(auth.uid()) OR private.is_spectator(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 pos=regexp_replace(pos,'^SV[[:space:]]*','SV ');
 IF pos ~ '^SV [0-9]+$' THEN n=substring(pos from 4)::numeric; IF n<1 THEN RAISE EXCEPTION 'Spot number must be positive'; END IF; pos='SV '||n::text; END IF;
 IF length(pos)>60 THEN RAISE EXCEPTION 'Location must be 60 characters or fewer'; END IF;
 PERFORM 1 FROM public.dealerships WHERE id=company FOR UPDATE;
 IF _target_id IS NOT NULL THEN SELECT * INTO target FROM public.parked_cars WHERE id=_target_id AND dealership_id=company FOR UPDATE; END IF;
 IF target.id IS NULL AND nullif(btrim(_ro_number),'') IS NOT NULL THEN SELECT * INTO target FROM public.parked_cars WHERE dealership_id=company AND lower(btrim(ro_number))=lower(btrim(_ro_number)) ORDER BY created_at LIMIT 1 FOR UPDATE; END IF;
 IF public.is_physical_company_spot(company,pos) THEN
  SELECT * INTO occupant FROM public.parked_cars WHERE dealership_id=company AND upper(btrim(lot_position))=pos AND (target.id IS NULL OR id<>target.id) ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF occupant.id IS NOT NULL AND NOT _confirm_displace THEN RETURN jsonb_build_object('status','occupied','occupant_ro',occupant.ro_number,'occupant_model',occupant.car_model); END IF;
  IF occupant.id IS NOT NULL THEN UPDATE public.parked_cars SET lot_position='UNKNOWN' WHERE id=occupant.id; END IF;
 END IF;
 IF target.id IS NOT NULL THEN
 UPDATE public.parked_cars SET ro_number=btrim(_ro_number),car_model=coalesce(nullif(btrim(_car_model),''),target.car_model),lot_position=pos,notes=coalesce(_notes,target.notes),parked_by=auth.uid() WHERE id=target.id RETURNING id INTO result;
 ELSE INSERT INTO public.parked_cars(ro_number,car_model,lot_position,notes,parked_by,dealership_id) VALUES(btrim(_ro_number),_car_model,pos,_notes,auth.uid(),company) RETURNING id INTO result; END IF;
 RETURN jsonb_build_object('status','ok','id',result);
END $$;
REVOKE EXECUTE ON FUNCTION public.assign_lot_position(uuid,text,text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_lot_position(uuid,text,text,text,text,boolean) TO authenticated,service_role;