-- Academia Datri — esquema inicial completo
-- Se aplica en Supabase SQL Editor cuando el proyecto esté creado (Etapa 15 / a demanda).

-- =========================================================
-- EXTENSIONES
-- =========================================================
create extension if not exists "pgcrypto";

-- =========================================================
-- ENUMS
-- =========================================================
create type user_role as enum ('admin', 'empleada');
create type student_source as enum
  ('instagram', 'google', 'recomendacion', 'whatsapp', 'alumna_anterior', 'publicidad', 'tiktok', 'otro');
create type student_status as enum ('activa', 'inactiva', 'potencial');
create type edition_status as enum
  ('borrador', 'abierto', 'proximo', 'completo', 'finalizado', 'cancelado');
create type discount_type as enum ('monto', 'porcentaje');
create type enrollment_status as enum
  ('consulta', 'reservada', 'confirmada', 'pagando', 'pagada', 'asistio', 'finalizada', 'cancelada', 'no_asistio');
create type payment_type as enum ('sena', 'parcial', 'final', 'completo', 'ajuste', 'reintegro');
create type payment_method as enum
  ('efectivo', 'transferencia', 'mercado_pago', 'tarjeta_debito', 'tarjeta_credito', 'otro');
create type payment_status as enum ('valido', 'anulado');
create type attendance_status as enum ('asistio', 'no_asistio', 'tarde', 'justifico');
create type certificate_status as enum ('pendiente', 'preparado', 'entregado');
create type document_type as enum ('comprobante', 'dni', 'formulario', 'consentimiento', 'certificado', 'otro');
create type lead_status as enum
  ('nueva_consulta', 'contactada', 'interesada', 'pendiente_respuesta', 'reservo', 'perdida', 'inscripta');
create type expense_category as enum
  ('materiales', 'docentes', 'publicidad', 'catering', 'alquiler', 'servicios', 'impresion', 'certificados', 'insumos', 'otros');

-- =========================================================
-- PROFILES (1:1 con auth.users)
-- =========================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'empleada',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Crea el profile automáticamente al registrar un usuario (rol por defecto: empleada;
-- el primer admin se promueve a mano con un UPDATE una vez creado el usuario en Supabase Auth).
-- search_path fijo en 'public': el rol interno supabase_auth_admin (quien dispara este
-- trigger al crear un usuario) no tiene 'public' en su search_path por defecto, así que
-- si no se califica el schema acá la creación de usuarios falla con
-- "Database error creating new user".
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'empleada');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin' and active
  );
$$;

create function is_active_profile() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

-- =========================================================
-- CURSOS: modalidades y ediciones
-- =========================================================
create table course_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table course_editions (
  id uuid primary key default gen_random_uuid(),
  course_type_id uuid not null references course_types(id),
  name text,
  start_date date not null,
  end_date date,
  start_time time,
  end_time time,
  location text,
  teacher text,
  max_students int not null check (max_students > 0),
  list_price numeric(14,2) not null check (list_price >= 0),
  promo_price numeric(14,2) check (promo_price >= 0),
  status edition_status not null default 'borrador',
  description text,
  includes text,
  materials text,
  requirements text,
  internal_notes text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

create index idx_course_editions_type on course_editions(course_type_id);
create index idx_course_editions_dates on course_editions(start_date);

-- =========================================================
-- ALUMNAS
-- =========================================================
create table students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  dni text,
  birth_date date,
  phone text,
  whatsapp text,
  email text,
  instagram text,
  city text,
  province text,
  country text default 'Argentina',
  profession text,
  specialty text,
  source student_source,
  notes text,
  status student_status not null default 'activa',
  photo_url text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

create index idx_students_name on students(last_name, first_name);
create index idx_students_dni on students(dni);

-- =========================================================
-- CRM: LEADS
-- =========================================================
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  whatsapp text,
  instagram text,
  course_type_id uuid references course_types(id),
  status lead_status not null default 'nueva_consulta',
  source student_source,
  contact_date date not null default current_date,
  next_followup date,
  sales_responsible uuid references profiles(id),
  notes text,
  converted_student_id uuid references students(id),
  converted_enrollment_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create index idx_leads_status on leads(status);
create index idx_leads_followup on leads(next_followup);

-- =========================================================
-- INSCRIPCIONES
-- =========================================================
create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  course_edition_id uuid not null references course_editions(id),
  original_price numeric(14,2) not null check (original_price >= 0),
  discount_type discount_type,
  discount_value numeric(14,2) check (discount_value >= 0),
  discount_reason text,
  discount_authorized_by uuid references profiles(id),
  final_price numeric(14,2) not null check (final_price >= 0),
  status enrollment_status not null default 'reservada',
  sales_responsible uuid references profiles(id),
  override_capacity boolean not null default false,
  override_authorized_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

alter table leads
  add constraint fk_leads_converted_enrollment
  foreign key (converted_enrollment_id) references enrollments(id);

create index idx_enrollments_student on enrollments(student_id);
create index idx_enrollments_edition on enrollments(course_edition_id);
create index idx_enrollments_status on enrollments(status);

-- =========================================================
-- LISTA DE ESPERA
-- =========================================================
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  course_edition_id uuid not null references course_editions(id),
  priority int not null default 0,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create index idx_waitlist_edition on waitlist(course_edition_id);

-- =========================================================
-- PAGOS
-- =========================================================
create table payments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id),
  payment_date date not null,
  amount numeric(14,2) not null,
  payment_type payment_type not null,
  payment_method payment_method not null,
  reference text,
  notes text,
  status payment_status not null default 'valido',
  related_payment_id uuid references payments(id),
  voided_at timestamptz,
  voided_by uuid references profiles(id),
  void_reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_payments_enrollment on payments(enrollment_id);
create index idx_payments_date on payments(payment_date);
create index idx_payments_status on payments(status);

-- =========================================================
-- ASISTENCIA / CERTIFICADOS / DOCUMENTOS
-- =========================================================
create table attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  course_edition_id uuid not null references course_editions(id),
  attendance_date date not null,
  status attendance_status not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (student_id, course_edition_id, attendance_date)
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  course_edition_id uuid not null references course_editions(id),
  status certificate_status not null default 'pendiente',
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, course_edition_id)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  enrollment_id uuid references enrollments(id),
  type document_type not null,
  file_url text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- GASTOS (solo ADMIN)
-- =========================================================
create table expenses (
  id uuid primary key default gen_random_uuid(),
  course_edition_id uuid references course_editions(id),
  expense_date date not null,
  category expense_category not null,
  amount numeric(14,2) not null check (amount >= 0),
  description text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_expenses_edition on expenses(course_edition_id);
create index idx_expenses_date on expenses(expense_date);

-- =========================================================
-- OBJETIVOS MENSUALES
-- =========================================================
create table monthly_goals (
  id uuid primary key default gen_random_uuid(),
  month int not null check (month between 1 and 12),
  year int not null check (year between 2020 and 2100),
  target_amount numeric(14,2) not null check (target_amount >= 0),
  name text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month, year)
);

-- =========================================================
-- HISTORIAL DE % DE COMISIÓN
-- =========================================================
create table commission_rate_history (
  id uuid primary key default gen_random_uuid(),
  rate_percent numeric(5,2) not null check (rate_percent >= 0 and rate_percent <= 100),
  effective_from date not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Semilla: 5% vigente desde hoy.
insert into commission_rate_history (rate_percent, effective_from, notes)
values (5.00, current_date, 'Tasa inicial');

-- =========================================================
-- AUDITORÍA
-- =========================================================
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  entity text not null,
  entity_id uuid not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_entity on audit_logs(entity, entity_id);

create function audit_trigger() returns trigger
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

create trigger audit_enrollments after insert or update or delete on enrollments
  for each row execute function audit_trigger();
create trigger audit_payments after insert or update or delete on payments
  for each row execute function audit_trigger();
create trigger audit_course_editions after insert or update or delete on course_editions
  for each row execute function audit_trigger();
create trigger audit_students after insert or update or delete on students
  for each row execute function audit_trigger();
create trigger audit_monthly_goals after insert or update or delete on monthly_goals
  for each row execute function audit_trigger();
create trigger audit_commission_rate_history after insert or update or delete on commission_rate_history
  for each row execute function audit_trigger();
create trigger audit_expenses after insert or update or delete on expenses
  for each row execute function audit_trigger();

-- =========================================================
-- updated_at automático
-- =========================================================
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_course_editions before update on course_editions
  for each row execute function set_updated_at();
create trigger set_updated_at_students before update on students
  for each row execute function set_updated_at();
create trigger set_updated_at_enrollments before update on enrollments
  for each row execute function set_updated_at();
create trigger set_updated_at_monthly_goals before update on monthly_goals
  for each row execute function set_updated_at();

-- =========================================================
-- VISTAS
-- =========================================================

-- Saldo por inscripción
create view v_enrollment_balance as
select
  e.id as enrollment_id,
  e.final_price,
  coalesce(sum(p.amount) filter (where p.status = 'valido'), 0) as paid_amount,
  e.final_price - coalesce(sum(p.amount) filter (where p.status = 'valido'), 0) as balance
from enrollments e
left join payments p on p.enrollment_id = e.id
group by e.id, e.final_price;

-- Cupos / ocupación por edición
create view v_edition_occupancy as
select
  ed.id as course_edition_id,
  ed.max_students,
  count(en.id) filter (where en.status not in ('cancelada', 'no_asistio')) as enrolled_count,
  ed.max_students - count(en.id) filter (where en.status not in ('cancelada', 'no_asistio')) as available,
  round(
    100.0 * count(en.id) filter (where en.status not in ('cancelada', 'no_asistio')) / nullif(ed.max_students, 0),
    1
  ) as occupancy_pct
from course_editions ed
left join enrollments en on en.course_edition_id = ed.id
group by ed.id, ed.max_students;

-- Comisión por pago individual (usa el % vigente en la fecha de ESE pago)
create view v_payment_commission as
select
  p.id as payment_id,
  p.enrollment_id,
  p.payment_date,
  p.amount,
  p.payment_type,
  p.payment_method,
  p.status,
  crh.rate_percent,
  round(p.amount * crh.rate_percent / 100, 2) as commission_amount
from payments p
left join lateral (
  select rate_percent
  from commission_rate_history
  where effective_from <= p.payment_date
  order by effective_from desc
  limit 1
) crh on true;

-- Cobranza neta mensual (pagos válidos, agrupados por fecha real de pago)
create view v_monthly_net_collections as
select
  date_trunc('month', payment_date)::date as month_start,
  extract(month from payment_date)::int as month,
  extract(year from payment_date)::int as year,
  sum(amount) as net_collected
from payments
where status = 'valido'
group by 1, 2, 3;

-- Comisión mensual (suma de comisiones por pago, mismo agrupamiento)
create view v_monthly_commission as
select
  extract(month from payment_date)::int as month,
  extract(year from payment_date)::int as year,
  sum(amount) as net_collected,
  sum(commission_amount) as total_commission
from v_payment_commission
where status = 'valido'
group by 1, 2;

-- Avance de objetivo mensual
create view v_goal_progress as
select
  g.id as goal_id,
  g.month,
  g.year,
  g.target_amount,
  coalesce(c.net_collected, 0) as collected,
  g.target_amount - coalesce(c.net_collected, 0) as remaining,
  round(100.0 * coalesce(c.net_collected, 0) / nullif(g.target_amount, 0), 1) as percent_complete
from monthly_goals g
left join v_monthly_net_collections c on c.month = g.month and c.year = g.year;

-- Facturación / cobranza por modalidad de curso
create view v_course_type_summary as
select
  ct.id as course_type_id,
  ct.name,
  count(distinct ed.id) as edition_count,
  count(distinct en.id) filter (where en.status not in ('cancelada')) as enrollment_count,
  sum(en.final_price) filter (where en.status not in ('cancelada')) as total_sold,
  coalesce(sum(p.amount) filter (where p.status = 'valido'), 0) as total_collected
from course_types ct
left join course_editions ed on ed.course_type_id = ct.id
left join enrollments en on en.course_edition_id = ed.id
left join payments p on p.enrollment_id = en.id
group by ct.id, ct.name;

-- Recurrencia de alumnas (cantidad de ediciones completadas)
create view v_student_recurrence as
select
  student_id,
  count(*) filter (where status in ('asistio', 'finalizada')) as completed_courses,
  case
    when count(*) filter (where status in ('asistio', 'finalizada')) <= 1 then 'primera_vez'
    else 'recurrente'
  end as recurrence_label
from enrollments
group by student_id;

-- Rentabilidad por edición
create view v_edition_profitability as
select
  ed.id as course_edition_id,
  ed.name,
  ed.course_type_id,
  coalesce(sum(p.amount) filter (where p.status = 'valido'), 0) as income,
  coalesce((select sum(amount) from expenses ex where ex.course_edition_id = ed.id), 0) as expenses_total,
  coalesce(sum(p.amount) filter (where p.status = 'valido'), 0)
    - coalesce((select sum(amount) from expenses ex where ex.course_edition_id = ed.id), 0) as profit
from course_editions ed
left join enrollments en on en.course_edition_id = ed.id
left join payments p on p.enrollment_id = en.id
group by ed.id, ed.name, ed.course_type_id;
