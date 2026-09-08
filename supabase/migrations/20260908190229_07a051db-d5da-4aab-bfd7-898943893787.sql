GRANT USAGE ON SCHEMA private TO postgres, service_role, supabase_admin;

GRANT EXECUTE ON FUNCTION private.dealership_of(uuid), private.is_approved(uuid), private.is_owner(uuid),
  private.is_admin(uuid), private.is_manager(uuid), private.is_active_employee(uuid),
  private.user_in_role_group(uuid, uuid)
  TO postgres, service_role, supabase_admin;