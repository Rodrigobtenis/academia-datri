-- Bloqueos de horario por profesional (almuerzo, día libre, "hora bloqueada", etc.).
-- No es un turno: no tiene clienta ni pago, solo marca que ese profesional no está
-- disponible en ese rango. Participa del mismo chequeo de superposición que los turnos
-- (avisa si se pisa, pero deja agendar igual si el usuario confirma).

create table professional_blocks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals(id),
  block_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_professional_blocks_date on professional_blocks(professional_id, block_date);

alter table professional_blocks enable row level security;

create policy "professional_blocks_select" on professional_blocks for select using (is_active_profile());
create policy "professional_blocks_insert" on professional_blocks for insert with check (is_active_profile());
create policy "professional_blocks_update" on professional_blocks for update using (is_active_profile());
create policy "professional_blocks_delete" on professional_blocks for delete using (is_active_profile());
