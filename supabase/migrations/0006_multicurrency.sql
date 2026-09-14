-- Soporte de USD: los cursos se cotizan en USD, pero se cobra en pesos o en dólares
-- según la alumna. Los campos "canónicos" (enrollments.original_price/final_price y
-- payments.amount) SIEMPRE quedan en pesos y son los que usan todas las vistas y
-- cálculos existentes (comisiones, objetivos, facturación) — así ese motor no cambia
-- en nada. Los campos nuevos son solo metadata de referencia: en qué moneda se pactó/
-- pagó realmente y a qué cotización se convirtió, para que quede trazable.

-- El precio "de lista" de una edición también puede estar cotizado en USD (es lo más
-- común en este negocio) — igual criterio: list_price queda siempre en pesos (lo que
-- usan cupos/reportes), list_price_usd + fx_rate son la referencia en dólares.
alter table course_editions
  add column currency text not null default 'ars' check (currency in ('ars', 'usd')),
  add column list_price_usd numeric(14,2),
  add column fx_rate numeric(10,2);

alter table enrollments
  add column currency text not null default 'ars' check (currency in ('ars', 'usd')),
  add column original_price_usd numeric(14,2),
  add column final_price_usd numeric(14,2),
  add column fx_rate numeric(10,2);

alter table payments
  add column currency text not null default 'ars' check (currency in ('ars', 'usd')),
  add column original_amount_usd numeric(14,2),
  add column fx_rate numeric(10,2);

comment on column course_editions.list_price_usd is 'Precio de lista en USD si el curso se cotiza en dólares (referencia, no se usa en cálculos)';
comment on column course_editions.fx_rate is 'Cotización oficial (venta) usada para convertir a pesos al crear/editar la edición';
comment on column enrollments.original_price_usd is 'Precio de lista en USD si el curso se cotizó en dólares (referencia, no se usa en cálculos)';
comment on column enrollments.final_price_usd is 'Precio final en USD (referencia, no se usa en cálculos)';
comment on column enrollments.fx_rate is 'Cotización oficial (venta) usada para convertir a pesos al momento de crear la inscripción';
comment on column payments.original_amount_usd is 'Monto que efectivamente se pagó en USD, si el pago fue en dólares (referencia, no se usa en cálculos)';
comment on column payments.fx_rate is 'Cotización oficial (venta) usada para convertir este pago a pesos el día que se cobró';
