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
insert into people (name, category, sort_order, note) values
  ('R2 นิว',       'R2', 10,  null),
  ('R2 ไอเดีย',     'R2', 20,  null),
  ('R2 ฟ้า',       'R2', 30,  null),
  ('R2 เพชร',      'R2', 40,  null),
  ('R2 กล้วยไม้',   'R2', 50,  null),
  ('R2 แว็ป',      'R2', 60,  null),
  ('R2 โบ',        'R2', 70,  null),
  ('R2 พีส',       'R2', 80,  null),
  ('R2 ก้อง',      'R2', 90,  null),
  ('R2 ชมพู่',      'R2', 100, null),
  ('R2 ซีน',       'R2', 110, null),
  ('R2 เมาส์',      'R2', 120, null),
  ('R3 ขวัญ',      'R3', 200, null),
  ('R3 แพตตี้',     'R3', 210, null),
  ('R3 ใหม่',      'R3', 220, null),
  ('R3 อัฐ',       'R3', 230, null),
  ('R3 ปิง',       'R3', 240, null),
  ('R3 สรร',       'R3', 250, null),
  ('R3 อิน',       'R3', 260, null),
  ('R3 หนาว',      'R3', 270, null),
  ('R3 ปีเตอร์',    'R3', 280, null),
  ('R3 เบตตี้',     'R3', 290, null),
  ('R3 ป๋วย',      'R3', 300, null),
  ('R3 เบนซ์',     'R3', 310, null),
  ('อ.ไพบูลย์',     'professor', 900, 'ไม่กินเผ็ด / ไม่กินปลาหมึก — เมนูอัตโนมัติ (รอกำหนดเมนู)');

-- ---- Reference settings (delivery + professor schedule) ------
-- Not money — just operational notes used by the order-list screen.
insert into settings (key, value) values
  ('or_note',  'OR = ส่งตึกสยามมินทร์ชั้น 4 วางในห้องติดกระจก OR (ไม่วางไว้ข้างนอก)'),
  ('opd_note', 'OPD ENT ห้อง treatment ชั้น 5'),
  ('professor_schedule',
              'จ.OR / อ.OR / พ. 1–15 Laryngo,16–30 OR / พฤ.OPD / ศ. ไม่ต้อง — OR เฉพาะวันมีเคส');

-- No credits, no orders, no fund entries: every balance is ฿0.
