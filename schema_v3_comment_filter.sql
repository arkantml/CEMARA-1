

ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS status text 
  NOT NULL 
  DEFAULT 'pending'
  CHECK (status IN ('approved', 'pending', 'flagged'));

ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS is_inappropriate boolean 
  NOT NULL 
  DEFAULT FALSE;

ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS flagged_reason text;

ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS reviewed_by uuid 
  REFERENCES auth.users(id) ON DELETE SET NULL;


CREATE INDEX IF NOT EXISTS idx_comments_status 
  ON public.comments(status);

CREATE INDEX IF NOT EXISTS idx_comments_is_inappropriate 
  ON public.comments(is_inappropriate);

CREATE INDEX IF NOT EXISTS idx_comments_work_status 
  ON public.comments(work_id, status);

-- ============================================================
-- 3. FUNCTION: CHECK INAPPROPRIATE CONTENT
-- ============================================================

CREATE OR REPLACE FUNCTION check_comment_content(comment_text TEXT)
RETURNS TABLE(is_flagged BOOLEAN, reason TEXT) AS $$
DECLARE
  bad_words TEXT[] := ARRAY[
    -- List Lama
    'kontol', 'bitch', 'fuck', 'damn', 'hell', 'ass',
    'bodoh', 'goblok', 'bangsat', 'brengsek', 'setan',
    'anjing', 'monyet', 'babi', 'kambing', 'tahi',
    'tai', 'omdo', 'nyebur', 'ngegas', 'ngancam',
    'bajingan', 'keparat', 'sialan', 'jancok', 'dancok', 'asu', 'pantek',
    'memek', 'pepek', 'peler', 'ngentot', 'jembut', 'lonte', 'pelacur',
    'tolol', 'bego', 'dungu', 'kampret', 'celeng',
    'shit', 'dick', 'cunt', 'bastard', 'asshole', 'motherfucker'
];
  i INT;
  text_lower TEXT := LOWER(comment_text);
BEGIN
  -- Cek panjang (terlalu pendek atau terlalu panjang)
  IF CHAR_LENGTH(TRIM(comment_text)) < 2 THEN
    RETURN QUERY SELECT TRUE, 'Komentar terlalu pendek'::TEXT;
    RETURN;
  END IF;

  -- Cek excessive caps (lebih dari 70% huruf besar)
  IF (SELECT COUNT(*) FROM regexp_matches(comment_text, '[A-Z]', 'g')) > CHAR_LENGTH(comment_text) * 0.7 THEN
    RETURN QUERY SELECT TRUE, 'Komentar menggunakan huruf besar berlebihan'::TEXT;
    RETURN;
  END IF;

  -- Cek excessive symbols (!!! atau ???)
  IF comment_text ~ '(.)\1{4,}' THEN
    RETURN QUERY SELECT TRUE, 'Komentar menggunakan karakter berulang berlebihan'::TEXT;
    RETURN;
  END IF;

  -- Cek bad words
  FOREACH i IN ARRAY (SELECT ARRAY_AGG(idx) FROM (
    SELECT GENERATE_SUBSCRIPTS(bad_words, 1) AS idx
    WHERE text_lower LIKE '%' || bad_words[GENERATE_SUBSCRIPTS(bad_words, 1)] || '%'
  ) t)
  LOOP
    RETURN QUERY SELECT TRUE, 'Komentar mengandung bahasa yang tidak pantas'::TEXT;
    RETURN;
  END LOOP;

  -- Jika lolos semua check
  RETURN QUERY SELECT FALSE, ''::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 4. TRIGGER: VALIDASI KOMENTAR SEBELUM INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION validate_comment_before_insert()
RETURNS TRIGGER AS $$
DECLARE
  check_result RECORD;
BEGIN
  -- Jalankan check content
  SELECT * INTO check_result FROM check_comment_content(NEW.content);
  
  IF check_result.is_flagged THEN
    NEW.status := 'flagged';
    NEW.is_inappropriate := TRUE;
    NEW.flagged_reason := check_result.reason;
  ELSE
    NEW.status := 'approved';
    NEW.is_inappropriate := FALSE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comments_validate_before_insert ON public.comments;
CREATE TRIGGER comments_validate_before_insert
BEFORE INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION validate_comment_before_insert();

-- ============================================================
-- 5. FUNCTION: REVIEW COMMENT (ADMIN ACTION)
-- ============================================================

CREATE OR REPLACE FUNCTION review_comment(
  comment_id UUID,
  new_status TEXT,
  reviewer_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_comment RECORD;
BEGIN
  -- Cek komentar ada
  SELECT * INTO v_comment FROM public.comments WHERE id = comment_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Komentar tidak ditemukan'::TEXT;
    RETURN;
  END IF;

  -- Update status
  UPDATE public.comments
  SET 
    status = new_status,
    reviewed_at = NOW(),
    reviewed_by = reviewer_id,
    is_inappropriate = CASE WHEN new_status = 'flagged' THEN TRUE ELSE FALSE END
  WHERE id = comment_id;

  RETURN QUERY SELECT TRUE, 'Komentar berhasil direview'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. RLS POLICIES (DANGER BOX ONLY FOR ADMINS)
-- ============================================================

-- Enable RLS jika belum
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Admin dapat melihat flagged comments
CREATE POLICY "admin_view_flagged_comments" ON public.comments
  FOR SELECT
  USING (
    status = 'flagged' AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin', 'dev')
    )
  );

-- Users hanya lihat approved comments
CREATE POLICY "user_view_approved_comments" ON public.comments
  FOR SELECT
  USING (status = 'approved');
