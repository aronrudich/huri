GRANT USAGE ON SCHEMA private TO authenticated, supabase_storage_admin;

GRANT EXECUTE ON FUNCTION
  private.is_approved(uuid),
  private.is_active_employee(uuid),
  private.is_spectator(uuid),
  private.dealership_of(uuid)
TO authenticated, supabase_storage_admin;