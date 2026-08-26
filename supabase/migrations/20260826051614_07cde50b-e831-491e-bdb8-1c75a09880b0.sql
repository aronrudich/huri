SELECT cron.unschedule('huri-stale-car-alerts');

SELECT cron.schedule(
  'huri-stale-car-alerts',
  '5 16,17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--7a2bc1d9-d11a-4987-b046-aa093d085a42.lovable.app/api/public/hooks/stale-cars',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsa3hleXN2ZWR1ZXd1eHJ2b3lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDY5ODQsImV4cCI6MjA5NjUyMjk4NH0.WcoCVt_r5xJnfeRum7W1EUDlNfGeJGTe77kRpdvUYXw'),
    body := '{}'::jsonb
  ) as request_id;
  $$
);