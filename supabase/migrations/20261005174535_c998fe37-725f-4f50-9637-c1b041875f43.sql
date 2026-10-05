ALTER TABLE public.business_onboarding_drafts DROP CONSTRAINT IF EXISTS business_onboarding_drafts_status_check;
ALTER TABLE public.business_onboarding_drafts ADD CONSTRAINT business_onboarding_drafts_status_check
  CHECK (status IN ('draft','submitted','changes_requested','approved','activated'));
ALTER TABLE public.business_onboarding_drafts
  ADD COLUMN IF NOT EXISTS review_message text CHECK (length(review_message) <= 3000),
  ADD COLUMN IF NOT EXISTS reviewer_notes text CHECK (length(reviewer_notes) <= 5000),
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.business_inquiries DROP CONSTRAINT IF EXISTS business_inquiries_status_check;
ALTER TABLE public.business_inquiries ADD CONSTRAINT business_inquiries_status_check
  CHECK (status IN ('new','contacted','onboarding_sent','onboarding_started','submitted_for_review','changes_requested','approved','declined'));
ALTER TABLE public.business_inquiries
  ADD COLUMN IF NOT EXISTS company_id uuid UNIQUE REFERENCES public.dealerships(id),
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_emailed_at timestamptz;

ALTER TABLE public.dealerships ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'dealership';

CREATE TABLE public.business_onboarding_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.business_inquiries(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_label text NOT NULL DEFAULT 'Huri',
  section text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_onboarding_activity TO authenticated;
GRANT ALL ON public.business_onboarding_activity TO service_role;
ALTER TABLE public.business_onboarding_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Huri support reads onboarding activity" ON public.business_onboarding_activity
  FOR SELECT TO authenticated USING (private.is_huri_support(auth.uid()));
CREATE INDEX business_onboarding_activity_idx ON public.business_onboarding_activity (inquiry_id, created_at DESC);

CREATE TABLE public.company_map_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  geometry jsonb NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.company_map_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES public.company_map_lots(id) ON DELETE CASCADE,
  label text NOT NULL,
  geometry jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.company_map_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES public.company_map_lots(id) ON DELETE CASCADE,
  row_id uuid REFERENCES public.company_map_rows(id) ON DELETE SET NULL,
  label text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lot_id, label)
);
CREATE TABLE public.company_map_property (
  dealership_id uuid PRIMARY KEY REFERENCES public.dealerships(id) ON DELETE CASCADE,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  center jsonb,
  boundary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_map_lots, public.company_map_rows, public.company_map_spots, public.company_map_property TO authenticated;
GRANT ALL ON public.company_map_lots, public.company_map_rows, public.company_map_spots, public.company_map_property TO service_role;
ALTER TABLE public.company_map_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_map_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_map_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_map_property ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company lots readable by tenant or support" ON public.company_map_lots FOR SELECT TO authenticated
  USING ((dealership_id = private.dealership_of(auth.uid()) AND private.is_approved(auth.uid())) OR private.is_huri_support(auth.uid()));
CREATE POLICY "company rows readable by tenant or support" ON public.company_map_rows FOR SELECT TO authenticated
  USING ((dealership_id = private.dealership_of(auth.uid()) AND private.is_approved(auth.uid())) OR private.is_huri_support(auth.uid()));
CREATE POLICY "company spots readable by tenant or support" ON public.company_map_spots FOR SELECT TO authenticated
  USING ((dealership_id = private.dealership_of(auth.uid()) AND private.is_approved(auth.uid())) OR private.is_huri_support(auth.uid()));
CREATE POLICY "company property readable by tenant or support" ON public.company_map_property FOR SELECT TO authenticated
  USING ((dealership_id = private.dealership_of(auth.uid()) AND private.is_approved(auth.uid())) OR private.is_huri_support(auth.uid()));
CREATE TRIGGER company_map_lots_touch BEFORE UPDATE ON public.company_map_lots FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER company_map_rows_touch BEFORE UPDATE ON public.company_map_rows FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER company_map_spots_touch BEFORE UPDATE ON public.company_map_spots FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER company_map_property_touch BEFORE UPDATE ON public.company_map_property FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Atomic activation. Callable only by the server (service role) after it verifies Huri support.
CREATE OR REPLACE FUNCTION public.activate_business_onboarding(_inquiry_id uuid, _actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inq public.business_inquiries%ROWTYPE;
  dr public.business_onboarding_drafts%ROWTYPE;
  d record;
  new_id uuid;
  code text;
  base_slug text;
  slug_try text;
  lot jsonb; rw jsonb; sp jsonb;
  lot_map jsonb := '{}'::jsonb;
  row_map jsonb := '{}'::jsonb;
  new_lot uuid; new_row uuid;
  i int := 0;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  SELECT * INTO inq FROM public.business_inquiries WHERE id = _inquiry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inquiry not found'; END IF;
  IF inq.company_id IS NOT NULL THEN
    SELECT id, name, company_code, business_type INTO d FROM public.dealerships WHERE id = inq.company_id;
    RETURN jsonb_build_object('already', true, 'id', d.id, 'name', d.name, 'code', d.company_code, 'businessType', d.business_type, 'activatedAt', inq.activated_at);
  END IF;
  SELECT * INTO dr FROM public.business_onboarding_drafts WHERE inquiry_id = _inquiry_id FOR UPDATE;
  IF NOT FOUND OR dr.status <> 'approved' THEN RAISE EXCEPTION 'Map must be marked approved first'; END IF;

  LOOP
    code := '';
    FOR k IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN code <> 'JCD29854' AND NOT EXISTS (SELECT 1 FROM public.dealerships WHERE upper(company_code) = code);
  END LOOP;

  base_slug := trim(both '-' from regexp_replace(lower(coalesce(dr.data->>'businessName', inq.business_name)), '[^a-z0-9]+', '-', 'g'));
  IF base_slug = '' THEN base_slug := 'company'; END IF;
  slug_try := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.dealerships WHERE slug = slug_try) LOOP
    i := i + 1; slug_try := base_slug || '-' || i;
  END LOOP;

  INSERT INTO public.dealerships (name, slug, company_code, business_type)
  VALUES (left(coalesce(nullif(dr.data->>'businessName',''), inq.business_name), 160), slug_try, code, inq.business_type)
  RETURNING id INTO new_id;

  INSERT INTO public.company_map_property (dealership_id, address, center, boundary)
  VALUES (new_id, coalesce(dr.data->'address', '{}'::jsonb), dr.data->'center', dr.data->'boundary');

  i := 0;
  FOR lot IN SELECT * FROM jsonb_array_elements(coalesce(dr.data->'lots', '[]'::jsonb)) LOOP
    INSERT INTO public.company_map_lots (dealership_id, name, description, category, geometry, sort_order)
    VALUES (new_id, left(lot->>'name', 120), left(lot->>'description', 1000), lot->>'category', coalesce(lot->'polygon', '[]'::jsonb), i)
    RETURNING id INTO new_lot;
    lot_map := lot_map || jsonb_build_object(lot->>'id', new_lot);
    i := i + 1;
  END LOOP;
  FOR rw IN SELECT * FROM jsonb_array_elements(coalesce(dr.data->'rows', '[]'::jsonb)) LOOP
    IF lot_map ? (rw->>'lotId') THEN
      INSERT INTO public.company_map_rows (dealership_id, lot_id, label, geometry)
      VALUES (new_id, (lot_map->>(rw->>'lotId'))::uuid, left(rw->>'label', 60), coalesce(rw->'line', '[]'::jsonb))
      RETURNING id INTO new_row;
      row_map := row_map || jsonb_build_object(rw->>'id', new_row);
    END IF;
  END LOOP;
  FOR sp IN SELECT * FROM jsonb_array_elements(coalesce(dr.data->'spots', '[]'::jsonb)) LOOP
    IF lot_map ? (sp->>'lotId') THEN
      INSERT INTO public.company_map_spots (dealership_id, lot_id, row_id, label, lat, lng)
      VALUES (new_id, (lot_map->>(sp->>'lotId'))::uuid,
        CASE WHEN row_map ? coalesce(sp->>'rowId','') THEN (row_map->>(sp->>'rowId'))::uuid END,
        left(sp->>'label', 40), (sp->>'lat')::double precision, (sp->>'lng')::double precision)
      ON CONFLICT (lot_id, label) DO NOTHING;
    END IF;
  END LOOP;

  UPDATE public.business_inquiries SET company_id = new_id, status = 'approved', activated_at = now(), reviewed_by = _actor, reviewed_at = now() WHERE id = _inquiry_id;
  UPDATE public.business_onboarding_drafts SET status = 'activated' WHERE inquiry_id = _inquiry_id;
  UPDATE public.business_onboarding_links SET revoked_at = now() WHERE inquiry_id = _inquiry_id AND revoked_at IS NULL;
  INSERT INTO public.business_onboarding_activity (inquiry_id, actor_id, section, summary)
  VALUES (_inquiry_id, _actor, 'activation', jsonb_build_object('companyId', new_id, 'code', code));

  RETURN jsonb_build_object('already', false, 'id', new_id, 'name', (SELECT name FROM public.dealerships WHERE id = new_id), 'code', code, 'businessType', inq.business_type, 'activatedAt', now());
END $$;
REVOKE ALL ON FUNCTION public.activate_business_onboarding(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_business_onboarding(uuid, uuid) TO service_role;