CREATE TABLE public.audit_runs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'complete',
  score INTEGER,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_runs_created_at_idx ON public.audit_runs (created_at DESC);

GRANT SELECT, INSERT ON public.audit_runs TO anon;
GRANT SELECT, INSERT ON public.audit_runs TO authenticated;
GRANT ALL ON public.audit_runs TO service_role;

ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audit runs"
ON public.audit_runs FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can save an audit run"
ON public.audit_runs FOR INSERT
TO anon, authenticated
WITH CHECK (true);