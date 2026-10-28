CREATE OR REPLACE FUNCTION public.sync_huri_stale_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hours text; job bigint;
BEGIN
 SELECT string_agg(h::text,',' ORDER BY h) INTO hours FROM (SELECT DISTINCT extract(hour FROM ((date_trunc('day', now() AT TIME ZONE d.timezone)+ interval '5 hours') AT TIME ZONE d.timezone) AT TIME ZONE 'UTC')::int AS h FROM public.dealerships d) x;
 SELECT jobid INTO job FROM cron.job WHERE jobname='huri-stale-car-alerts';
 IF job IS NOT NULL AND hours IS NOT NULL THEN PERFORM cron.alter_job(job,schedule := '5 '||hours||' * * *'); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER huri_timezone_stale_schedule AFTER INSERT OR UPDATE OF timezone ON public.dealerships FOR EACH STATEMENT EXECUTE FUNCTION public.sync_huri_stale_schedule();
DO $$ DECLARE hours text; job bigint; BEGIN
SELECT string_agg(h::text,',' ORDER BY h) INTO hours FROM (SELECT DISTINCT extract(hour FROM ((date_trunc('day',now() AT TIME ZONE d.timezone)+interval '5 hours') AT TIME ZONE d.timezone) AT TIME ZONE 'UTC')::int h FROM public.dealerships d UNION SELECT DISTINCT extract(hour FROM ((date_trunc('day',(now()+interval '6 months') AT TIME ZONE d.timezone)+interval '5 hours') AT TIME ZONE d.timezone) AT TIME ZONE 'UTC')::int h FROM public.dealerships d) x;
SELECT jobid INTO job FROM cron.job WHERE jobname='huri-stale-car-alerts'; IF job IS NOT NULL THEN PERFORM cron.alter_job(job,schedule := '5 '||hours||' * * *'); END IF;
END $$;