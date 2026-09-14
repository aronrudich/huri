create or replace function private.photo_path_in_my_dealership(_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select not exists (
    select 1 from public.car_photos cp
    where cp.ro_number = (storage.foldername(_name))[1]
      and cp.dealership_id is distinct from private.dealership_of(auth.uid())
  ) and not exists (
    select 1 from public.parked_cars pc
    where pc.ro_number = (storage.foldername(_name))[1]
      and pc.dealership_id is distinct from private.dealership_of(auth.uid())
  )
$$;

grant execute on function private.photo_path_in_my_dealership(text) to authenticated, supabase_storage_admin, service_role;

drop policy if exists "car photos storage read" on storage.objects;
drop policy if exists "car photos storage insert" on storage.objects;
drop policy if exists "car photos storage delete" on storage.objects;

create policy "car photos storage read" on storage.objects for select to authenticated
using (bucket_id = 'car-photos' and private.is_approved(auth.uid()) and private.photo_path_in_my_dealership(name));

create policy "car photos storage insert" on storage.objects for insert to authenticated
with check (bucket_id = 'car-photos' and private.is_active_employee(auth.uid()) and private.is_approved(auth.uid()) and not private.is_spectator(auth.uid()) and private.photo_path_in_my_dealership(name));

create policy "car photos storage delete" on storage.objects for delete to authenticated
using (bucket_id = 'car-photos' and private.is_active_employee(auth.uid()) and private.is_approved(auth.uid()) and not private.is_spectator(auth.uid()) and private.photo_path_in_my_dealership(name));