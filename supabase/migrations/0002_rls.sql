-- Academia Datri — Row Level Security
-- Regla general: solo usuarios autenticados con profile activo pueden leer/escribir.
-- Empleada: acceso operativo completo salvo expenses, audit_logs, y escritura en
-- monthly_goals / commission_rate_history (solo lectura ahí).
-- Admin: acceso total.

alter table profiles enable row level security;
alter table course_types enable row level security;
alter table course_editions enable row level security;
alter table students enable row level security;
alter table leads enable row level security;
alter table enrollments enable row level security;
alter table waitlist enable row level security;
alter table payments enable row level security;
alter table attendance enable row level security;
alter table certificates enable row level security;
alter table documents enable row level security;
alter table expenses enable row level security;
alter table monthly_goals enable row level security;
alter table commission_rate_history enable row level security;
alter table audit_logs enable row level security;

-- ---------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------
create policy "profiles_select_self_or_admin" on profiles
  for select using (id = auth.uid() or is_admin());

create policy "profiles_update_self_or_admin" on profiles
  for update using (id = auth.uid() or is_admin());

create policy "profiles_insert_admin" on profiles
  for insert with check (is_admin());

-- ---------------------------------------------------------
-- COURSE_TYPES: lectura para todos los activos, escritura solo admin
-- ---------------------------------------------------------
create policy "course_types_select" on course_types
  for select using (is_active_profile());

create policy "course_types_write_admin" on course_types
  for insert with check (is_admin());
create policy "course_types_update_admin" on course_types
  for update using (is_admin());
create policy "course_types_delete_admin" on course_types
  for delete using (is_admin());

-- ---------------------------------------------------------
-- COURSE_EDITIONS: lectura para todos, escritura solo admin
-- (la empleada opera DENTRO de una edición vía enrollments, pero no crea/edita el catálogo)
-- ---------------------------------------------------------
create policy "course_editions_select" on course_editions
  for select using (is_active_profile());

create policy "course_editions_write_admin" on course_editions
  for insert with check (is_admin());
create policy "course_editions_update_admin" on course_editions
  for update using (is_admin());
create policy "course_editions_delete_admin" on course_editions
  for delete using (is_admin());

-- ---------------------------------------------------------
-- STUDENTS: CRUD operativo para todos los activos
-- ---------------------------------------------------------
create policy "students_select" on students for select using (is_active_profile());
create policy "students_insert" on students for insert with check (is_active_profile());
create policy "students_update" on students for update using (is_active_profile());
create policy "students_delete_admin" on students for delete using (is_admin());

-- ---------------------------------------------------------
-- LEADS (CRM)
-- ---------------------------------------------------------
create policy "leads_select" on leads for select using (is_active_profile());
create policy "leads_insert" on leads for insert with check (is_active_profile());
create policy "leads_update" on leads for update using (is_active_profile());
create policy "leads_delete_admin" on leads for delete using (is_admin());

-- ---------------------------------------------------------
-- ENROLLMENTS
-- ---------------------------------------------------------
create policy "enrollments_select" on enrollments for select using (is_active_profile());
create policy "enrollments_insert" on enrollments for insert with check (is_active_profile());
create policy "enrollments_update" on enrollments for update using (is_active_profile());
create policy "enrollments_delete_admin" on enrollments for delete using (is_admin());

-- ---------------------------------------------------------
-- WAITLIST
-- ---------------------------------------------------------
create policy "waitlist_select" on waitlist for select using (is_active_profile());
create policy "waitlist_insert" on waitlist for insert with check (is_active_profile());
create policy "waitlist_update" on waitlist for update using (is_active_profile());
create policy "waitlist_delete" on waitlist for delete using (is_active_profile());

-- ---------------------------------------------------------
-- PAYMENTS: crear/anular sí, borrar físicamente NO (ni admin) — se anula, no se elimina.
-- ---------------------------------------------------------
create policy "payments_select" on payments for select using (is_active_profile());
create policy "payments_insert" on payments for insert with check (is_active_profile());
create policy "payments_update" on payments for update using (is_active_profile());
-- Sin policy de DELETE => nadie puede borrar pagos, ni con la service role key mal usada desde el cliente.

-- ---------------------------------------------------------
-- ATTENDANCE / CERTIFICATES / DOCUMENTS
-- ---------------------------------------------------------
create policy "attendance_all" on attendance for all using (is_active_profile()) with check (is_active_profile());
create policy "certificates_all" on certificates for all using (is_active_profile()) with check (is_active_profile());
create policy "documents_select" on documents for select using (is_active_profile());
create policy "documents_insert" on documents for insert with check (is_active_profile());
create policy "documents_delete_admin" on documents for delete using (is_admin());

-- ---------------------------------------------------------
-- EXPENSES: exclusivo ADMIN, ni siquiera lectura para empleada
-- ---------------------------------------------------------
create policy "expenses_all_admin" on expenses
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------
-- MONTHLY_GOALS: lectura para todos, escritura solo admin
-- ---------------------------------------------------------
create policy "monthly_goals_select" on monthly_goals for select using (is_active_profile());
create policy "monthly_goals_write_admin" on monthly_goals for insert with check (is_admin());
create policy "monthly_goals_update_admin" on monthly_goals for update using (is_admin());
create policy "monthly_goals_delete_admin" on monthly_goals for delete using (is_admin());

-- ---------------------------------------------------------
-- COMMISSION_RATE_HISTORY: lectura para todos (ven el % aplicado), escritura solo admin
-- ---------------------------------------------------------
create policy "commission_rate_select" on commission_rate_history for select using (is_active_profile());
create policy "commission_rate_write_admin" on commission_rate_history for insert with check (is_admin());

-- ---------------------------------------------------------
-- AUDIT_LOGS: exclusivo admin
-- ---------------------------------------------------------
create policy "audit_logs_select_admin" on audit_logs for select using (is_admin());
-- Insert lo hace el trigger SECURITY DEFINER; no hace falta policy de insert para el rol normal.
