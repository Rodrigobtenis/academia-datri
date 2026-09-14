-- Modelos: personas que se ofrecen para practicar durante las capacitaciones
-- (distinto de "students" — no pagan, no se inscriben a una edición puntual).

create table models (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  age int check (age is null or (age > 0 and age < 120)),
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

-- Qué servicio(s) quiere hacerse — múltiples modalidades por modelo.
create table model_course_types (
  model_id uuid not null references models(id) on delete cascade,
  course_type_id uuid not null references course_types(id),
  primary key (model_id, course_type_id)
);

alter table models enable row level security;
alter table model_course_types enable row level security;

create policy "models_select" on models for select using (is_active_profile());
create policy "models_insert" on models for insert with check (is_active_profile());
create policy "models_update" on models for update using (is_active_profile());
create policy "models_delete_admin" on models for delete using (is_admin());

create policy "model_course_types_select" on model_course_types for select using (is_active_profile());
create policy "model_course_types_insert" on model_course_types for insert with check (is_active_profile());
create policy "model_course_types_delete" on model_course_types for delete using (is_active_profile());

create trigger set_updated_at_models before update on models
  for each row execute function set_updated_at();

create trigger audit_models after insert or update or delete on models
  for each row execute function audit_trigger();

-- Storage para las fotos de modelos (bucket privado, igual criterio que "documentos":
-- cualquier profile activo sube/ve, solo admin borra).
insert into storage.buckets (id, name, public)
values ('modelos', 'modelos', false)
on conflict (id) do nothing;

create policy "modelos_fotos_select" on storage.objects
  for select using (bucket_id = 'modelos' and is_active_profile());

create policy "modelos_fotos_insert" on storage.objects
  for insert with check (bucket_id = 'modelos' and is_active_profile());

create policy "modelos_fotos_delete" on storage.objects
  for delete using (bucket_id = 'modelos' and is_admin());
