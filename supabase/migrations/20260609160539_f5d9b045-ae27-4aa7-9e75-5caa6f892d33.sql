
-- 1) Profile activation / hierarchy fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) New roles
INSERT INTO public.roles (name, is_group) VALUES
  ('General Manager', false),
  ('Shop Foreman', false)
ON CONFLICT (name) DO NOTHING;

-- 3) Spot validation: numeric 1..147 or 'UNKNOWN'
CREATE OR REPLACE FUNCTION public.validate_spot() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.lot_position IS NULL OR NEW.lot_position = '' THEN
    NEW.lot_position := 'UNKNOWN';
  END IF;
  IF NEW.lot_position <> 'UNKNOWN' THEN
    IF NEW.lot_position !~ '^[0-9]+$' OR NEW.lot_position::int < 1 OR NEW.lot_position::int > 147 THEN
      RAISE EXCEPTION 'Spot must be 1-147 or UNKNOWN, got %', NEW.lot_position;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS parked_cars_validate_spot ON public.parked_cars;
CREATE TRIGGER parked_cars_validate_spot BEFORE INSERT OR UPDATE ON public.parked_cars
  FOR EACH ROW EXECUTE FUNCTION public.validate_spot();

-- 4) Seed demo parked cars (idempotent via tag_number UNIQUE)
INSERT INTO public.parked_cars (tag_number, ro_number, car_model, lot_position, notes) VALUES
  ('8812','RO45120','Toyota Tundra TRD','82',NULL),
  ('6630','RO45121','Toyota 4Runner SR5','84',NULL),
  ('7741','RO45122','Toyota Camry XSE','83','Battery dead — bring jumper'),
  ('9023','RO45123','Toyota RAV4 Hybrid','12',NULL),
  ('4455','RO45124','Toyota Tacoma TRD Pro','45','Key fob broken, use spare'),
  ('3318','RO45125','Toyota Highlander Limited','46',NULL),
  ('2207','RO45126','Toyota Corolla LE','47',NULL),
  ('1190','RO45127','Toyota Sienna XLE','100',NULL),
  ('5582','RO45128','Toyota Prius Prime','101','Charging cable in trunk'),
  ('8844','RO45129','Toyota Sequoia Platinum','7',NULL),
  ('9921','RO45130','Toyota Avalon Touring','8',NULL),
  ('6677','RO45131','Toyota GR Supra','9','Customer wants car washed before pickup'),
  ('4413','RO45132','Toyota Venza','21',NULL),
  ('3344','RO45133','Toyota C-HR XLE','22',NULL),
  ('7788','RO45134','Toyota Mirai','60',NULL),
  ('8866','RO45135','Toyota bZ4X','61','Low tire pressure — front right'),
  ('2255','RO45136','Toyota Land Cruiser','62',NULL),
  ('1133','RO45137','Lexus RX 350','120',NULL),
  ('9944','RO45138','Lexus ES 350','121',NULL),
  ('5511','RO45139','Lexus NX 250','122',NULL),
  ('6622','RO45140','Toyota Tundra Limited','33',NULL),
  ('7733','RO45141','Toyota 4Runner TRD Off-Road','34','Won''t start — needs diagnostic'),
  ('8844','RO45142','Toyota Camry SE','35',NULL) ON CONFLICT (tag_number) DO NOTHING;

INSERT INTO public.parked_cars (tag_number, ro_number, car_model, lot_position, notes) VALUES
  ('0011','RO45143','Toyota Tacoma SR5','55',NULL),
  ('0022','RO45144','Toyota RAV4 Adventure','56',NULL),
  ('0033','RO45145','Toyota Highlander Hybrid','57','Loose interior trim — flagged'),
  ('0044','RO45146','Toyota Corolla Hatchback','70',NULL),
  ('0055','RO45147','Toyota Prius LE','71',NULL),
  ('0066','RO45148','Toyota Sienna LE','72',NULL),
  ('0077','RO45149','Toyota Camry Hybrid','95',NULL),
  ('0088','RO45150','Toyota Tundra SR5','96','Customer requested no car wash'),
  ('0099','RO45151','Toyota 4Runner Limited','97',NULL),
  ('1212','RO45152','Toyota Tacoma TRD Sport','110',NULL),
  ('1313','RO45153','Toyota RAV4 LE','111',NULL),
  ('1414','RO45154','Toyota Highlander L','130',NULL),
  ('1515','RO45155','Toyota Corolla SE','131','Engine light on — needs scan'),
  ('1616','RO45156','Toyota Avalon Hybrid','132',NULL),
  ('1717','RO45157','Toyota Sienna Platinum','140',NULL),
  ('1818','RO45158','Toyota GR Corolla','141',NULL),
  ('1919','RO45159','Toyota Crown','142',NULL)
ON CONFLICT (tag_number) DO NOTHING;

-- 5) Seed pickup queue (mix of unclaimed + claimed)
INSERT INTO public.pickup_requests (tag_number, ro_number, advisor_name, car_model, status, created_at)
VALUES
  ('7741','RO45122','Marcus Chen','Toyota Camry XSE','unclaimed', now() - interval '2 minutes'),
  ('4455','RO45124','Priya Patel','Toyota Tacoma TRD Pro','unclaimed', now() - interval '5 minutes'),
  ('6677','RO45131','Jamal Wright','Toyota GR Supra','unclaimed', now() - interval '8 minutes'),
  ('8866','RO45135','Sofia Ramirez','Toyota bZ4X','unclaimed', now() - interval '12 minutes'),
  ('1515','RO45155','Marcus Chen','Toyota Corolla SE','unclaimed', now() - interval '15 minutes'),
  ('0033','RO45145','Tariq Johnson','Toyota Highlander Hybrid','unclaimed', now() - interval '18 minutes'),
  ('5582','RO45128','Priya Patel','Toyota Prius Prime','unclaimed', now() - interval '22 minutes'),
  ('7733','RO45141','Jamal Wright','Toyota 4Runner TRD Off-Road','claimed', now() - interval '30 minutes'),
  ('9023','RO45123','Sofia Ramirez','Toyota RAV4 Hybrid','claimed', now() - interval '35 minutes'),
  ('0088','RO45150','Marcus Chen','Toyota Tundra SR5','unclaimed', now() - interval '28 minutes'),
  ('1133','RO45137','Tariq Johnson','Lexus RX 350','unclaimed', now() - interval '40 minutes'),
  ('3318','RO45125','Priya Patel','Toyota Highlander Limited','unclaimed', now() - interval '1 minute');

-- Mark the two "claimed" rows with a claim time so the 45-min auto-archive works
UPDATE public.pickup_requests
  SET claimed_at = now() - interval '10 minutes'
  WHERE status = 'claimed' AND claimed_at IS NULL;
