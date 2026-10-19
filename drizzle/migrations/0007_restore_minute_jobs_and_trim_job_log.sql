-- The archive and reminder jobs must run every minute (they had drifted to every 10 minutes).
SELECT cron.alter_job(jobid, schedule := '* * * * *')
FROM cron.job WHERE jobname IN ('archive-stale-pickups-every-minute', 'huri-unclaimed-reminder');

-- The job-run log had grown to most of the database; keep 3 days of history.
DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'huri-trim-job-log') THEN
    PERFORM cron.unschedule('huri-trim-job-log');
  END IF;
  PERFORM cron.schedule('huri-trim-job-log', '17 9 * * *',
    $c$ DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days' $c$);
END $$;