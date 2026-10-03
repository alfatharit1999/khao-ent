-- Keep the backup sheet's reference note in sync with the new schedule.
-- This changes only the professor schedule setting; orders and credits remain intact.
update settings
set value = 'จ.OR / อ.OR / พ.OPD / พฤ.OPD / ศ. ไม่ต้อง — OR เฉพาะวันมีเคส'
where key = 'professor_schedule';
