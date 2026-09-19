-- Autoagenda pública: una persona sin login puede ver el catálogo de servicios/profesionales
-- activos, consultar horarios libres y reservar un turno. No cobra seña (eso sigue siendo en
-- el local por ahora) — el turno queda "reservado" igual que si lo cargara el staff.

-- Cualquiera puede ver el catálogo activo (nombre/precio/duración no es información
-- sensible). Se suma como policy nueva para el rol "anon", sin tocar las que ya usa el staff
-- logueado (is_active_profile()) — ambas conviven, Postgres las combina con OR.
create policy "services_select_public" on services for select to anon using (active = true);
create policy "professionals_select_public" on professionals for select to anon using (active = true);

-- Franjas ocupadas de un profesional en una fecha, SIN exponer de quién es cada turno ni
-- ningún otro dato — lo único que necesita saber quien reserva es "esto está libre / esto no".
create or replace function get_public_busy_slots(p_professional_id uuid, p_date date)
returns table(start_time time, end_time time)
language sql
security definer
set search_path = public
stable
as $$
  select start_time, end_time from appointments
  where professional_id = p_professional_id
    and appointment_date = p_date
    and status <> 'cancelado'
  union all
  select start_time, end_time from professional_blocks
  where professional_id = p_professional_id
    and block_date = p_date;
$$;

grant execute on function get_public_busy_slots(uuid, date) to anon;

-- Crea la reserva: busca o crea la clienta por teléfono, vuelve a chequear disponibilidad
-- server-side (evita que dos personas reserven el mismo horario al mismo tiempo — el chequeo
-- que hizo el navegador antes de mostrar el horario ya puede estar desactualizado) y crea el
-- turno en estado "reservado".
create or replace function create_public_appointment(
  p_service_id uuid,
  p_professional_id uuid,
  p_date date,
  p_start_time time,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_duration int;
  v_price numeric(14,2);
  v_end_time time;
  v_conflict_count int;
  v_appointment_id uuid;
begin
  if p_first_name is null or trim(p_first_name) = '' then
    raise exception 'Falta el nombre';
  end if;
  if p_phone is null or trim(p_phone) = '' then
    raise exception 'Falta el teléfono';
  end if;

  select duration_minutes, price into v_duration, v_price
  from services where id = p_service_id and active = true;
  if v_duration is null then
    raise exception 'Servicio inválido';
  end if;

  if not exists (select 1 from professionals where id = p_professional_id and active = true) then
    raise exception 'Profesional inválido';
  end if;

  if p_date < current_date then
    raise exception 'La fecha tiene que ser de hoy en adelante';
  end if;

  v_end_time := p_start_time + (v_duration::text || ' minutes')::interval;

  select count(*) into v_conflict_count
  from get_public_busy_slots(p_professional_id, p_date) b
  where p_start_time < b.end_time and v_end_time > b.start_time;

  if v_conflict_count > 0 then
    raise exception 'Ese horario ya no está disponible, elegí otro.';
  end if;

  select id into v_student_id from students where phone = trim(p_phone) limit 1;
  if v_student_id is null then
    insert into students (first_name, last_name, phone, email, country, status)
    values (
      trim(p_first_name),
      coalesce(nullif(trim(p_last_name), ''), '-'),
      trim(p_phone),
      nullif(trim(p_email), ''),
      'Argentina',
      'activa'
    )
    returning id into v_student_id;
  end if;

  insert into appointments (
    student_id, professional_id, service_id, appointment_date, start_time, end_time, price, status, notes
  )
  values (
    v_student_id, p_professional_id, p_service_id, p_date, p_start_time, v_end_time, v_price, 'reservado',
    'Reservado desde la web'
  )
  returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

grant execute on function create_public_appointment(uuid, uuid, date, time, text, text, text, text) to anon;
