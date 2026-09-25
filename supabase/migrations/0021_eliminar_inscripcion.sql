-- Permite borrar por completo una inscripción cargada por error (ej. curso equivocado),
-- junto con sus pagos — mismo patrón que purge_edition_financials (0011): borrar pagos
-- sigue sin tener una policy de delete abierta en la tabla; pasa por esta función puntual,
-- acotada a UNA sola inscripción, no habilita un "borrar pago" suelto en ningún otro lado.

create or replace function purge_enrollment_financials(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_active_profile() then
    raise exception 'No autorizado';
  end if;

  delete from payments where enrollment_id = p_enrollment_id;
end;
$$;

grant execute on function purge_enrollment_financials(uuid) to authenticated;
