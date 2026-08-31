ALTER TABLE public.thread_hides ALTER COLUMN dealership_id DROP DEFAULT;

DROP TRIGGER IF EXISTS thread_hides_set_dealership ON public.thread_hides;
CREATE TRIGGER thread_hides_set_dealership
BEFORE INSERT ON public.thread_hides
FOR EACH ROW EXECUTE FUNCTION public.set_dealership_from_user();