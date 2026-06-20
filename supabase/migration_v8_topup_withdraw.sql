-- Migration v8: self-service top-up requests + resident-initiated withdrawals

-- Top-up request queue — resident submits, admin approves and adds credit.
create table if not exists topup_requests (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references people(id) on delete cascade,
  amount      numeric(10,2) not null check (amount > 0),
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected')),
  note        text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index topup_requests_person_idx on topup_requests(person_id);
create index topup_requests_status_idx on topup_requests(status);

alter table topup_requests enable row level security;
create policy "read topup_requests"   on topup_requests for select using (true);
create policy "insert topup_requests" on topup_requests for insert with check (true);
-- UPDATE (approve/reject) only via service-role key in admin API routes.

-- Allow residents to self-initiate a withdrawal: inserts a negative settlement
-- credit that immediately reduces their balance.
create policy "write settlement" on credits
  for insert with check (type = 'settlement');
