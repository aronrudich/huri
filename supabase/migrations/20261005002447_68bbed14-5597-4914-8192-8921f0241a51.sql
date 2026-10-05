CREATE OR REPLACE FUNCTION private.is_huri_support(_uid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _uid
    AND lower(u.email) IN ('aron@huri.team','aron@oremor.net') AND u.email_confirmed_at IS NOT NULL)
$function$;