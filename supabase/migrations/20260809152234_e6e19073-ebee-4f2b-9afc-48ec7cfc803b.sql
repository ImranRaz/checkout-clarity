CREATE POLICY "Anyone can delete unscored or unfinished runs"
ON public.audit_runs
FOR DELETE
TO anon, authenticated
USING (score IS NULL OR status <> 'complete');

GRANT DELETE ON public.audit_runs TO anon, authenticated;