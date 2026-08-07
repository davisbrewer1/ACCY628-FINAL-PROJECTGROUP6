-- Provision customer portal Auth users without GoTrue signup emails
-- (avoids email rate limits that left customers with no login).

create or replace function public.provision_customer_portal_login(
  p_customer_id uuid,
  p_email text,
  p_full_name text default null,
  p_password text default 'DemoPass123!'
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_user_id uuid;
  v_identity_id uuid;
begin
  if not (
    app_private.is_admin()
    or app_private.is_service_ops()
    or app_private.is_account_manager()
  ) then
    raise exception 'Only managers can provision portal logins';
  end if;

  if p_customer_id is null then
    raise exception 'Customer id is required';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email is required';
  end if;

  if p_password is null or char_length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'Customer not found';
  end if;

  select u.id
    into v_user_id
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'full_name', coalesce(v_full_name, split_part(v_email, '@', 1)),
        'role', 'client_user',
        'customer_id', p_customer_id::text
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    v_identity_id := gen_random_uuid();
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_identity_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  else
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object(
            'full_name', coalesce(v_full_name, raw_user_meta_data->>'full_name', split_part(v_email, '@', 1)),
            'role', 'client_user',
            'customer_id', p_customer_id::text
          ),
        updated_at = now()
    where id = v_user_id;

    if not exists (
      select 1
      from auth.identities i
      where i.user_id = v_user_id
        and i.provider = 'email'
    ) then
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        v_user_id::text,
        now(),
        now(),
        now()
      );
    end if;
  end if;

  insert into public.profiles (id, full_name, email, role, customer_id, active)
  values (
    v_user_id,
    coalesce(v_full_name, split_part(v_email, '@', 1)),
    v_email,
    'client_user',
    p_customer_id,
    true
  )
  on conflict (id) do update
    set role = 'client_user',
        customer_id = excluded.customer_id,
        email = coalesce(excluded.email, public.profiles.email),
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        active = true;

  return v_user_id;
end;
$function$;

grant execute on function public.provision_customer_portal_login(uuid, text, text, text)
  to authenticated;
