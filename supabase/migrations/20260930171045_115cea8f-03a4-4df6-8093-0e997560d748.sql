CREATE TABLE public.api_cache (
  key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_cache TO anon;
GRANT SELECT ON public.api_cache TO authenticated;
GRANT ALL ON public.api_cache TO service_role;
ALTER TABLE public.api_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cached FPL data is publicly readable" ON public.api_cache FOR SELECT TO anon, authenticated USING (true);