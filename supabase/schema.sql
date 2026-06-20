-- ============================================================
--  ENT Lunch app — database schema
--  Paste this whole file into the Supabase SQL Editor and run.
--  Safe to re-run (drops + recreates).
-- ============================================================

drop view if exists balances;
drop table if exists orders cascade;
drop table if exists credits cascade;
drop table if exists fund_entries cascade;
drop table if exists settings cascade;
drop table if exists people cascade;

-- People: residents (R1–R3), fellows (F1–F3), and the professor.
create table people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'R2'
              check (category in ('R1', 'R2', 'R3', 'F1', 'F2', 'F3', 'professor')),
  sort_order  int  not null default 500,
  active      boolean not null default true,
  note        text
);

-- Daily order board: one row per person per day.
create table orders (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references people(id) on delete cascade,
  order_date  date not null,
  location    text check (location in ('OR', 'OPD')),
  menu_item   text,
  price       numeric(10, 2) not null default 0,
  fronted     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (person_id, order_date)
);
create index orders_date_idx on orders(order_date);

-- Credit ledger: anything that moves a person's balance UP or down,
-- except food orders (those are tracked in `orders`).
--   topup        : person paid money in            (+)
--   front_credit : person fronted cash at the room  (+)
--   adjustment   : manual correction by admin       (+/-)
--   settlement   : admin paid the person back in cash(-)
create table credits (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references people(id) on delete cascade,
  date        date not null default current_date,
  type        text not null check (type in ('topup', 'front_credit', 'adjustment', 'settlement')),
  amount      numeric(10, 2) not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index credits_person_idx on credits(person_id);

-- Central fund (กองกลาง) ledger.
create table fund_entries (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  description text,
  income      numeric(10, 2) not null default 0,
  expense     numeric(10, 2) not null default 0,
  recipient   text,
  account     text,
  note        text,
  created_at  timestamptz not null default now()
);
create index fund_date_idx on fund_entries(date);

-- Free-form settings (delivery notes, professor schedule …).
create table settings (
  key   text primary key,
  value text
);

-- Per-person balance = sum(credits) − sum(CHARGED order prices).
-- Only orders dated today-or-earlier (Asia/Bangkok) are charged; future
-- pre-orders don't touch the balance until their day arrives.
-- Positive = credit remaining, negative = debt.
create view balances as
select
  p.id                                                as person_id,
  p.name,
  p.category,
  p.sort_order,
  coalesce(c.topups, 0)                               as topups,
  coalesce(o.spent, 0)                                as spent,
  coalesce(c.topups, 0) - coalesce(o.spent, 0)        as balance
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

-- ============================================================
--  Row Level Security
--  Public (anon key) can READ everything, add/edit ORDERS, and
--  add roll-over FRONT-CREDITS (the person fronting cash isn't the
--  admin). All other money mutations (top-ups, adjustments, fund,
--  people) go through PIN-gated server routes using the
--  service-role key, which bypasses RLS.
-- ============================================================
alter table people       enable row level security;
alter table orders       enable row level security;
alter table credits      enable row level security;
alter table fund_entries enable row level security;
alter table settings     enable row level security;

-- Read access for everyone.
create policy "read people"   on people       for select using (true);
-- Anyone can add a new person (e.g. a visiting professor/fellow ordering in).
-- Renaming / hiding / deleting people stays admin-only (service key).
create policy "write people insert" on people for insert with check (true);
create policy "read orders"   on orders       for select using (true);
create policy "read credits"  on credits      for select using (true);
create policy "read fund"     on fund_entries for select using (true);
create policy "read settings" on settings     for select using (true);

-- Anyone can place / change / remove an order (trusted group, name-pick).
create policy "write orders insert" on orders for insert with check (true);
create policy "write orders update" on orders for update using (true) with check (true);
create policy "write orders delete" on orders for delete using (true);

-- Anyone can record a roll-over (front credit) — but ONLY that type.
-- Top-ups / adjustments / settlements remain admin-only (service key).
create policy "write front credit" on credits for insert with check (type = 'front_credit');

-- Expose the balances view to the public API.
grant select on balances to anon, authenticated;

-- Live updates: let the daily board refresh in realtime for everyone.
do $$
begin
  begin
    alter publication supabase_realtime add table orders;
  exception when duplicate_object then
    null; -- already in the publication
  end;
end $$;
