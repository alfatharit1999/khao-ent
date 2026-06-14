-- ============================================================
--  ENT Lunch app — seed data (run AFTER schema.sql)
--  Imports the people list, the current week's board (8–12 มิ.ย.),
--  the professor's remaining deposit, and the central-fund balance
--  from the Google Sheet. Re-running clears and re-seeds.
-- ============================================================

truncate orders, credits, fund_entries, settings, people restart identity cascade;

-- ---- People -------------------------------------------------
insert into people (name, kind, sort_order, note) values
  ('นิว',          'resident', 10, null),
  ('ไอเดีย',        'resident', 20, 'อาจารย์ไม่กินเผ็ด'),
  ('ฟ้า',          'resident', 30, 'ไม่กินปลาหมึก'),
  ('เพชร',         'resident', 40, null),
  ('กล้วยไม้',      'resident', 50, null),
  ('แว็ป',         'resident', 60, null),
  ('โบ',           'resident', 70, null),
  ('พีส',          'resident', 80, null),
  ('ก้อง',         'resident', 90, null),
  ('ชมพู่',         'resident', 100, null),
  ('ซีน',          'resident', 110, null),
  ('เมาส์',         'resident', 120, null),
  ('พี่ขวัญ',       'senior', 200, null),
  ('พี่ปีเตอร์',     'senior', 210, null),
  ('พี่เบตตี้',      'senior', 220, null),
  ('พี่ป๋วย',       'senior', 230, null),
  ('พี่เบนซ์',      'senior', 240, null),
  ('พี่เจมส์ R3',   'senior', 250, null),
  ('อ.ไพบูลย์',     'professor', 900, 'OR เฉพาะวันที่มีเคส / อย่าเอาเมนูเดิมๆ / เขียนชื่ออ.หน้ากล่อง');

-- ---- Settings ----------------------------------------------
insert into settings (key, value) values
  ('week_label',     '8–12 มิ.ย. 69'),
  ('or_note',        'OR = ส่งตึกสยามมินทร์ชั้น 4 วางในห้องติดกระจก OR (ไม่วางไว้ข้างนอก)'),
  ('opd_note',       'OPD ENT ห้อง treatment ชั้น 5'),
  ('professor_schedule',
                     'จ.OR / อ.OR / พ. 1–15 Laryngo,16–30 OR / พฤ.OPD / ศ. ไม่ต้อง — OR เฉพาะวันมีเคส');

-- ---- Professor remaining deposit (carried over from sheet) ---
-- ฿20,000 yearly deposit minus food charged through 5 มิ.ย.
-- Approximate — confirm/adjust in the Admin screen.
insert into credits (person_id, date, type, amount, note)
select id, '2026-06-07', 'topup', 11194.00,
       'ยอดเงินฝากคงเหลือยกมาจากชีท (ประมาณการ ปรับได้ในแอดมิน)'
from people where name = 'อ.ไพบูลย์';

-- ---- Central fund opening balance (carried over from sheet) --
-- The full year's ledger stays in the Google Sheet for reference;
-- we carry the current balance forward as one opening entry.
insert into fund_entries (date, description, income, expense, note) values
  ('2026-06-12', 'ยอดยกมาจาก Google Sheet (กองกลาง)', 13428.24, 0,
   'รายรับรวม 28,948.99 − รายจ่ายรวม 15,520.75');

-- ---- Current week board (8–12 มิ.ย. 2026) -------------------
insert into orders (person_id, order_date, location, menu_item, price)
select p.id, v.d::date, v.loc, v.menu, v.price
from (values
  ('นิว',       '2026-06-11', 'OR',  'กะเพราหมูสับ ไข่ดาวไม่สุก', 60),
  ('ไอเดีย',     '2026-06-08', 'OR',  'ข้าวไข่ข้นหมูสับ+ซอสมะเขือเทศ', 50),
  ('ฟ้า',       '2026-06-08', 'OR',  'ข้าวผัด+หมูทอด', 65),
  ('ฟ้า',       '2026-06-10', 'OR',  'กะเพราหมูสับ(เผ็ดน้อย) ไข่ดาวไม่สุก', 60),
  ('เพชร',      '2026-06-08', 'OR',  'ข้าวไข่ข้นหมูสับ+ซอสมะเขือเทศ', 50),
  ('เพชร',      '2026-06-11', 'OR',  'ข้าวไข่เจียวหมูสับ 1 ฟอง + ซอสมะเขือ', 40),
  ('กล้วยไม้',   '2026-06-11', 'OR',  'ข้าวไข่ข้น', 50),
  ('แว็ป',      '2026-06-08', 'OPD', 'ข้าวผัด+หมูทอด', 65),
  ('แว็ป',      '2026-06-10', 'OR',  'ข้าวผัด+หมูทอด', 65),
  ('แว็ป',      '2026-06-11', 'OPD', 'ข้าวผัด+หมูทอด', 65),
  ('แว็ป',      '2026-06-12', 'OR',  'ข้าวผัดหมู+หมูทอด', 65),
  ('โบ',        '2026-06-10', 'OR',  'ข้าวไก่ทอดคั่วพริกเกลือ ไข่ดาว', 65),
  ('ก้อง',      '2026-06-11', 'OR',  'ข้าวผัดแหนมผัดไข่ + ไก่ต้ม + น้ำจิ้มซีฟู้ด', 100),
  ('ชมพู่',      '2026-06-08', 'OR',  'ข้าวไข่ข้นกุ้ง', 65),
  ('ชมพู่',      '2026-06-11', 'OPD', 'แหนมผัดไข่', 60),
  ('ชมพู่',      '2026-06-12', 'OR',  'ข้าวผัดไข่+หมูทอด', 65),
  ('ซีน',       '2026-06-10', 'OR',  'กะเพราหมูสับ ไข่ดาวไม่สุก', 60),
  ('ซีน',       '2026-06-11', 'OPD', 'กะเพราหมูสับ ไข่ดาวไม่สุก', 60),
  ('ซีน',       '2026-06-12', 'OR',  'กะเพราหมูสับ ไข่ดาวไม่สุก', 60),
  ('เมาส์',      '2026-06-08', 'OR',  'ข้าวไข่ข้นกุ้ง', 65),
  ('เมาส์',      '2026-06-11', 'OR',  'แหนมผัดไข่', 50),
  ('พี่ขวัญ',     '2026-06-10', 'OR',  'กะเพราไก่ชิ้น (เผ็ดน้อย) + ไข่เจียว', 65),
  ('อ.ไพบูลย์',   '2026-06-08', 'OR',  'ข้าวไข่ข้นกุ้ง', 65),
  ('อ.ไพบูลย์',   '2026-06-10', null,  'คะน้าหมูชิ้น', 50),
  ('อ.ไพบูลย์',   '2026-06-11', 'OPD', 'ข้าวหมูกรอบคั่วพริกเกลือ ไข่ดาว', 85)
) as v(name, d, loc, menu, price)
join people p on p.name = v.name;
