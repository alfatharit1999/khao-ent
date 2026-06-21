// อ.ไพบูลย์'s rotating lunch pool (no spicy, no squid) + delivery/box rules.

export type ProfMenuItem = {
  id: number;
  th: string;
  en: string;
  price: number;
  approx?: boolean; // price marked "~" in the source list
};

export const PROFESSOR_MENU: ProfMenuItem[] = [
  // — ข้าวผัด (kept to a few distinct flavours; no chicken) —
  { id: 1, th: "ข้าวผัดหมู", en: "Pork fried rice", price: 50 },
  { id: 2, th: "ข้าวผัดรถไฟ (โบราณ) หมู", en: "Old-style pork fried rice", price: 55 },
  { id: 3, th: "ข้าวผัดไข่เค็มหมู", en: "Salted-egg pork fried rice", price: 60 },
  { id: 4, th: "ข้าวผัดกุ้ง", en: "Shrimp fried rice", price: 60 },
  // — ผัดกับข้าว (curry / basil labelled non-spicy as requested) —
  { id: 5, th: "ข้าวกะเพราหมู (ไม่เผ็ด) + ไข่ดาว", en: "Pork basil, non-spicy + fried egg", price: 60 },
  { id: 6, th: "ข้าวผัดพริกแกงหมู (ไม่เผ็ด)", en: "Pork red-curry stir-fry, non-spicy", price: 50 },
  { id: 7, th: "ข้าวผัดผงกะหรี่หมู (ไม่เผ็ด)", en: "Pork yellow-curry-powder stir-fry, non-spicy", price: 60 },
  { id: 8, th: "ข้าวกระเทียมหมู", en: "Garlic pork over rice", price: 50 },
  { id: 9, th: "ข้าวคั่วพริกเกลือหมู", en: "Salt-&-pepper pork over rice", price: 50 },
  { id: 10, th: "ข้าวผัดผักรวมหมู", en: "Pork with stir-fried mixed veg", price: 50 },
  { id: 11, th: "ข้าวไข่เจียวหมูสับ", en: "Pork omelette over rice", price: 50 },
  // — หมูสามชั้นทอด (เมนูแนะนำ) —
  { id: 12, th: "ข้าวหมูสามชั้นทอด", en: "Crispy pork belly over rice", price: 60 },
  { id: 13, th: "ข้าวหมูสามชั้นทอดคั่วพริกเกลือ", en: "Salt-&-pepper crispy pork belly", price: 65 },
  { id: 14, th: "ข้าวราดผัดพริกกะหรี่หมูสามชั้นทอด (ไม่เผ็ด)", en: "Crispy pork belly w/ curry stir-fry, non-spicy", price: 75 },
  // — เส้น (แห้ง ไม่มีน้ำ เพิ่มความหลากหลาย) —
  { id: 15, th: "ผัดซีอิ๊วหมู (เส้นใหญ่)", en: "Pork pad see-ew", price: 55 },
  { id: 16, th: "ผัดซีอิ๊วหมูใส่ไข่ (เส้นใหญ่)", en: "Pork pad see-ew with egg", price: 65 },
  { id: 17, th: "ผัดซีอิ๊วหมูกรอบ (เส้นใหญ่)", en: "Crispy-pork pad see-ew", price: 65 },
  { id: 18, th: "สุกี้แห้งหมู (ไม่เผ็ด)", en: "Dry pork sukiyaki, non-spicy", price: 55 },
  { id: 19, th: "สปาเก็ตตี้ผัดกะเพราหมู (ไม่เผ็ด)", en: "Pork basil spaghetti, non-spicy", price: 59 },
  { id: 20, th: "สปาเก็ตตี้ซอสมะเขือเทศหมู", en: "Pork tomato spaghetti", price: 59 },
];

export const PROFESSOR_RESTRICTIONS = "ไม่เผ็ด / ไม่ใส่ปลาหมึก / ไม่กินไก่";
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
