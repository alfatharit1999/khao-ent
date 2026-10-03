// Lunch ideas from the restaurant menu (กินกับข้าว @ วังหลัง).
// Prices are intentionally omitted: the restaurant confirms them after ordering.
export const RESIDENT_MENU = [
  "ข้าวกะเพราหมู",
  "ข้าวกะเพราไก่",
  "ข้าวกะเพรากุ้ง",
  "ข้าวกระเทียมหมู",
  "ข้าวกระเทียมไก่",
  "ข้าวกระเทียมกุ้ง",
  "ข้าวผัดพริกแกงหมู",
  "ข้าวผัดพริกแกงไก่",
  "ข้าวผัดผงกะหรี่หมู",
  "ข้าวผัดผงกะหรี่กุ้ง",
  "ข้าวผัดไข่เค็มหมู",
  "ข้าวคั่วพริกเกลือหมู",
  "ข้าวคั่วพริกเกลือกุ้ง",
  "ข้าวหมูสามชั้นทอด",
  "ข้าวหมูสามชั้นทอดคั่วพริกเกลือ",
  "ข้าวไข่เจียวหมูสับ",
  "ข้าวผัดหมู",
  "ข้าวผัดกุ้ง",
  "ข้าวผัดโบราณหมู",
  "ข้าวผัดต้มยำกุ้ง",
  "สปาเก็ตตี้ผัดพริกแห้งหมู",
  "สปาเก็ตตี้ผัดกะเพราหมู",
  "สปาเก็ตตี้ซอสมะเขือเทศหมู",
  "ผัดซีอิ๊วหมู",
  "ราดหน้าหมู",
] as const;

export function randomResidentMenu(current?: string): string {
  const choices = RESIDENT_MENU.filter((item) => item !== current?.trim());
  return choices[Math.floor(Math.random() * choices.length)];
}
