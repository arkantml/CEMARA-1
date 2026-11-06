-- CEMARA temporary artifact cleanup.
-- Run after schema.sql and schema_arsip.sql.
-- Deploy supabase/functions/cleanup-temporary-artifacts first with JWT verification disabled.
-- Example: supabase functions deploy cleanup-temporary-artifacts --no-verify-jwt
--
-- Before running this script, add these three secrets to Supabase Vault:
--   cemara_project_url        = https://<project-ref>.supabase.co
--   cemara_publishable_key    = <project publishable key>
--   cemara_cleanup_cron_secret = same random secret as Edge Function CLEANUP_CRON_SECRET
--
-- Set the Edge Function secret with:
--   supabase secrets set CLEANUP_CRON_SECRET=<same random secret>
--
-- The scheduled function deletes:
--   * rejected work submissions reviewed more than 7 days ago, including their attachments
--   * read inbox notifications older than 7 days
--   * unreferenced Storage objects older than 7 days in the four CEMARA buckets
-- Pending submissions, approved works, archives, current avatars, unread notifications,
-- comments, and account activity are retained.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF (
    SELECT count(DISTINCT name)
    FROM vault.decrypted_secrets
    WHERE name IN (
      'cemara_project_url',
      'cemara_publishable_key',
      'cemara_cleanup_cron_secret'
    )
  ) <> 3 THEN
    RAISE EXCEPTION 'Tambahkan tiga secret CEMARA ke Supabase Vault sebelum menjadwalkan cleanup.';
  END IF;
END;
$$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cemara-temporary-artifacts-daily';

SELECT cron.schedule(
  'cemara-temporary-artifacts-daily',
  '15 3 * * *',
  $job$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'cemara_project_url'
      ) || '/functions/v1/cleanup-temporary-artifacts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'cemara_publishable_key'
        ),
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'cemara_cleanup_cron_secret'
        )
      ),
      body := jsonb_build_object('trigger', 'pg_cron')
    );
  $job$
);

COMMIT;
