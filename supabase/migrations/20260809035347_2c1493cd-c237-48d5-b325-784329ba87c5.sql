GRANT SELECT, INSERT ON public.audit_runs TO anon;
GRANT SELECT, INSERT ON public.audit_runs TO authenticated;
GRANT ALL ON public.audit_runs TO service_role;