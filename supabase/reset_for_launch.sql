-- ============================================================
--  RESET FOR LAUNCH — run ONCE in the Supabase SQL Editor.
--  Wipes ALL test transactions so every balance starts at ฿0.
--  KEEPS: people (R1/R2/R3/F/professor) and settings.
--  The professor menu lives in code, so it is unaffected.
-- ============================================================

-- Personal data: orders, credits, claims, top-up requests, day seals.
truncate orders, credits, order_claims, topup_requests, day_state
  restart identity cascade;

-- Central fund (กองกลาง). Comment this line out if you'd rather keep
-- the existing fund ledger instead of starting it empty.
truncate fund_entries restart identity cascade;
