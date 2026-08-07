-- Manager-created customer logins are Client End Users (not Client Admins).

create or replace function public.confirm_portal_user(
  p_user_id uuid,
  p_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (
    app_private.is_admin()
    or app_private.is_service_ops()
    or app_private.is_account_manager()
  ) then
    raise exception 'Only managers can confirm portal users';
  end if;

  if p_user_id is null or p_customer_id is null then
    raise exception 'User and customer ids are required';
  end if;

  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'Customer not found';
  end if;

  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'role', 'client_user',
          'customer_id', p_customer_id::text
        )
  where id = p_user_id;

  insert into public.profiles (id, full_name, email, role, customer_id, active)
  select
    u.id,
    coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    u.email,
    'client_user',
    p_customer_id,
    true
  from auth.users u
  where u.id = p_user_id
  on conflict (id) do update
    set role = 'client_user',
        customer_id = excluded.customer_id,
        email = coalesce(excluded.email, public.profiles.email),
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        active = true;
end;
$function$;

-- Convert existing client-admin portal logins to client-user.
update public.profiles
set role = 'client_user'
where role = 'client_admin';

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'client_user')
where coalesce(raw_user_meta_data->>'role', '') = 'client_admin';
