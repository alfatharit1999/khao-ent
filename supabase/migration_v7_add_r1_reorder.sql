-- ============================================================
--  Migration v7: add R1 residents + fix sort_order
--
--  R1 people were already inserted via API (sort_order 10-120).
--  R2 and R3 were already at 10-120 and 200-310 respectively,
--  so they interleave with R1. This migration shifts them apart.
--
--  New ranges:
--    R1:        10 – 120   (unchanged)
--    R2:     1010 – 1120   (was 10-120, +1000)
--    R3:     2200 – 2310   (was 200-310, +2000)
--    professor:  9000      (was 900)
-- ============================================================

update people set sort_order = sort_order + 1000 where category = 'R2';
update people set sort_order = sort_order + 2000 where category = 'R3';
update people set sort_order = 9000             where category = 'professor';
