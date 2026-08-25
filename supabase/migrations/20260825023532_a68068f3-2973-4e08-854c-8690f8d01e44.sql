REVOKE ALL ON FUNCTION public.directory_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.message_recipients_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.directory_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.message_recipients_for(uuid) TO service_role;