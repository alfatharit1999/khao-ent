-- ============================================================
--  ENT Lunch app — seed data (run AFTER schema.sql)
--  FRESH / ZERO start for a brand-new system:
--    • 12 residents (R2 + Thai nickname) + the professor
--    • no balances, no deposits, no orders, no fund money
--  Residents pick their own food each day; no pick = no order.
--  Re-running clears and re-seeds.
-- ============================================================

truncate orders, credits, fund_entries, settings, people restart identity cascade;

-- ---- People (everything starts at ฿0) -----------------------
insert into people (name, kind, sort_order, note) values
  ('R2 นิว',       'resident', 10,  null),
  ('R2 ไอเดีย',     'resident', 20,  null),
  ('R2 ฟ้า',       'resident', 30,  null),
  ('R2 เพชร',      'resident', 40,  null),
  ('R2 กล้วยไม้',   'resident', 50,  null),
  ('R2 แว็ป',      'resident', 60,  null),
  ('R2 โบ',        'resident', 70,  null),
  ('R2 พีส',       'resident', 80,  null),
  ('R2 ก้อง',      'resident', 90,  null),
  ('R2 ชมพู่',      'resident', 100, null),
  ('R2 ซีน',       'resident', 110, null),
  ('R2 เมาส์',      'resident', 120, null),
  ('อ.ไพบูลย์',     'professor', 900, 'ไม่กินเผ็ด / ไม่กินปลาหมึก — เมนูอัตโนมัติ (รอกำหนดเมนู)');

-- ---- Reference settings (delivery + professor schedule) ------
-- Not money — just operational notes used by the order-list screen.
insert into settings (key, value) values
  ('or_note',  'OR = ส่งตึกสยามมินทร์ชั้น 4 วางในห้องติดกระจก OR (ไม่วางไว้ข้างนอก)'),
  ('opd_note', 'OPD ENT ห้อง treatment ชั้น 5'),
  ('professor_schedule',
              'จ.OR / อ.OR / พ. 1–15 Laryngo,16–30 OR / พฤ.OPD / ศ. ไม่ต้อง — OR เฉพาะวันมีเคส');

-- No credits, no orders, no fund entries: every balance is ฿0.
