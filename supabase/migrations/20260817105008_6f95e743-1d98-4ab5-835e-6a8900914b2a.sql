CREATE TABLE public.share_links (
  token text PRIMARY KEY,
  run_id text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_links TO authenticated;
GRANT ALL ON public.share_links TO service_role;

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage share links"
ON public.share_links FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX share_links_run_id_idx ON public.share_links (run_id);

-- Lock down audit_runs: signed-in only.
DROP POLICY IF EXISTS "Anyone can read audit runs" ON public.audit_runs;
DROP POLICY IF EXISTS "Anyone can save an audit run" ON public.audit_runs;
DROP POLICY IF EXISTS "Anyone can delete unscored or unfinished runs" ON public.audit_runs;

REVOKE ALL ON public.audit_runs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_runs TO authenticated;
GRANT ALL ON public.audit_runs TO service_role;

CREATE POLICY "Signed-in users can read audit runs"
ON public.audit_runs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Signed-in users can save audit runs"
ON public.audit_runs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Signed-in users can delete audit runs"
ON public.audit_runs FOR DELETE TO authenticated USING (true);

-- Token-scoped public read: the only anonymous path to a report.
CREATE OR REPLACE FUNCTION public.get_shared_report(_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _run_id text;
  _report jsonb;
BEGIN
  SELECT run_id INTO _run_id
  FROM public.share_links
  WHERE token = _token
    AND revoked = false
    AND (expires_at IS NULL OR expires_at > now());

  IF _run_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT report INTO _report FROM public.audit_runs WHERE id = _run_id;
  IF _report IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.share_links
  SET view_count = view_count + 1, last_viewed_at = now()
  WHERE token = _token;

  RETURN _report;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_report(text) TO anon, authenticated, service_role;