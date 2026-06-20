-- Migration v9: allow residents to insert topup credits directly
-- Credit is now added immediately on submit; topup_requests is just an audit log.
create policy "write topup" on credits
  for insert with check (type = 'topup' and amount > 0);
