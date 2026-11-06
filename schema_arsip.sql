
BEGIN;

CREATE TABLE IF NOT EXISTS public.archives (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                text NOT NULL,
  title               text NOT NULL,
  summary             text NOT NULL DEFAULT '',
  readme              text NOT NULL DEFAULT '',
  authors             text NOT NULL DEFAULT '',
  year                integer,
  tags                text[] NOT NULL DEFAULT '{}',
  stack               text[] NOT NULL DEFAULT '{}',
  status              text NOT NULL DEFAULT 'final',
  visibility          text NOT NULL DEFAULT 'public',
  repo_url            text,
  demo_url            text,
  verification_status text NOT NULL DEFAULT 'pending',
  verification_notes  text NOT NULL DEFAULT '',
  verified_at         timestamptz,
  verified_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by          uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.archives
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS readme text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS authors text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stack text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'final',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS repo_url text,
  ADD COLUMN IF NOT EXISTS demo_url text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.archives
SET visibility = 'public',
    verification_status = COALESCE(verification_status, 'pending')
WHERE visibility IS DISTINCT FROM 'public'
   OR verification_status IS NULL;

ALTER TABLE public.archives
  ALTER COLUMN kind SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN visibility SET DEFAULT 'public',
  ALTER COLUMN visibility SET NOT NULL,
  ALTER COLUMN verification_status SET DEFAULT 'pending',
  ALTER COLUMN verification_status SET NOT NULL;

ALTER TABLE public.archives
  DROP CONSTRAINT IF EXISTS archives_kind_check,
  DROP CONSTRAINT IF EXISTS archives_status_check,
  DROP CONSTRAINT IF EXISTS archives_visibility_check,
  DROP CONSTRAINT IF EXISTS archives_verification_status_check,
  DROP CONSTRAINT IF EXISTS archives_year_check,
  DROP CONSTRAINT IF EXISTS archives_repo_url_check,
  DROP CONSTRAINT IF EXISTS archives_demo_url_check;

ALTER TABLE public.archives
  ADD CONSTRAINT archives_kind_check
    CHECK (kind IN ('proposal', 'penelitian', 'presentasi', 'tech_stack')),
  ADD CONSTRAINT archives_status_check
    CHECK (status IN ('draft', 'review', 'final', 'archived')),
  ADD CONSTRAINT archives_visibility_check CHECK (visibility = 'public'),
  ADD CONSTRAINT archives_verification_status_check
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  ADD CONSTRAINT archives_year_check
    CHECK (year IS NULL OR year BETWEEN 2000 AND 2100),
  ADD CONSTRAINT archives_repo_url_check
    CHECK (repo_url IS NULL OR repo_url ~* '^https://'),
  ADD CONSTRAINT archives_demo_url_check
    CHECK (demo_url IS NULL OR demo_url ~* '^https://');

CREATE TABLE IF NOT EXISTS public.archive_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_id   uuid NOT NULL REFERENCES public.archives(id) ON DELETE CASCADE,
  version      integer NOT NULL CHECK (version BETWEEN 1 AND 999),
  label        text NOT NULL DEFAULT '',
  changelog    text NOT NULL DEFAULT '',
  file_name    text NOT NULL,
  mime_type    text,
  size_bytes   bigint,
  storage_path text,
  external_url text,
  created_by   uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT archive_files_source_check CHECK (
    (storage_path IS NOT NULL AND external_url IS NULL)
    OR (storage_path IS NULL AND external_url IS NOT NULL)
  ),
  CONSTRAINT archive_files_size_check
    CHECK (size_bytes IS NULL OR size_bytes BETWEEN 0 AND 52428800)
);

ALTER TABLE public.archive_files
  ADD COLUMN IF NOT EXISTS archive_id uuid REFERENCES public.archives(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS version integer,
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS changelog text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.archive_files
  DROP CONSTRAINT IF EXISTS archive_files_source_check,
  DROP CONSTRAINT IF EXISTS archive_files_size_check,
  DROP CONSTRAINT IF EXISTS archive_files_external_url_check;

ALTER TABLE public.archive_files
  ADD CONSTRAINT archive_files_source_check CHECK (
    (storage_path IS NOT NULL AND external_url IS NULL)
    OR (storage_path IS NULL AND external_url IS NOT NULL)
  ),
  ADD CONSTRAINT archive_files_size_check
    CHECK (size_bytes IS NULL OR size_bytes BETWEEN 0 AND 52428800),
  ADD CONSTRAINT archive_files_external_url_check
    CHECK (external_url IS NULL OR external_url ~* '^https://');

CREATE INDEX IF NOT EXISTS idx_archives_verification_updated
  ON public.archives(verification_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_files_archive_version
  ON public.archive_files(archive_id, version DESC, created_at);

CREATE OR REPLACE FUNCTION public.cemara_archive_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archives_touch_updated_at ON public.archives;
DROP TRIGGER IF EXISTS trg_archives_touch ON public.archives;
CREATE TRIGGER trg_archives_touch_updated_at
  BEFORE UPDATE ON public.archives
  FOR EACH ROW EXECUTE FUNCTION public.cemara_archive_touch_updated_at();

CREATE OR REPLACE FUNCTION public.cemara_archive_file_requires_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.archives
  SET verification_status = 'pending',
      verification_notes = '',
      verified_at = NULL,
      verified_by = NULL,
      updated_at = now()
  WHERE id = NEW.archive_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_file_requires_review ON public.archive_files;
CREATE TRIGGER trg_archive_file_requires_review
  AFTER INSERT ON public.archive_files
  FOR EACH ROW EXECUTE FUNCTION public.cemara_archive_file_requires_review();

CREATE OR REPLACE FUNCTION public.cemara_archive_prepare_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.cemara_is_staff() THEN
    RAISE EXCEPTION 'Hanya pengelola yang dapat menambahkan arsip.';
  END IF;
  IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Pemilik arsip tidak valid.';
  END IF;

  NEW.visibility := 'public';
  NEW.verification_status := 'pending';
  NEW.verification_notes := '';
  NEW.verified_at := NULL;
  NEW.verified_by := NULL;
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archives_prepare_insert ON public.archives;
CREATE TRIGGER trg_archives_prepare_insert
  BEFORE INSERT ON public.archives
  FOR EACH ROW EXECUTE FUNCTION public.cemara_archive_prepare_insert();

CREATE OR REPLACE FUNCTION public.review_archive(
  p_archive_id uuid,
  p_decision text,
  p_review_notes text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  archive_row public.archives%ROWTYPE;
  decision_notes text := COALESCE(NULLIF(trim(p_review_notes), ''), '');
BEGIN
  IF NOT public.cemara_is_staff() THEN
    RAISE EXCEPTION 'Hanya admin, super admin, atau developer yang dapat memverifikasi arsip.';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Keputusan verifikasi tidak valid.';
  END IF;
  IF char_length(decision_notes) > 1000 THEN
    RAISE EXCEPTION 'Catatan verifikasi maksimal 1000 karakter.';
  END IF;
  IF p_decision = 'rejected' AND decision_notes = '' THEN
    RAISE EXCEPTION 'Alasan penolakan wajib diisi.';
  END IF;

  SELECT * INTO archive_row
  FROM public.archives
  WHERE id = p_archive_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arsip tidak ditemukan.';
  END IF;
  IF archive_row.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'Arsip ini sudah diverifikasi.';
  END IF;

  UPDATE public.archives
  SET verification_status = p_decision,
      verification_notes = decision_notes,
      verified_at = now(),
      verified_by = auth.uid(),
      visibility = 'public'
  WHERE id = p_archive_id;

  IF archive_row.created_by IS NOT NULL THEN
    INSERT INTO public.account_inbox (user_id, subject, message)
    VALUES (
      archive_row.created_by,
      CASE p_decision
        WHEN 'verified' THEN 'Arsip CEMARA terverifikasi'
        ELSE 'Arsip CEMARA perlu diperbaiki'
      END,
      CASE p_decision
        WHEN 'verified' THEN format('Arsip "%s" telah diverifikasi dan dapat diakses publik.', archive_row.title)
        ELSE format('Arsip "%s" belum dapat ditampilkan. Catatan pengelola: %s', archive_row.title, decision_notes)
      END
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_archive(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_archive(uuid, text, text) TO authenticated;

ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_files ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('archives', 'archive_files')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END;
$$;

CREATE POLICY cemara_archives_read_public_verified ON public.archives
  FOR SELECT
  USING (
    public.cemara_is_staff()
    OR (visibility = 'public' AND verification_status = 'verified')
  );
CREATE POLICY cemara_archives_insert_staff ON public.archives
  FOR INSERT TO authenticated
  WITH CHECK (public.cemara_is_staff() AND created_by = auth.uid());
CREATE POLICY cemara_archives_delete_staff ON public.archives
  FOR DELETE TO authenticated USING (public.cemara_is_staff());

CREATE POLICY cemara_archive_files_read_verified ON public.archive_files
  FOR SELECT
  USING (
    public.cemara_is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.archives a
      WHERE a.id = archive_files.archive_id
        AND a.visibility = 'public'
        AND a.verification_status = 'verified'
    )
  );
CREATE POLICY cemara_archive_files_insert_staff ON public.archive_files
  FOR INSERT TO authenticated
  WITH CHECK (
    public.cemara_is_staff()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.archives a
      WHERE a.id = archive_files.archive_id
    )
  );

CREATE OR REPLACE VIEW public.archive_overview
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.kind,
  a.title,
  a.summary,
  a.readme,
  a.authors,
  a.year,
  a.tags,
  a.stack,
  a.status,
  a.visibility,
  a.repo_url,
  a.demo_url,
  a.created_by,
  a.created_at,
  a.updated_at,
  COALESCE(f.file_count, 0)::integer AS file_count,
  COALESCE(f.latest_version, 0)::integer AS latest_version,
  a.verification_status
FROM public.archives a
LEFT JOIN LATERAL (
  SELECT max(af.version) AS latest_version, count(*)::integer AS file_count
  FROM public.archive_files af
  WHERE af.archive_id = a.id
) f ON true;

REVOKE ALL ON public.archives, public.archive_files, public.archive_overview
  FROM anon, authenticated;
GRANT SELECT ON public.archives, public.archive_files TO authenticated;
GRANT SELECT (
  id, kind, title, summary, readme, authors, year, tags, stack, status,
  visibility, repo_url, demo_url, created_by, created_at, updated_at,
  verification_status
) ON public.archives TO anon;
GRANT SELECT (
  id, archive_id, version, label, changelog, file_name, mime_type,
  size_bytes, storage_path, external_url, created_at
) ON public.archive_files TO anon;
GRANT SELECT ON public.archive_overview TO anon, authenticated;
GRANT INSERT, DELETE ON public.archives TO authenticated;
GRANT INSERT ON public.archive_files TO authenticated;
REVOKE UPDATE ON public.archives, public.archive_files FROM anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'arsip',
  'arsip',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS cemara_arsip_read_verified ON storage.objects;
DROP POLICY IF EXISTS cemara_arsip_select ON storage.objects;
DROP POLICY IF EXISTS cemara_arsip_insert_staff ON storage.objects;
DROP POLICY IF EXISTS cemara_arsip_update_staff ON storage.objects;
DROP POLICY IF EXISTS cemara_arsip_delete_staff ON storage.objects;

CREATE POLICY cemara_arsip_read_verified ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'arsip'
    AND (
      public.cemara_is_staff()
      OR EXISTS (
        SELECT 1
        FROM public.archive_files af
        JOIN public.archives a ON a.id = af.archive_id
        WHERE af.storage_path = storage.objects.name
          AND a.visibility = 'public'
          AND a.verification_status = 'verified'
      )
    )
  );
CREATE POLICY cemara_arsip_insert_staff ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'arsip'
    AND public.cemara_is_staff()
  );
CREATE POLICY cemara_arsip_delete_staff ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'arsip' AND public.cemara_is_staff());

COMMIT;
