-- ============================================================================
-- 0029_facturacion.sql · Facturación electrónica (ARCA) de Academia con el CUIT de Mica.
--
-- fiscal_config: datos fiscales de quien factura (una sola fila) y el ambiente.
-- facturas:      cada comprobante emitido (Factura A/B y notas de crédito). Son
--                INMUTABLES: no hay UPDATE ni DELETE; se corrigen con una nota de crédito.
-- factura_pagos: qué cobros (payments) cubre cada factura, para saber qué falta facturar.
-- arca_ta:       ticket de acceso de ARCA (~12 horas); se guarda porque ARCA no deja
--                pedir otro mientras el anterior sirve.
--
-- Se emite desde la función del servidor api/facturar.ts con la sesión de quien factura;
-- el certificado y la clave privada NO están acá: van como variables de entorno del servidor.
-- ============================================================================

create table if not exists fiscal_config (
  id                  boolean primary key default true check (id),
  cuit                text not null,
  razon_social        text not null,
  domicilio           text not null,
  inicio_actividades  date,
  iibb                text,
  condicion_iva       text not null default 'Responsable Inscripto',
  punto_venta         integer not null,
  ambiente            text not null default 'produccion' check (ambiente in ('homologacion', 'produccion')),
  updated_at          timestamptz not null default now()
);

create table if not exists facturas (
  id                  uuid primary key default gen_random_uuid(),
  factura_asociada_id uuid references facturas(id),
  ambiente            text not null check (ambiente in ('homologacion', 'produccion')),
  -- Código ARCA: 1 = Factura A, 6 = Factura B, 3 = Nota de crédito A, 8 = Nota de crédito B.
  cbte_tipo           smallint not null,
  punto_venta         integer not null,
  numero              bigint not null,
  fecha               date not null,
  cae                 text not null,
  cae_vto             date not null,
  -- { doc_tipo, doc_nro, nombre, condicion_iva_id, domicilio }
  receptor            jsonb not null,
  -- [{ nombre, cantidad, precio_unit_cents, subtotal_cents }] (precios con IVA incluido)
  items               jsonb not null,
  neto_cents          bigint not null,
  iva_cents           bigint not null,
  total_cents         bigint not null,
  observaciones       text,
  created_by          uuid default auth.uid() references auth.users(id),
  created_at          timestamptz not null default now(),
  unique (ambiente, punto_venta, cbte_tipo, numero)
);
create index if not exists facturas_created_idx on facturas(created_at desc);
create index if not exists facturas_asociada_idx on facturas(factura_asociada_id);

create table if not exists factura_pagos (
  id          uuid primary key default gen_random_uuid(),
  factura_id  uuid not null references facturas(id) on delete cascade,
  payment_id  uuid not null references payments(id) on delete cascade
);
create index if not exists factura_pagos_pago_idx on factura_pagos(payment_id);
create index if not exists factura_pagos_factura_idx on factura_pagos(factura_id);

create table if not exists arca_ta (
  ambiente    text not null,
  servicio    text not null,
  token       text not null,
  sign        text not null,
  expira      timestamptz not null,
  primary key (ambiente, servicio)
);

alter table fiscal_config enable row level security;
alter table facturas enable row level security;
alter table factura_pagos enable row level security;
alter table arca_ta enable row level security;

-- Datos fiscales: los ve cualquier perfil activo; solo admin los cambia.
drop policy if exists fiscal_config_select on fiscal_config;
create policy fiscal_config_select on fiscal_config for select using (is_active_profile());
drop policy if exists fiscal_config_admin_write on fiscal_config;
create policy fiscal_config_admin_write on fiscal_config
  for all using (is_admin()) with check (is_admin());

-- Facturas: cualquier perfil activo las ve y las crea; nadie las modifica ni las borra.
drop policy if exists facturas_select on facturas;
create policy facturas_select on facturas for select using (is_active_profile());
drop policy if exists facturas_insert on facturas;
create policy facturas_insert on facturas for insert with check (is_active_profile());

drop policy if exists factura_pagos_select on factura_pagos;
create policy factura_pagos_select on factura_pagos for select using (is_active_profile());
drop policy if exists factura_pagos_insert on factura_pagos;
create policy factura_pagos_insert on factura_pagos for insert with check (is_active_profile());

drop policy if exists arca_ta_all on arca_ta;
create policy arca_ta_all on arca_ta
  for all using (is_active_profile()) with check (is_active_profile());

-- Datos fiscales de Mica (Responsable Inscripta, punto de venta 5, producción).
-- El inicio de actividades y Ingresos Brutos se completan desde Facturación > Datos fiscales (admin):
-- salen en el encabezado de la factura.
insert into fiscal_config (cuit, razon_social, domicilio, inicio_actividades, iibb, condicion_iva, punto_venta, ambiente)
values ('27374796351', 'DATRI GOMEZ DAIANA MICAELA', 'Agustin M. Garcia 5971 Dpto:201 - Tigre, Buenos Aires', null, null,
        'Responsable Inscripto', 5, 'produccion')
on conflict (id) do nothing;
