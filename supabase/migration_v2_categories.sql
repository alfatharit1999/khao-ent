-- ============================================================
--  Migration v2 — run ONCE in the Supabase SQL Editor on an
--  existing database. Non-destructive: keeps your people & data.
--    1) roll-over (front credit) no longer needs the admin PIN
--    2) people gain a category: R1/R2/R3/F1/F2/F3/professor
-- ============================================================

-- 1) Public roll-over: anyone can add a front-credit (only that type).
drop policy if exists "write front credit" on credits;
create policy "write front credit" on credits
  for insert with check (type = 'front_credit');

-- 2) Categories replace the old kind column.
alter table people add column if not exists category text;

update people
set category = case
  when kind = 'professor' then 'professor'
  else 'R2'                       -- current residents become R2
end
where category is null;

alter table people alter column category set default 'R2';
alter table people alter column category set not null;

do $$
begin
  alter table people add constraint people_category_check
    check (category in ('R1', 'R2', 'R3', 'F1', 'F2', 'F3', 'professor'));
exception when duplicate_object then null;
end $$;

-- Rebuild the balances view to expose category instead of kind.
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
  select person_id, sum(price) as spent from orders group by person_id
) o on o.person_id = p.id
where p.active;
grant select on balances to anon, authenticated;

-- Finally drop the obsolete kind column.
alter table people drop column if exists kind;
