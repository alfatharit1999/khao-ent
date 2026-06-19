-- ============================================================
--  Migration v3 — run ONCE in the Supabase SQL Editor.
--  Lets anyone add a new person (visiting professor/fellow, etc.)
--  without the admin PIN. Renaming/hiding/deleting stays admin-only.
-- ============================================================

drop policy if exists "write people insert" on people;
create policy "write people insert" on people for insert with check (true);
