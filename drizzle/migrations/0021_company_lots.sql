CREATE TABLE public.company_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  lot_name text NOT NULL CHECK (char_length(btrim(lot_name)) BETWEEN 1 AND 120),
  label_type text NOT NULL CHECK (label_type IN ('numbers','letters','letters_numbers','none')),
  prefix text CHECK (prefix IS NULL OR char_length(prefix) <= 40),
  range_start text CHECK (range_start IS NULL OR char_length(range_start) <= 10),
  range_end text CHECK (range_end IS NULL OR char_length(range_end) <= 10),
  has_blocking boolean NOT NULL DEFAULT false,
  blocking_explanation text CHECK (blocking_explanation IS NULL OR char_length(blocking_explanation) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_lots_dealership_idx ON public.company_lots(dealership_id, lot_name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_lots TO authenticated;
GRANT ALL ON public.company_lots TO service_role;
ALTER TABLE public.company_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads lots" ON public.company_lots FOR SELECT TO authenticated USING (dealership_id = private.dealership_of(auth.uid()) AND private.is_approved(auth.uid()));
CREATE POLICY "management edits lots" ON public.company_lots FOR ALL TO authenticated USING (dealership_id = private.dealership_of(auth.uid()) AND private.is_upper_management(auth.uid()) AND NOT private.is_spectator(auth.uid())) WITH CHECK (dealership_id = private.dealership_of(auth.uid()) AND private.is_upper_management(auth.uid()) AND NOT private.is_spectator(auth.uid()));