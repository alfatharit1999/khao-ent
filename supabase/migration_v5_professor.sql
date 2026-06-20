-- ============================================================
--  Migration v5 — run ONCE in the Supabase SQL Editor.
--  Professor (อ.ไพบูลย์) automation support:
--    • orders.location can be 'BOTH' (two boxes → charged ×2)
--    • new day_state table: confirm prof status + seal before copying
--  Also re-applies v4 (charge only today-or-earlier) so this is the
--  single migration you need even if v4 was skipped.
-- ============================================================

-- 1) Allow the professor's "both locations" order.
alter table orders drop constraint if exists orders_location_check;
alter table orders add constraint orders_location_check
  check (location in ('OR', 'OPD', 'BOTH'));

-- 2) Per-day status / seal (publicly writable — set by the order person).
create table if not exists day_state (
  date        date primary key,
  sealed      boolean not null default false,
  prof_status text check (prof_status in ('ordering', 'skip')),
  updated_at  timestamptz not null default now()
);
alter table day_state enable row level security;
drop policy if exists "read day_state" on day_state;
drop policy if exists "write day_state insert" on day_state;
drop policy if exists "write day_state update" on day_state;
create policy "read day_state"  on day_state for select using (true);
create policy "write day_state insert" on day_state for insert with check (true);
create policy "write day_state update" on day_state for update using (true) with check (true);

-- 3) (v4) Balance only counts orders dated today-or-earlier (Bangkok).
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
