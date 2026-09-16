CREATE TABLE public.audit_usage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id text REFERENCES public.audit_runs(id) ON DELETE CASCADE,
  job_id text,
  provider text NOT NULL,
  agent_type text NOT NULL DEFAULT 'funnel',
  metric_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL,
  model text,
  status text NOT NULL DEFAULT 'complete',
  note text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_usage_events_quantity_nonneg CHECK (quantity >= 0)
);

CREATE INDEX audit_usage_events_run_id_idx ON public.audit_usage_events (run_id);
CREATE INDEX audit_usage_events_occurred_at_idx ON public.audit_usage_events (occurred_at DESC);
CREATE UNIQUE INDEX audit_usage_events_dedupe_idx
  ON public.audit_usage_events (run_id, provider, agent_type, metric_name, coalesce(model, ''), coalesce(job_id, ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_usage_events TO authenticated;
GRANT ALL ON public.audit_usage_events TO service_role;

ALTER TABLE public.audit_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read usage events"
  ON public.audit_usage_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can add usage events"
  ON public.audit_usage_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update usage events"
  ON public.audit_usage_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users can delete usage events"
  ON public.audit_usage_events FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_audit_usage_events_updated_at
  BEFORE UPDATE ON public.audit_usage_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();