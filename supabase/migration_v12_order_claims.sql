-- Migration v12: order claims (the orderer claims back what they fronted).
-- Flow: orderer identifies (draft) -> fills prices -> submits (pending, credit
-- rolls immediately) -> admin approves or reverts. One claim per day.

create table if not exists order_claims (
  id           uuid primary key default gen_random_uuid(),
  date         date not null unique,
  orderer_id   uuid not null references people(id) on delete cascade,
  total_paid   numeric(10,2),
  rolled_amount numeric(10,2),
  status       text not null default 'draft'
               check (status in ('draft', 'pending', 'approved')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index order_claims_status_idx on order_claims(status);

alter table order_claims enable row level security;
-- Trust-based app: claim actions run with the anon key (admin only by social
-- convention / the PIN-gated admin page for approve/revert).
create policy "read order_claims"   on order_claims for select using (true);
create policy "insert order_claims" on order_claims for insert with check (true);
create policy "update order_claims" on order_claims for update using (true) with check (true);
create policy "delete order_claims" on order_claims for delete using (true);
