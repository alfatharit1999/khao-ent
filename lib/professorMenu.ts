// อ.ไพบูลย์'s rotating lunch pool (no spicy, no squid) + delivery/box rules.

export type ProfMenuItem = {
  id: number;
  th: string;
  en: string;
  price: number;
  approx?: boolean; // price marked "~" in the source list
};

export const PROFESSOR_MENU: ProfMenuItem[] = [
  { id: 1, th: "ข้าวผัดหมู", en: "Pork fried rice", price: 50 },
  { id: 2, th: "ข้าวผัดไก่", en: "Chicken fried rice", price: 50 },
  { id: 3, th: "ข้าวผัดรถไฟ(โบราณ) หมู", en: "Old-style pork fried rice", price: 55 },
  { id: 4, th: "ข้าวผัดกุ้ง", en: "Shrimp fried rice", price: 60 },
  { id: 5, th: "ข้าวผัดกุนเชียง ไม่ใส่ผัก", en: "Chinese-sausage fried rice, no veg", price: 55 },
  { id: 6, th: "ข้าวผัดกระเทียมหมู", en: "Garlic pork fried rice", price: 50 },
  { id: 7, th: "ข้าวผัดเนื้อ", en: "Beef fried rice", price: 60 },
  { id: 8, th: "ข้าวกระเทียมหมูกรอบ + ไข่ดาว", en: "Garlic crispy-pork + fried egg", price: 70, approx: true },
  { id: 9, th: "ข้าวคั่วพริกเกลือหมูกรอบ + ไข่ดาว", en: "Salt-&-pepper crispy pork + fried egg", price: 85, approx: true },
  { id: 10, th: "ข้าวคั่วพริกเกลือไก่ทอด + ไข่ดาว", en: "Salt-&-pepper fried chicken + fried egg", price: 70, approx: true },
  { id: 11, th: "ข้าวผัดไข่เค็มหมู", en: "Salted-egg pork over rice", price: 60 },
  { id: 12, th: "ข้าวผัดไข่เค็มกุ้ง", en: "Salted-egg shrimp over rice", price: 70 },
  { id: 13, th: "ข้าวคะน้าหมูกรอบ", en: "Stir-fried kale + crispy pork", price: 60, approx: true },
  { id: 14, th: "ข้าวคะน้าหมูชิ้น", en: "Stir-fried kale + sliced pork", price: 50 },
  { id: 15, th: "ข้าวไข่เจียวหมูสับ", en: "Pork omelette over rice", price: 50 },
];

export const PROFESSOR_RESTRICTIONS = "ไม่กินเผ็ด / ไม่ใส่ปลาหมึก";
export const PROFESSOR_BOX_NOTE = 'เขียนชื่อ "อ.ไพบูลย์" หน้ากล่อง';
export const OR_DELIVERY = "OR = ตึกสยามมินทร์ ชั้น 4 วางในห้องติดกระจก (ไม่วางข้างนอก)";
export const OPD_DELIVERY = "OPD = ENT ห้อง treatment ชั้น 5";

/** Random menu item, optionally avoiding the one used last time. */
export function randomProfMenu(excludeTh?: string): ProfMenuItem {
  const pool = excludeTh
    ? PROFESSOR_MENU.filter((m) => m.th !== excludeTh)
    : PROFESSOR_MENU;
  return pool[Math.floor(Math.random() * pool.length)];
}

export type ProfLocation = "OR" | "OPD" | "BOTH";
export type ScheduleHint = {
  text: string;
  suggest: ProfLocation | "SKIP";
};

/**
 * Suggested location from อ.ไพบูลย์'s weekly schedule (a hint only — the order
 * person always confirms). จ.OR อ.OR พ.(1–15 Laryngo/16+ OR) พฤ.OPD ศ.ไม่ต้อง.
 */
export function professorScheduleHint(iso: string): ScheduleHint {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 Sun … 6 Sat
  switch (dow) {
    case 1:
      return { text: "จันทร์ — ตามตาราง OR (เฉพาะวันมีเคส)", suggest: "OR" };
    case 2:
      return { text: "อังคาร — ตามตาราง OR (เฉพาะวันมีเคส)", suggest: "OR" };
    case 3:
      return d <= 15
        ? { text: "พุธ (1–15) — Laryngo · ถ้าไม่ชัวร์สั่งทั้งสองที่", suggest: "BOTH" }
        : { text: "พุธ (16–31) — ตามตาราง OR", suggest: "OR" };
    case 4:
      return { text: "พฤหัส — ตามตาราง OPD", suggest: "OPD" };
    case 5:
      return { text: "ศุกร์ — ปกติไม่ต้องสั่ง", suggest: "SKIP" };
    default:
      return { text: "เสาร์–อาทิตย์ — ปกติไม่ต้องสั่ง", suggest: "SKIP" };
  }
}
