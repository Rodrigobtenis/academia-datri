-- Descuento por pago en efectivo (parcial o total): al registrar un pago en efectivo se
-- puede aplicar un % de descuento. El % siempre se calcula sobre el monto "nominal" que se
-- carga (lo que la alumna debía de esa cuota, SIN descontar) — nunca sobre un monto ya
-- reducido — para que descuentos sucesivos no se compongan entre sí. El monto realmente
-- cobrado (payments.amount) es el nominal menos el descuento; el precio final de la
-- inscripción baja esa misma diferencia, así el saldo queda coherente:
--   saldo $100.000, pago nominal $50.000 con 10% off → se cobran $45.000,
--   se acreditan $50.000 contra el saldo (que la alumna "salda" con ese pago),
--   precio final baja de $100.000 a $95.000, saldo restante $50.000.
-- Puede aplicarse en más de un pago de la misma inscripción (se van acumulando).

alter table payments add column cash_discount_percent numeric(5,2)
  check (cash_discount_percent is null or (cash_discount_percent >= 0 and cash_discount_percent <= 100));
alter table payments add column cash_discount_amount numeric(14,2)
  check (cash_discount_amount is null or cash_discount_amount >= 0);

-- security invoker: no hace falta bypassear RLS, solo necesitamos que el insert en
-- payments y el update en enrollments ocurran en una sola transacción. Las policies
-- normales (payments_insert / enrollments_update, ambas is_active_profile()) ya validan
-- que quien llama esté habilitado.
create or replace function register_cash_discount_payment(
  p_enrollment_id uuid,
  p_payment_date date,
  p_nominal_amount numeric,
  p_discount_percent numeric,
  p_payment_type payment_type,
  p_reference text,
  p_notes text
)
returns payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_discount_amount numeric(14,2);
  v_actual_amount numeric(14,2);
  v_payment payments;
begin
  if p_discount_percent is null or p_discount_percent <= 0 or p_discount_percent > 100 then
    raise exception 'Porcentaje de descuento inválido';
  end if;
  if p_nominal_amount is null or p_nominal_amount <= 0 then
    raise exception 'Monto inválido';
  end if;

  v_discount_amount := round(p_nominal_amount * p_discount_percent / 100, 2);
  v_actual_amount := p_nominal_amount - v_discount_amount;

  insert into payments (
    enrollment_id, payment_date, amount, payment_type, payment_method,
    reference, notes, cash_discount_percent, cash_discount_amount, created_by
  )
  values (
    p_enrollment_id, p_payment_date, v_actual_amount, p_payment_type, 'efectivo',
    p_reference, p_notes, p_discount_percent, v_discount_amount, auth.uid()
  )
  returning * into v_payment;

  update enrollments
  set final_price = final_price - v_discount_amount, updated_at = now()
  where id = p_enrollment_id;

  return v_payment;
end;
$$;

grant execute on function register_cash_discount_payment(uuid, date, numeric, numeric, payment_type, text, text) to authenticated;

-- Anular un pago con descuento en efectivo debe devolver ese descuento al precio final
-- (si no, el saldo quedaría permanentemente más bajo aunque el pago que lo generó ya no
-- cuente). Se centraliza acá para que CUALQUIER anulación (tenga o no descuento) pase por
-- el mismo camino atómico.
create or replace function void_payment(p_payment_id uuid, p_reason text, p_voided_by uuid)
returns payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment payments;
begin
  update payments
  set status = 'anulado', voided_at = now(), voided_by = p_voided_by, void_reason = p_reason
  where id = p_payment_id and status = 'valido'
  returning * into v_payment;

  if v_payment.id is null then
    raise exception 'Pago no encontrado o ya estaba anulado';
  end if;

  if v_payment.cash_discount_amount is not null and v_payment.cash_discount_amount > 0 then
    update enrollments
    set final_price = final_price + v_payment.cash_discount_amount, updated_at = now()
    where id = v_payment.enrollment_id;
  end if;

  return v_payment;
end;
$$;

grant execute on function void_payment(uuid, text, uuid) to authenticated;
