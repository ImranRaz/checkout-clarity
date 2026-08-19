REVOKE EXECUTE ON FUNCTION public.get_shared_report(text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_report(text) TO service_role;