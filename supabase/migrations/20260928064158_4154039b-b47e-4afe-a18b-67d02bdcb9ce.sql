-- Customer arrival ETA: the exact time the customer says they'll arrive.
ALTER TABLE public.pickup_requests
  ADD COLUMN IF NOT EXISTS customer_eta timestamptz;

-- Public customer-arrival handle (never the private employee company code).
UPDATE public.dealerships SET slug = 'ontario' WHERE company_code = 'JCD29854';

CREATE INDEX IF NOT EXISTS pickup_requests_customer_eta_idx
  ON public.pickup_requests (dealership_id, customer_eta)
  WHERE customer_eta IS NOT NULL;