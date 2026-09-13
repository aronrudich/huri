CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.signup_attempts TO service_role;

ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the server (service role) may touch this table.

CREATE INDEX IF NOT EXISTS signup_attempts_key_time_idx
  ON public.signup_attempts (attempt_key, created_at DESC);