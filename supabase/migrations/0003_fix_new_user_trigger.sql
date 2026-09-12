-- Fix: "Database error creating new user" al dar de alta un usuario desde
-- Authentication > Users. Causa: el trigger que crea el profile corre bajo el rol
-- supabase_auth_admin, que no tiene 'public' en su search_path por defecto, así que
-- la referencia sin calificar a "profiles" no se resolvía. Se corrige calificando
-- el schema y fijando search_path explícito en las funciones SECURITY DEFINER.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'empleada');
  return new;
end;
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function is_active_profile() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (user_id, entity, entity_id, action, old_data, new_data)
  values (
    auth.uid(),
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    TG_OP,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;
