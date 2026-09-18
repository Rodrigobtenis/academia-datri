-- Módulo de Turnos (el "estudio"): profesionales, servicios, turnos y sus pagos.
-- Es un dominio separado de cursos/inscripciones — comparte la tabla students como
-- directorio de clientas, pero no toca enrollments/course_editions para nada.

create table professionals (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text,
  commission_percent numeric(5,2) not null default 0 check (commission_percent >= 0 and commission_percent <= 100),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  price numeric(14,2) not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create type appointment_status as enum ('reservado', 'confirmado', 'atendido', 'cancelado', 'no_asistio');

create table appointments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  professional_id uuid not null references professionals(id),
  service_id uuid not null references services(id),
  appointment_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  price numeric(14,2) not null check (price >= 0),
  status appointment_status not null default 'reservado',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_appointments_date on appointments(appointment_date);
create index idx_appointments_professional_date on appointments(professional_id, appointment_date);
create index idx_appointments_student on appointments(student_id);

-- Mismo esquema que "payments" (reutiliza los enums payment_type/payment_method/payment_status)
-- pero para turnos en vez de inscripciones. Igual regla: nunca se borra un pago físicamente,
-- se anula con motivo.
create table appointment_payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id),
  payment_date date not null,
  amount numeric(14,2) not null,
  payment_type payment_type not null,
  payment_method payment_method not null,
  reference text,
  notes text,
  status payment_status not null default 'valido',
  voided_at timestamptz,
  voided_by uuid references profiles(id),
  void_reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_appointment_payments_appointment on appointment_payments(appointment_id);
create index idx_appointment_payments_date on appointment_payments(payment_date);
create index idx_appointment_payments_status on appointment_payments(status);

create view v_appointment_balance as
select
  a.id as appointment_id,
  a.price as final_price,
  coalesce(sum(p.amount) filter (where p.status = 'valido'), 0) as paid_amount,
  a.price - coalesce(sum(p.amount) filter (where p.status = 'valido'), 0) as balance
from appointments a
left join appointment_payments p on p.appointment_id = a.id
group by a.id, a.price;

-- Comisión de cada profesional por mes: sobre turnos ATENDIDOS (no reservados, no
-- cancelados), contando por la fecha del turno — a diferencia de cursos, acá el turno se
-- cobra en el momento así que no hace falta separar por fecha de pago.
create view v_professional_commission as
select
  pr.id as professional_id,
  extract(year from a.appointment_date)::int as year,
  extract(month from a.appointment_date)::int as month,
  count(a.id) as appointment_count,
  coalesce(sum(a.price), 0) as total_billed,
  coalesce(sum(a.price * pr.commission_percent / 100), 0) as commission_amount
from professionals pr
join appointments a on a.professional_id = pr.id and a.status = 'atendido'
group by pr.id, extract(year from a.appointment_date), extract(month from a.appointment_date);

alter table professionals enable row level security;
alter table services enable row level security;
alter table appointments enable row level security;
alter table appointment_payments enable row level security;

create policy "professionals_select" on professionals for select using (is_active_profile());
create policy "professionals_insert_admin" on professionals for insert with check (is_admin());
create policy "professionals_update_admin" on professionals for update using (is_admin());
create policy "professionals_delete_admin" on professionals for delete using (is_admin());

create policy "services_select" on services for select using (is_active_profile());
create policy "services_insert_admin" on services for insert with check (is_admin());
create policy "services_update_admin" on services for update using (is_admin());
create policy "services_delete_admin" on services for delete using (is_admin());

create policy "appointments_select" on appointments for select using (is_active_profile());
create policy "appointments_insert" on appointments for insert with check (is_active_profile());
create policy "appointments_update" on appointments for update using (is_active_profile());
-- Sin policy de delete: un turno se cancela (status), no se borra — mismo criterio que
-- enrollments/payments para no perder trazabilidad de dinero.

create policy "appointment_payments_select" on appointment_payments for select using (is_active_profile());
create policy "appointment_payments_insert" on appointment_payments for insert with check (is_active_profile());
create policy "appointment_payments_update" on appointment_payments for update using (is_active_profile());
-- Sin policy de delete, igual que payments: se anula, nunca se borra.
