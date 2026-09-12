-- Fix: "Vendido" en Gestión > Facturación por modalidad salía inflado cuando una
-- inscripción tenía más de un pago. Causa: v_course_type_summary sumaba
-- enrollments.final_price en la misma consulta que hacía join con payments — un join
-- 1-a-muchos que duplica final_price una vez por cada pago de esa inscripción
-- ("fan-out"). Se separa el cálculo de "vendido" (por inscripción) del de "cobrado"
-- (por pago) en dos CTEs independientes.

drop view if exists v_course_type_summary;

create view v_course_type_summary as
with enrollment_agg as (
  select
    ed.course_type_id,
    ed.id as edition_id,
    en.id as enrollment_id,
    en.final_price,
    en.status
  from course_editions ed
  left join enrollments en on en.course_edition_id = ed.id
),
sold_agg as (
  select
    course_type_id,
    count(distinct edition_id) as edition_count,
    count(distinct enrollment_id) filter (where status is not null and status not in ('cancelada')) as enrollment_count,
    coalesce(sum(final_price) filter (where status not in ('cancelada')), 0) as total_sold
  from enrollment_agg
  group by course_type_id
),
collected_agg as (
  select
    ed.course_type_id,
    coalesce(sum(p.amount) filter (where p.status = 'valido'), 0) as total_collected
  from course_editions ed
  join enrollments en on en.course_edition_id = ed.id
  join payments p on p.enrollment_id = en.id
  group by ed.course_type_id
)
select
  ct.id as course_type_id,
  ct.name,
  coalesce(sold_agg.edition_count, 0) as edition_count,
  coalesce(sold_agg.enrollment_count, 0) as enrollment_count,
  coalesce(sold_agg.total_sold, 0) as total_sold,
  coalesce(collected_agg.total_collected, 0) as total_collected
from course_types ct
left join sold_agg on sold_agg.course_type_id = ct.id
left join collected_agg on collected_agg.course_type_id = ct.id;
