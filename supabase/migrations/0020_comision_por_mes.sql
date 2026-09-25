-- La comisión vigente se define por MES, no por día exacto: si se carga una tasa el 12/09,
-- rige para TODO septiembre (incluidos pagos de días anteriores del mismo mes, cargados
-- retroactivamente), no solo desde el 12 en adelante. Antes comparaba "effective_from <=
-- payment_date" a nivel de día, así que un pago fechado antes del día en que se cargó la
-- tasa (aunque fuera el mismo mes) quedaba sin comisión — eso es lo que le pasó al pago del
-- 05/09 con la tasa cargada el 12/09.

create or replace view v_payment_commission as
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
  where date_trunc('month', effective_from) <= date_trunc('month', p.payment_date)
  order by effective_from desc
  limit 1
) crh on true;
