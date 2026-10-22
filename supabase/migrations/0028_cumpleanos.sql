-- Próximos cumpleaños de alumnas/clientas (tabla students, columna birth_date).
-- Devuelve a quienes cumplen años hoy o en los próximos p_days días, con "hoy" en hora de
-- Argentina. Un 29/02 festeja el 28/02 en los años no bisiestos (comportamiento de Postgres
-- al sumar años). Corre con los permisos de quien llama (RLS normal de students).

create or replace function upcoming_birthdays(p_days int default 7)
returns table (
  id uuid,
  first_name text,
  last_name text,
  birth_date date,
  next_birthday date,
  days_until int,
  turning_age int
)
language sql
stable
security invoker
set search_path = public
as $$
  with today as (
    select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d
  ),
  calc as (
    select
      s.id, s.first_name, s.last_name, s.birth_date,
      date_part('year', age(t.d, s.birth_date))::int as years_done,
      t.d as today
    from students s, today t
    where s.birth_date is not null
  ),
  nxt as (
    select
      c.*,
      case
        when (c.birth_date + make_interval(years => c.years_done))::date < c.today
          then (c.birth_date + make_interval(years => c.years_done + 1))::date
        else (c.birth_date + make_interval(years => c.years_done))::date
      end as next_birthday
    from calc c
  )
  select
    n.id, n.first_name, n.last_name, n.birth_date, n.next_birthday,
    (n.next_birthday - n.today)::int as days_until,
    date_part('year', age(n.next_birthday, n.birth_date))::int as turning_age
  from nxt n
  where (n.next_birthday - n.today) between 0 and greatest(p_days, 0)
  order by n.next_birthday, n.last_name, n.first_name;
$$;

grant execute on function upcoming_birthdays(int) to authenticated;
