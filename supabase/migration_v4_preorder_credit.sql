-- ============================================================
--  Migration v4 — run ONCE in the Supabase SQL Editor.
--  Pre-orders don't charge credit until their day arrives:
--  the balance only counts orders dated today-or-earlier (Bangkok).
-- ============================================================

drop view if exists balances;
create view balances as
select
  p.id                                          as person_id,
  p.name,
  p.category,
  p.sort_order,
  coalesce(c.topups, 0)                         as topups,
  coalesce(o.spent, 0)                          as spent,
  coalesce(c.topups, 0) - coalesce(o.spent, 0)  as balance
from people p
left join (
  select person_id, sum(amount) as topups from credits group by person_id
) c on c.person_id = p.id
left join (
  select person_id, sum(price) as spent from orders
  where order_date <= (now() at time zone 'Asia/Bangkok')::date
  group by person_id
) o on o.person_id = p.id
where p.active;
grant select on balances to anon, authenticated;
