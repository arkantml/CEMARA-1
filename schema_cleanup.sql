
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
