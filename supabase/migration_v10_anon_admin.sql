-- Migration v10: trust-based admin actions without a server PIN.
-- The /admin page is gated by a client-side PIN, but the actual balance
-- edits and top-up-request actions write directly with the anon key.
-- (Resident-only app; the group trusts each other.)

-- Manual balance adjustments (+/-) from the admin balance editor.
create policy "write adjustment" on credits
  for insert with check (type = 'adjustment');

-- Mark a top-up log as checked / delete a bad log entry.
create policy "update topup_requests" on topup_requests
  for update using (true) with check (true);
create policy "delete topup_requests" on topup_requests
  for delete using (true);
