ALTER TABLE public.audit_runs ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
UPDATE public.audit_runs SET featured = true WHERE id IN ('live-msumww70','live-msosdcwb');
CREATE POLICY "Signed-in users can update audit runs" ON public.audit_runs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);