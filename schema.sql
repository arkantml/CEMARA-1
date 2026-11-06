-- ============================================================================
-- CEMARA — SKEMA PENGGANTI (REPLACE) UNTUK PROYEK SUPABASE YANG SUDAH ADA
-- Dibuat dari kode: app.js, admin.js, shared.js, cemara-ui.js
--
-- Yang dilakukan skrip ini:
--   1. Memindahkan tabel skema lama (platform cerita: stories, chapters, comments,
--      profiles, dst.) ke schema `legacy_stories`. TIDAK ada DROP: data lama utuh,
--      tidak bisa diakses lewat API, dan bisa dikembalikan.
--   2. Menghapus trigger lama di auth.users dan policy storage lama yang akan
--      bentrok (mis. trigger pembuat `profiles` yang kini tidak ada lagi).
--   3. Membuat seluruh skema CEMARA (tabel, filter komentar, RLS, RPC, storage).
--   4. Membawa akun yang sudah terdaftar: auth.users TIDAK diubah; nama, bio, dan
--      role super_admin/admin dari `profiles` lama disalin ke `user_profiles`.
--   5. Setelah skrip ini selesai, jalankan schema_arsip.sql untuk arsip publik
--      yang hanya dapat diakses setelah verifikasi pengelola.
--
-- Semua dalam satu transaksi: jika ada error, tidak ada yang berubah.
-- Aman dijalankan ulang. Jalankan di SQL Editor proyek yang sama dengan config.js.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. GANTI SKEMA LAMA: pindahkan ke schema `legacy_stories` (bukan dihapus)
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS legacy_stories;
REVOKE ALL ON SCHEMA legacy_stories FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  -- Ciri skema lama: public.stories dengan kolom `blurb`.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'stories' AND column_name = 'blurb')
  THEN
    FOREACH t IN ARRAY ARRAY['notifications', 'reports', 'reading_history', 'bookmarks',
                             'likes', 'follows', 'chapters', 'comments', 'stories', 'profiles']
    LOOP
      IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.%I SET SCHEMA legacy_stories', t);
        RAISE NOTICE 'Dipindahkan ke legacy_stories: %', t;
      END IF;
    END LOOP;

  -- Kasus lain: hanya `comments` milik skema lama (story_id, tanpa work_id).
  ELSIF to_regclass('public.comments') IS NOT NULL
        AND EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'comments' AND column_name = 'story_id')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'comments' AND column_name = 'work_id')
  THEN
    ALTER TABLE public.comments SET SCHEMA legacy_stories;
    RAISE NOTICE 'Dipindahkan ke legacy_stories: comments';
  END IF;

  -- Pengaman: jangan lanjut jika masih ada `comments` yang tidak dikenali.
  IF to_regclass('public.comments') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'comments' AND column_name = 'work_id')
  THEN
    RAISE EXCEPTION 'public.comments tidak dikenali (tanpa work_id dan tanpa story_id). Periksa manual sebelum melanjutkan.';
  END IF;
END $$;

-- Trigger lama di auth.users (mis. pembuat baris `profiles`) akan GAGAL saat
-- pendaftaran karena tabelnya sudah dipindah. Hapus yang berasal dari schema public.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'auth.users'::regclass
      AND NOT t.tgisinternal
      AND n.nspname = 'public'
      AND t.tgname <> 'cemara_on_auth_user_created'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON auth.users', r.tgname);
    RAISE NOTICE 'Trigger lama dihapus dari auth.users: %', r.tgname;
  END LOOP;
END $$;

-- Policy storage lama untuk bucket karya/avatars yang bukan milik CEMARA.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname NOT LIKE 'cemara\_%'
      AND (COALESCE(qual, '') ~* '(karya|avatars)' OR COALESCE(with_check, '') ~* '(karya|avatars)')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
    RAISE NOTICE 'Policy storage lama dihapus: %', r.policyname;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 0b. BERSIHKAN FUNGSI & TRIGGER CEMARA VERSI LAMA
--     CREATE OR REPLACE tidak bisa mengubah tipe return / nama parameter fungsi
--     yang sudah ada (mis. cemara_set_role). Semua fungsi milik CEMARA dihapus
--     (semua signature) lalu dibuat ulang di bawah. CASCADE hanya menyapu policy
--     dan trigger yang bergantung padanya; semuanya dibuat ulang di skrip ini.
-- ----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'cemara_role', 'cemara_is_staff', 'cemara_is_blocked',
        'check_comment_content', 'cemara_touch_updated_at',
        'validate_comment_before_write', 'validate_comment_before_insert',
        'cemara_log_comment_activity', 'cemara_guard_profile_update',
        'cemara_handle_new_user', 'review_comment', 'cemara_sync_user_profiles',
        'cemara_set_role', 'cemara_set_blocked', 'is_comment_moderator'
      ])
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE';
    RAISE NOTICE 'Fungsi lama dihapus: %', r.sig;
  END LOOP;
END $$;

-- Trigger lama (non-internal) pada tabel CEMARA: hapus agar tidak dobel dengan yang baru.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('user_profiles', 'admin_profiles', 'user_blocks', 'works', 'comments',
                        'work_likes', 'work_saves', 'account_activity', 'account_inbox')
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.%I', r.tgname, r.tbl);
    RAISE NOTICE 'Trigger lama dihapus: %.%', r.tbl, r.tgname;
  END LOOP;
END $$;

DROP VIEW IF EXISTS public.work_engagement_stats;

-- ----------------------------------------------------------------------------
-- 1. TABEL
-- ----------------------------------------------------------------------------

-- 1.1 Profil pengguna (1 baris per akun auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      text NOT NULL DEFAULT 'Pengunjung',
  bio               text NOT NULL DEFAULT '',
  avatar_url        text,
  role              text NOT NULL DEFAULT 'user'
                    CHECK (role IN ('super_admin', 'admin', 'dev', 'user')),
  blocked_at        timestamptz,
  custom_card_emoji text,
  custom_card_text  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS custom_card_emoji text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS custom_card_text text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 1.2 Admin lama (dibaca oleh shared.js / app.js sebagai fallback)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.3 Alasan blokir (terpisah dari user_profiles agar tidak terbaca publik)
CREATE TABLE IF NOT EXISTS public.user_blocks (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     text NOT NULL DEFAULT '',
  blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  blocked_at timestamptz NOT NULL DEFAULT now()
);

-- 1.4 Karya
CREATE TABLE IF NOT EXISTS public.works (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  author       text NOT NULL,
  author_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category     text NOT NULL,
  description  text NOT NULL DEFAULT '',
  content      text NOT NULL DEFAULT '',
  submission_type text NOT NULL DEFAULT 'text',
  drive_url    text,
  document_path text,
  document_name text,
  cover        text NOT NULL DEFAULT 'cover-green',
  cover_symbol text NOT NULL DEFAULT '✦',
  cover_url    text,                                   -- sampul: satu gambar unggahan (bucket karya)
  image_urls   jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT works_submission_type_check
    CHECK (submission_type IN ('text', 'drive')),
  CONSTRAINT works_submission_source_check
    CHECK (
      (submission_type = 'text' AND drive_url IS NULL)
      OR (
        submission_type = 'drive'
        AND drive_url IS NOT NULL
        AND drive_url ~* '^https://(drive|docs)\.google\.com(:443)?/'
      )
    )
);
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '';
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS submission_type text NOT NULL DEFAULT 'text';
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS drive_url text;
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS document_path text;
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS document_name text;
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS cover text NOT NULL DEFAULT 'cover-green';
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS cover_symbol text NOT NULL DEFAULT '✦';
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS published_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.works'::regclass
      AND conname = 'works_submission_type_check'
  ) THEN
    ALTER TABLE public.works
      ADD CONSTRAINT works_submission_type_check
      CHECK (submission_type IN ('text', 'drive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.works'::regclass
      AND conname = 'works_submission_source_check'
  ) THEN
    ALTER TABLE public.works
      ADD CONSTRAINT works_submission_source_check
      CHECK (
        (submission_type = 'text' AND drive_url IS NULL)
        OR (
          submission_type = 'drive'
          AND drive_url IS NOT NULL
          AND drive_url ~* '^https://(drive|docs)\.google\.com(:443)?/'
        )
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_works_published_at ON public.works(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_works_author_id    ON public.works(author_id);

-- 1.5 Komentar (+ kolom moderasi)
CREATE TABLE IF NOT EXISTS public.comments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id          uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,   -- NULL = anonim
  name             text NOT NULL DEFAULT 'Anonim' CHECK (char_length(name) <= 80),
  content          text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  status           text NOT NULL DEFAULT 'approved'
                   CHECK (status IN ('approved', 'pending', 'flagged')),
  is_inappropriate boolean NOT NULL DEFAULT false,
  flagged_reason   text,
  reviewed_at      timestamptz,
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS work_id uuid REFERENCES public.works(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Anonim';
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_inappropriate boolean NOT NULL DEFAULT false;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS flagged_reason text;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_comments_work_status ON public.comments(work_id, status);
CREATE INDEX IF NOT EXISTS idx_comments_status      ON public.comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_user_id     ON public.comments(user_id);

-- 1.6 Suka & simpan
-- CATATAN: reader.js tidak ikut diunggah, jadi nama tabel ini adalah asumsi.
-- View work_engagement_stats (dibaca app.js) memang sudah sesuai.
CREATE TABLE IF NOT EXISTS public.work_likes (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_id    uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_id)
);
CREATE TABLE IF NOT EXISTS public.work_saves (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_id    uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_id)
);
CREATE INDEX IF NOT EXISTS idx_work_likes_work ON public.work_likes(work_id);
CREATE INDEX IF NOT EXISTS idx_work_saves_work ON public.work_saves(work_id);

-- 1.7 Aktivitas akun & kotak masuk
CREATE TABLE IF NOT EXISTS public.account_activity (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  summary       text NOT NULL DEFAULT '',
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_activity_user ON public.account_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_activity_type ON public.account_activity(activity_type);

CREATE TABLE IF NOT EXISTS public.account_inbox (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject    text NOT NULL DEFAULT '',
  message    text NOT NULL DEFAULT '',
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_inbox_user ON public.account_inbox(user_id, created_at DESC);

-- 1.8 Pengajuan karya menunggu peninjauan admin
CREATE TABLE IF NOT EXISTS public.work_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  author          text NOT NULL CHECK (char_length(author) BETWEEN 1 AND 80),
  category        text NOT NULL CHECK (category IN ('Cerpen', 'Puisi', 'Esai', 'Seni', 'Komik', 'Artikel', 'Lainnya')),
  description     text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  content         text NOT NULL DEFAULT '',
  submission_type text NOT NULL DEFAULT 'text',
  drive_url       text,
  attachment_path text,
  attachment_name text,
  attachment_mime text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  automated_validation_status text NOT NULL DEFAULT 'not_configured'
                  CHECK (automated_validation_status IN ('not_configured', 'passed', 'flagged')),
  review_notes    text NOT NULL DEFAULT '',
  reviewed_at     timestamptz,
  reviewed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.work_submissions
  ADD COLUMN IF NOT EXISTS submission_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS drive_url text;
ALTER TABLE public.work_submissions
  ALTER COLUMN attachment_path DROP NOT NULL,
  ALTER COLUMN attachment_name DROP NOT NULL,
  ALTER COLUMN attachment_mime DROP NOT NULL;
ALTER TABLE public.work_submissions
  DROP CONSTRAINT IF EXISTS work_submissions_attachment_owner,
  DROP CONSTRAINT IF EXISTS work_submissions_content_length,
  DROP CONSTRAINT IF EXISTS work_submissions_category_check,
  DROP CONSTRAINT IF EXISTS work_submissions_submission_type_check,
  DROP CONSTRAINT IF EXISTS work_submissions_source_check;
ALTER TABLE public.work_submissions
  ADD CONSTRAINT work_submissions_category_check
    CHECK (category IN ('Cerpen', 'Puisi', 'Esai', 'Seni', 'Komik', 'Artikel', 'Lainnya')),
  ADD CONSTRAINT work_submissions_submission_type_check
    CHECK (submission_type IN ('text', 'drive')),
  ADD CONSTRAINT work_submissions_source_check
    CHECK (
      (submission_type = 'text' AND drive_url IS NULL
       AND (char_length(trim(content)) > 0 OR attachment_path IS NOT NULL))
      OR (
        submission_type = 'drive'
        AND drive_url IS NOT NULL
        AND drive_url ~* '^https://(drive|docs)\.google\.com(:443)?/'
      )
    ),
  ADD CONSTRAINT work_submissions_attachment_owner
    CHECK (
      (
        attachment_path IS NULL
        AND attachment_name IS NULL
        AND attachment_mime IS NULL
      )
      OR (
        attachment_path IS NOT NULL
        AND attachment_name IS NOT NULL
        AND char_length(attachment_name) BETWEEN 1 AND 255
        AND attachment_mime IN (
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/webp'
        )
        AND split_part(attachment_path, '/', 1) = user_id::text
        AND split_part(attachment_path, '/', 2) = id::text
      )
    ),
  ADD CONSTRAINT work_submissions_content_length
    CHECK (char_length(content) <= 50000);
CREATE INDEX IF NOT EXISTS idx_work_submissions_queue
  ON public.work_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_submissions_user
  ON public.work_submissions(user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. FUNGSI BANTU ROLE
--    Dipakai oleh RLS; harus bisa dieksekusi anon & authenticated.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cemara_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE
              WHEN up.role = 'user'
                   AND EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid())
              THEN 'admin'
              ELSE up.role
            END
     FROM public.user_profiles up
     WHERE up.user_id = auth.uid()),
    CASE WHEN EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid())
         THEN 'admin' END,
    'user'
  );
$$;

CREATE OR REPLACE FUNCTION public.cemara_is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.cemara_role() IN ('admin', 'super_admin', 'dev');
$$;

CREATE OR REPLACE FUNCTION public.cemara_is_blocked()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND blocked_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.cemara_role(), public.cemara_is_staff(), public.cemara_is_blocked() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cemara_role(), public.cemara_is_staff(), public.cemara_is_blocked() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. FILTER KOMENTAR
--    Daftar kata HARUS sama dengan CEMARA.BAD_WORDS di shared.js.
--    Kata < 5 huruf dicocokkan utuh; kata >= 5 huruf dicocokkan sebagai
--    awalan kata ("assalamualaikum", "hello", "pantai" lolos).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_comment_content(comment_text TEXT)
RETURNS TABLE(is_flagged BOOLEAN, reason TEXT)
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  bad_words TEXT[] := ARRAY[
    'kontol', 'bitch', 'fuck', 'damn', 'hell', 'ass',
    'bodoh', 'goblok', 'bangsat', 'brengsek', 'setan',
    'anjing', 'monyet', 'babi', 'tahi', 'tai',
    'bajingan', 'keparat', 'sialan', 'jancok', 'dancok', 'asu', 'pantek',
    'memek', 'pepek', 'peler', 'ngentot', 'jembut', 'lonte', 'pelacur',
    'tolol', 'bego', 'dungu', 'kampret', 'celeng',
    'shit', 'dick', 'cunt', 'bastard', 'asshole', 'motherfucker'
  ];
  w          TEXT;
  text_lower TEXT := LOWER(COALESCE(comment_text, ''));
  trimmed    TEXT := TRIM(COALESCE(comment_text, ''));
  letters    INT;
BEGIN
  IF CHAR_LENGTH(trimmed) < 2 THEN
    RETURN QUERY SELECT TRUE, 'Komentar terlalu pendek'::TEXT;
    RETURN;
  END IF;

  letters := CHAR_LENGTH(REGEXP_REPLACE(trimmed, '[^A-Za-z]', '', 'g'));
  IF letters >= 8
     AND CHAR_LENGTH(REGEXP_REPLACE(trimmed, '[^A-Z]', '', 'g')) > letters * 0.7 THEN
    RETURN QUERY SELECT TRUE, 'Komentar menggunakan huruf besar berlebihan'::TEXT;
    RETURN;
  END IF;

  IF trimmed ~ '(.)\1{4,}' THEN
    RETURN QUERY SELECT TRUE, 'Komentar menggunakan karakter berulang berlebihan'::TEXT;
    RETURN;
  END IF;

  FOREACH w IN ARRAY bad_words LOOP
    IF text_lower ~ ('\m' || w || CASE WHEN CHAR_LENGTH(w) >= 5 THEN '' ELSE '\M' END) THEN
      RETURN QUERY SELECT TRUE, 'Komentar mengandung bahasa yang tidak pantas'::TEXT;
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT FALSE, ''::TEXT;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. TRIGGER
-- ----------------------------------------------------------------------------

-- 4.1 updated_at
CREATE OR REPLACE FUNCTION public.cemara_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_touch ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_touch BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.cemara_touch_updated_at();
DROP TRIGGER IF EXISTS trg_works_touch ON public.works;
CREATE TRIGGER trg_works_touch BEFORE UPDATE ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.cemara_touch_updated_at();

-- 4.2 Komentar: validasi saat INSERT dan saat isi diubah
CREATE OR REPLACE FUNCTION public.validate_comment_before_write()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  check_result RECORD;
  is_staff     boolean := (auth.uid() IS NULL OR public.cemara_is_staff());
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Kolom identitas tidak boleh diubah lewat API.
    NEW.work_id    := OLD.work_id;
    NEW.user_id    := OLD.user_id;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();

    IF NEW.content IS NOT DISTINCT FROM OLD.content THEN
      -- Isi sama: hanya staf (atau SQL editor) yang boleh mengubah status/review.
      IF NOT is_staff THEN
        NEW.status           := OLD.status;
        NEW.is_inappropriate := OLD.is_inappropriate;
        NEW.flagged_reason   := OLD.flagged_reason;
        NEW.reviewed_at      := OLD.reviewed_at;
        NEW.reviewed_by      := OLD.reviewed_by;
      END IF;
      RETURN NEW;
    END IF;

    -- Komentar yang sudah ditandai manual oleh staf tidak bisa "dicuci" lewat edit.
    IF NOT is_staff AND OLD.status = 'flagged' AND OLD.reviewed_by IS NOT NULL THEN
      NEW.status           := OLD.status;
      NEW.is_inappropriate := OLD.is_inappropriate;
      NEW.flagged_reason   := OLD.flagged_reason;
      NEW.reviewed_at      := OLD.reviewed_at;
      NEW.reviewed_by      := OLD.reviewed_by;
      RETURN NEW;
    END IF;
  END IF;

  SELECT * INTO check_result FROM public.check_comment_content(NEW.content);

  IF check_result.is_flagged THEN
    NEW.status           := 'flagged';
    NEW.is_inappropriate := TRUE;
    NEW.flagged_reason   := check_result.reason;
  ELSE
    NEW.status           := 'approved';
    NEW.is_inappropriate := FALSE;
    NEW.flagged_reason   := NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_validate_before_insert ON public.comments;
DROP TRIGGER IF EXISTS comments_validate_before_write  ON public.comments;
CREATE TRIGGER comments_validate_before_write
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_comment_before_write();

-- 4.3 Catat aktivitas "comment_added" (dipakai grafik di admin.js)
CREATE OR REPLACE FUNCTION public.cemara_log_comment_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.account_activity (user_id, activity_type, summary, metadata)
    VALUES (NEW.user_id, 'comment_added', 'Menambahkan komentar.',
            jsonb_build_object('work_id', NEW.work_id, 'comment_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comments_log_activity ON public.comments;
CREATE TRIGGER trg_comments_log_activity AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.cemara_log_comment_activity();

-- 4.4 Profil: kolom sensitif tidak bisa diubah langsung oleh klien
CREATE OR REPLACE FUNCTION public.cemara_guard_profile_update()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Lewati untuk RPC resmi (set_config lokal transaksi) dan SQL editor/service role.
  IF current_setting('cemara.bypass_guard', true) = 'on' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.user_id    := OLD.user_id;
  NEW.role       := OLD.role;
  NEW.blocked_at := OLD.blocked_at;
  NEW.created_at := OLD.created_at;

  -- Kartu kustom hanya untuk penulis dengan >= 10 karya (sama dengan aturan di admin.js).
  IF (SELECT count(*) FROM public.works WHERE author_id = NEW.user_id) < 10 THEN
    NEW.custom_card_emoji := OLD.custom_card_emoji;
    NEW.custom_card_text  := OLD.custom_card_text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_guard ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_guard BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.cemara_guard_profile_update();

-- 4.5 Profil otomatis untuk akun baru
CREATE OR REPLACE FUNCTION public.cemara_handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
      'Pengunjung'
    ),
    CASE WHEN EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = NEW.id)
         THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cemara_on_auth_user_created ON auth.users;
CREATE TRIGGER cemara_on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.cemara_handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. VIEW STATISTIK (dibaca app.js: work_id, like_count, save_count)
--    Sengaja dijalankan sebagai pemilik view agar jumlah suka/simpan bisa
--    dilihat publik tanpa membuka daftar siapa yang menyukai.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.work_engagement_stats AS
SELECT
  w.id AS work_id,
  (SELECT count(*) FROM public.work_likes l WHERE l.work_id = w.id)::int AS like_count,
  (SELECT count(*) FROM public.work_saves s WHERE s.work_id = w.id)::int AS save_count
FROM public.works w;

-- ----------------------------------------------------------------------------
-- 6. RPC
-- ----------------------------------------------------------------------------

-- 6.1 Moderasi komentar. Pemanggil diverifikasi lewat auth.uid().
DROP FUNCTION IF EXISTS public.review_comment(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.review_comment(comment_id UUID, new_status TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.cemara_is_staff() THEN
    RETURN QUERY SELECT FALSE, 'Tidak berwenang meninjau komentar'::TEXT;
    RETURN;
  END IF;

  IF new_status NOT IN ('approved', 'flagged') THEN
    RETURN QUERY SELECT FALSE, 'Status tidak valid'::TEXT;
    RETURN;
  END IF;

  UPDATE public.comments c
  SET status           = new_status,
      reviewed_at      = now(),
      reviewed_by      = auth.uid(),
      is_inappropriate = (new_status = 'flagged'),
      flagged_reason   = CASE WHEN new_status = 'approved' THEN NULL ELSE c.flagged_reason END
  WHERE c.id = review_comment.comment_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Komentar tidak ditemukan'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, 'Komentar berhasil direview'::TEXT;
END;
$$;

-- 6.2 Sinkronkan profil untuk semua akun yang belum punya (dipanggil admin.js)
CREATE OR REPLACE FUNCTION public.cemara_sync_user_profiles()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.cemara_is_staff() THEN
    RETURN 0;
  END IF;

  INSERT INTO public.user_profiles (user_id, display_name, role, created_at)
  SELECT
    u.id,
    COALESCE(
      NULLIF(TRIM(u.raw_user_meta_data ->> 'name'), ''),
      NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(SPLIT_PART(COALESCE(u.email, ''), '@', 1), ''),
      'Pengunjung'
    ),
    CASE WHEN EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = u.id)
         THEN 'admin' ELSE 'user' END,
    COALESCE(u.created_at, now())
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.user_id = u.id);

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

-- 6.3 Ubah role. Hanya super_admin / dev, tidak untuk diri sendiri.
--     Hanya super_admin yang boleh memberi atau mencabut super_admin.
CREATE OR REPLACE FUNCTION public.cemara_set_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := public.cemara_role();
  target_role text;
BEGIN
  IF auth.uid() IS NULL OR caller_role NOT IN ('super_admin', 'dev') THEN
    RAISE EXCEPTION 'Tidak berwenang mengubah role.';
  END IF;
  IF new_role NOT IN ('super_admin', 'admin', 'dev', 'user') THEN
    RAISE EXCEPTION 'Role tidak valid.';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Role akun sendiri tidak dapat diubah.';
  END IF;

  SELECT role INTO target_role FROM public.user_profiles WHERE user_id = target_user_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Akun tidak ditemukan.';
  END IF;

  IF (new_role = 'super_admin' OR target_role = 'super_admin') AND caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Hanya Super Admin yang dapat memberi atau mencabut Super Admin.';
  END IF;

  IF target_role = 'super_admin' AND new_role <> 'super_admin'
     AND (SELECT count(*) FROM public.user_profiles WHERE role = 'super_admin') <= 1 THEN
    RAISE EXCEPTION 'Tidak dapat mencabut Super Admin terakhir.';
  END IF;

  PERFORM set_config('cemara.bypass_guard', 'on', true);
  UPDATE public.user_profiles SET role = new_role WHERE user_id = target_user_id;
  PERFORM set_config('cemara.bypass_guard', 'off', true);
END;
$$;

-- 6.4 Blokir / buka blokir. Sama dengan aturan UI: pelaku super_admin atau dev,
--     target hanya role user atau admin, bukan diri sendiri.
CREATE OR REPLACE FUNCTION public.cemara_set_blocked(
  target_user_id uuid,
  should_block   boolean,
  reason         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role text;
BEGIN
  IF auth.uid() IS NULL OR public.cemara_role() NOT IN ('super_admin', 'dev') THEN
    RAISE EXCEPTION 'Tidak berwenang memblokir akun.';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Akun sendiri tidak dapat diblokir.';
  END IF;

  SELECT role INTO target_role FROM public.user_profiles WHERE user_id = target_user_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Akun tidak ditemukan.';
  END IF;
  IF target_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Akun dengan role % tidak dapat diblokir.', target_role;
  END IF;

  PERFORM set_config('cemara.bypass_guard', 'on', true);
  IF should_block THEN
    UPDATE public.user_profiles SET blocked_at = now() WHERE user_id = target_user_id;
    INSERT INTO public.user_blocks (user_id, reason, blocked_by)
    VALUES (target_user_id, COALESCE(reason, ''), auth.uid())
    ON CONFLICT (user_id) DO UPDATE
      SET reason = EXCLUDED.reason, blocked_by = EXCLUDED.blocked_by, blocked_at = now();
  ELSE
    UPDATE public.user_profiles SET blocked_at = NULL WHERE user_id = target_user_id;
    DELETE FROM public.user_blocks WHERE user_id = target_user_id;
  END IF;
  PERFORM set_config('cemara.bypass_guard', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.review_comment(UUID, TEXT)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cemara_sync_user_profiles()                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cemara_set_role(uuid, text)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cemara_set_blocked(uuid, boolean, text)       FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_comment(UUID, TEXT)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.cemara_sync_user_profiles()                TO authenticated;
GRANT EXECUTE ON FUNCTION public.cemara_set_role(uuid, text)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.cemara_set_blocked(uuid, boolean, text)    TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.works            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_likes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_saves       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_inbox    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_submissions ENABLE ROW LEVEL SECURITY;

-- Bersihkan policy lama pada tabel CEMARA agar tidak ada policy longgar yang tersisa
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('user_profiles','admin_profiles','user_blocks','works','comments',
                        'work_likes','work_saves','account_activity','account_inbox',
                        'work_submissions')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- user_profiles
CREATE POLICY cemara_profiles_select ON public.user_profiles
  FOR SELECT USING (true);
CREATE POLICY cemara_profiles_insert_own ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'user');
CREATE POLICY cemara_profiles_update_own ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY cemara_profiles_delete_super ON public.user_profiles
  FOR DELETE TO authenticated
  USING (public.cemara_role() = 'super_admin' AND user_id <> auth.uid());

-- admin_profiles (hanya baca baris sendiri; pengisian lewat SQL editor)
CREATE POLICY cemara_admin_profiles_select_own ON public.admin_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- user_blocks (alasan blokir hanya terbaca staf)
CREATE POLICY cemara_blocks_select_staff ON public.user_blocks
  FOR SELECT TO authenticated USING (public.cemara_is_staff());

-- works
CREATE POLICY cemara_works_select ON public.works
  FOR SELECT USING (true);
CREATE POLICY cemara_works_update_staff ON public.works
  FOR UPDATE TO authenticated
  USING (public.cemara_is_staff()) WITH CHECK (public.cemara_is_staff());
CREATE POLICY cemara_works_delete_staff ON public.works
  FOR DELETE TO authenticated USING (public.cemara_is_staff());

-- comments
CREATE POLICY cemara_comments_select_approved ON public.comments
  FOR SELECT USING (status = 'approved');
CREATE POLICY cemara_comments_select_own ON public.comments
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY cemara_comments_select_staff ON public.comments
  FOR SELECT TO authenticated USING (public.cemara_is_staff());
CREATE POLICY cemara_comments_insert ON public.comments
  FOR INSERT
  WITH CHECK ((user_id IS NULL OR user_id = auth.uid()) AND NOT public.cemara_is_blocked());
CREATE POLICY cemara_comments_update ON public.comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.cemara_is_staff())
  WITH CHECK (user_id = auth.uid() OR public.cemara_is_staff());
CREATE POLICY cemara_comments_delete ON public.comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.cemara_is_staff());

-- suka & simpan
CREATE POLICY cemara_likes_select_own ON public.work_likes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY cemara_likes_insert_own ON public.work_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.cemara_is_blocked());
CREATE POLICY cemara_likes_delete_own ON public.work_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY cemara_saves_select_own ON public.work_saves
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY cemara_saves_insert_own ON public.work_saves
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.cemara_is_blocked());
CREATE POLICY cemara_saves_delete_own ON public.work_saves
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- aktivitas (baca milik sendiri atau semua jika staf; tidak bisa diubah/dihapus)
CREATE POLICY cemara_activity_select ON public.account_activity
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.cemara_is_staff());
CREATE POLICY cemara_activity_insert_own ON public.account_activity
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- kotak masuk (hanya staf yang mengirim; pemilik hanya menandai dibaca)
CREATE POLICY cemara_inbox_select_own ON public.account_inbox
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY cemara_inbox_insert_staff ON public.account_inbox
  FOR INSERT TO authenticated WITH CHECK (public.cemara_is_staff());
CREATE POLICY cemara_inbox_update_own ON public.account_inbox
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Pengajuan: pemilik dan staf dapat membaca; hanya pemilik dapat mengirim.
CREATE POLICY cemara_submissions_select ON public.work_submissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.cemara_is_staff());
CREATE POLICY cemara_submissions_insert_own ON public.work_submissions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.cemara_is_blocked());

CREATE OR REPLACE FUNCTION public.cemara_prepare_work_submission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NEW.user_id IS DISTINCT FROM auth.uid()
     OR public.cemara_is_blocked() THEN
    RAISE EXCEPTION 'Akun ini tidak dapat mengajukan karya.';
  END IF;

  NEW.status := 'pending';
  NEW.automated_validation_status := 'not_configured';
  NEW.review_notes := '';
  NEW.reviewed_at := NULL;
  NEW.reviewed_by := NULL;
  NEW.created_at := now();

  SELECT NULLIF(trim(display_name), '')
  INTO NEW.author
  FROM public.user_profiles
  WHERE user_id = auth.uid();
  IF NEW.author IS NULL THEN
    RAISE EXCEPTION 'Profil penulis belum tersedia.';
  END IF;

  IF NEW.attachment_path IS NOT NULL
     AND (
       split_part(NEW.attachment_path, '/', 1) <> auth.uid()::text
       OR split_part(NEW.attachment_path, '/', 2) <> NEW.id::text
     ) THEN
    RAISE EXCEPTION 'Lokasi berkas pengajuan tidak valid.';
  END IF;
  IF NEW.submission_type = 'text'
     AND NEW.attachment_path IS NULL
     AND char_length(trim(NEW.content)) = 0 THEN
    RAISE EXCEPTION 'Naskah atau berkas karya wajib diisi.';
  END IF;
  IF NEW.submission_type = 'drive'
     AND (
       NEW.drive_url IS NULL
       OR NEW.drive_url !~* '^https://(drive|docs)\.google\.com(:443)?/'
     ) THEN
    RAISE EXCEPTION 'Tautan Google Drive atau Docs tidak valid.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_submissions_prepare ON public.work_submissions;
CREATE TRIGGER trg_work_submissions_prepare
  BEFORE INSERT ON public.work_submissions
  FOR EACH ROW EXECUTE FUNCTION public.cemara_prepare_work_submission();

CREATE OR REPLACE FUNCTION public.review_work_submission(
  p_submission_id uuid,
  p_decision text,
  p_review_notes text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  submission public.work_submissions%ROWTYPE;
  published_work_id uuid;
  decision_notes text := COALESCE(NULLIF(TRIM(p_review_notes), ''), '');
BEGIN
  IF NOT public.cemara_is_staff() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat meninjau pengajuan.';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Keputusan pengajuan tidak valid.';
  END IF;
  IF char_length(decision_notes) > 1000 THEN
    RAISE EXCEPTION 'Catatan peninjauan maksimal 1000 karakter.';
  END IF;
  IF p_decision = 'rejected' AND decision_notes = '' THEN
    RAISE EXCEPTION 'Alasan penolakan wajib diisi.';
  END IF;

  SELECT * INTO submission
  FROM public.work_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan tidak ditemukan.';
  END IF;
  IF submission.status <> 'pending' THEN
    RAISE EXCEPTION 'Pengajuan ini sudah ditinjau.';
  END IF;

  IF p_decision = 'approved' THEN
    INSERT INTO public.works (
      title, author, author_id, category, description, content,
      submission_type, drive_url, document_path, document_name, published_at
    )
    VALUES (
      submission.title, submission.author, submission.user_id,
      submission.category, submission.description, submission.content,
      submission.submission_type, submission.drive_url,
      submission.attachment_path, submission.attachment_name, now()
    )
    RETURNING id INTO published_work_id;
  END IF;

  UPDATE public.work_submissions
  SET status = p_decision,
      review_notes = decision_notes,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_submission_id;

  INSERT INTO public.account_inbox (user_id, subject, message)
  VALUES (
    submission.user_id,
    CASE p_decision
      WHEN 'approved' THEN 'Pengajuan karya disetujui'
      ELSE 'Pengajuan karya ditolak'
    END,
    CASE p_decision
      WHEN 'approved' THEN format('Karya "%s" telah disetujui dan diterbitkan.', submission.title)
      ELSE format('Karya "%s" belum dapat diterbitkan. Catatan admin: %s', submission.title, decision_notes)
    END
  );

  RETURN published_work_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_work_submission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_work_submission(uuid, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. GRANT (eksplisit, agar tetap jalan walau default privilege proyek ketat)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.user_profiles, public.works TO anon;
GRANT SELECT, INSERT ON public.comments TO anon;           -- komentar anonim
GRANT SELECT ON public.work_engagement_stats TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.admin_profiles, public.user_blocks     TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.works                  TO authenticated;
REVOKE INSERT ON public.works FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments       TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.work_likes, public.work_saves TO authenticated;
GRANT SELECT, INSERT ON public.account_activity               TO authenticated;
GRANT SELECT, INSERT ON public.account_inbox                  TO authenticated;
GRANT UPDATE (is_read) ON public.account_inbox                TO authenticated;
GRANT SELECT, INSERT ON public.work_submissions               TO authenticated;

-- ----------------------------------------------------------------------------
-- 9. STORAGE: bucket `karya`, `avatars`, dan berkas pengajuan privat
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('karya',   'karya',   true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('avatars', 'avatars', true,  2097152, ARRAY['image/jpeg','image/png','image/webp']),
  ('pengajuan-karya', 'pengajuan-karya', false, 10485760, ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS cemara_karya_insert_staff   ON storage.objects;
DROP POLICY IF EXISTS cemara_karya_update_staff   ON storage.objects;
DROP POLICY IF EXISTS cemara_karya_delete_staff   ON storage.objects;
DROP POLICY IF EXISTS cemara_avatars_select       ON storage.objects;
DROP POLICY IF EXISTS cemara_avatars_insert_own   ON storage.objects;
DROP POLICY IF EXISTS cemara_avatars_update_own   ON storage.objects;
DROP POLICY IF EXISTS cemara_avatars_delete_own   ON storage.objects;
DROP POLICY IF EXISTS cemara_submissions_file_select ON storage.objects;
DROP POLICY IF EXISTS cemara_submissions_file_insert ON storage.objects;
DROP POLICY IF EXISTS cemara_submissions_file_delete_orphan ON storage.objects;

-- karya: hanya staf, ke folder bernama uid sendiri (sesuai admin.js)
CREATE POLICY cemara_karya_insert_staff ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'karya' AND public.cemara_is_staff()
              AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY cemara_karya_update_staff ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'karya' AND public.cemara_is_staff());
CREATE POLICY cemara_karya_delete_staff ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'karya' AND public.cemara_is_staff());

-- avatars: tiap pengguna hanya di folder uid sendiri (upload memakai upsert)
CREATE POLICY cemara_avatars_select ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY cemara_avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY cemara_avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY cemara_avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Berkas hanya dapat dibaca pemilik dan staf sebelum keputusan; karya terbit dapat dibaca publik.
CREATE POLICY cemara_submissions_file_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'pengajuan-karya'
    AND (
      public.cemara_is_staff()
      OR EXISTS (
        SELECT 1 FROM public.work_submissions s
        WHERE s.attachment_path = name AND s.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.works w
        WHERE w.document_path = name OR w.cover_url = name
      )
    )
  );
CREATE POLICY cemara_submissions_file_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pengajuan-karya'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT public.cemara_is_blocked()
  );
CREATE POLICY cemara_submissions_file_delete_orphan ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'pengajuan-karya'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1 FROM public.work_submissions s
      WHERE s.attachment_path = name
    )
  );

-- ----------------------------------------------------------------------------
-- 10. ISI PROFIL UNTUK AKUN YANG SUDAH TERDAFTAR
--     Semua akun lama di auth.users otomatis dapat baris user_profiles (role user).
-- ----------------------------------------------------------------------------
-- 10a. Bawa data akun dari skema lama (jika ada): nama, bio, dan role admin.
--      Pemetaan role: super_admin->super_admin, admin->admin,
--      reader/writer/executive/moderator -> user (tidak ada kenaikan otomatis).
DO $$
BEGIN
  IF to_regclass('legacy_stories.profiles') IS NOT NULL THEN
    INSERT INTO public.user_profiles (user_id, display_name, bio, role, created_at)
    SELECT
      p.id,
      COALESCE(NULLIF(TRIM(p.full_name), ''), NULLIF(TRIM(p.username), ''), 'Pengunjung'),
      COALESCE(p.bio, ''),
      CASE p.role WHEN 'super_admin' THEN 'super_admin'
                  WHEN 'admin'       THEN 'admin'
                  ELSE 'user' END,
      COALESCE(p.created_at, now())
    FROM legacy_stories.profiles p
    WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

-- 10b. Sisa akun di auth.users yang belum punya profil.
SELECT public.cemara_sync_user_profiles() AS profil_baru_dibuat;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'super_admin') THEN
    RAISE WARNING 'Belum ada super_admin. Jalankan langkah BOOTSTRAP SUPER ADMIN di bawah.';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- BOOTSTRAP SUPER ADMIN  (jalankan SETELAH skrip di atas; ganti emailnya)
-- Tanpa ini tidak ada satu pun akun yang punya akses admin.
-- Dijalankan dari SQL Editor, jadi tidak terkena penjaga kolom role.
-- ============================================================================
-- UPDATE public.user_profiles
-- SET role = 'super_admin'
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'EMAIL-ANDA@contoh.com');

-- ============================================================================
-- PENGECEKAN SETELAH SELESAI
-- ============================================================================
-- select table_name from information_schema.tables where table_schema='public' order by 1;
-- select user_id, display_name, role from public.user_profiles order by created_at;
-- select policyname, tablename, cmd from pg_policies where schemaname='public' order by tablename;

-- ============================================================================
-- OPSIONAL — HAPUS PERMANEN DATA SKEMA LAMA (TIDAK BISA DIBATALKAN)
-- Jalankan hanya setelah CEMARA berjalan normal dan Anda yakin data cerita
-- lama tidak diperlukan lagi.
-- ============================================================================
-- DROP SCHEMA legacy_stories CASCADE;

-- ============================================================================
-- OPSIONAL — LIHAT DATA LAMA (hanya lewat SQL Editor)
-- ============================================================================
-- select count(*) from legacy_stories.stories;
-- select * from legacy_stories.profiles;