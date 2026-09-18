-- Mismo mecanismo de descuento por pago en efectivo que ya existe para pagos de cursos
-- (0012_descuento_pago_efectivo.sql), pero para turnos: el monto cargado es el nominal
-- (se acredita entero contra el saldo del turno), lo realmente cobrado en efectivo es el
-- nominal menos el descuento, y el precio del turno baja por esa diferencia.

alter table appointment_payments add column cash_discount_percent numeric(5,2)
  check (cash_discount_percent is null or (cash_discount_percent >= 0 and cash_discount_percent <= 100));
alter table appointment_payments add column cash_discount_amount numeric(14,2)
  check (cash_discount_amount is null or cash_discount_amount >= 0);

create or replace function register_appointment_cash_discount_payment(
  p_appointment_id uuid,
  p_payment_date date,
  p_nominal_amount numeric,
  p_discount_percent numeric,
  p_payment_type payment_type,
  p_reference text,
  p_notes text
)
returns appointment_payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_discount_amount numeric(14,2);
  v_actual_amount numeric(14,2);
  v_payment appointment_payments;
begin
  if p_discount_percent is null or p_discount_percent <= 0 or p_discount_percent > 100 then
    raise exception 'Porcentaje de descuento inválido';
  end if;
  if p_nominal_amount is null or p_nominal_amount <= 0 then
    raise exception 'Monto inválido';
  end if;

  v_discount_amount := round(p_nominal_amount * p_discount_percent / 100, 2);
  v_actual_amount := p_nominal_amount - v_discount_amount;

  insert into appointment_payments (
    appointment_id, payment_date, amount, payment_type, payment_method,
    reference, notes, cash_discount_percent, cash_discount_amount, created_by
  )
  values (
    p_appointment_id, p_payment_date, v_actual_amount, p_payment_type, 'efectivo',
    p_reference, p_notes, p_discount_percent, v_discount_amount, auth.uid()
  )
  returning * into v_payment;

  update appointments
  set price = price - v_discount_amount, updated_at = now()
  where id = p_appointment_id;

  return v_payment;
end;
$$;

grant execute on function register_appointment_cash_discount_payment(uuid, date, numeric, numeric, payment_type, text, text) to authenticated;

-- Anular un pago con descuento devuelve ese descuento al precio del turno, igual que con
-- los pagos de cursos.
create or replace function void_appointment_payment(p_payment_id uuid, p_reason text, p_voided_by uuid)
returns appointment_payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment appointment_payments;
begin
  update appointment_payments
  set status = 'anulado', voided_at = now(), voided_by = p_voided_by, void_reason = p_reason
  where id = p_payment_id and status = 'valido'
  returning * into v_payment;

  if v_payment.id is null then
    raise exception 'Pago no encontrado o ya estaba anulado';
  end if;

  if v_payment.cash_discount_amount is not null and v_payment.cash_discount_amount > 0 then
    update appointments
    set price = price + v_payment.cash_discount_amount, updated_at = now()
    where id = v_payment.appointment_id;
  end if;

  return v_payment;
end;
$$;

grant execute on function void_appointment_payment(uuid, text, uuid) to authenticated;
