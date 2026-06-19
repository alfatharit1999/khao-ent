import type { Category } from "./types";

/** Display order for grouping people on the home + summary screens. */
export const CATEGORY_ORDER: Category[] = [
  "R1",
  "R2",
  "R3",
  "F1",
  "F2",
  "F3",
  "professor",
];

export const CATEGORY_LABEL: Record<Category, string> = {
  R1: "Resident ปี 1",
  R2: "Resident ปี 2",
  R3: "Resident ปี 3",
  F1: "Fellow ปี 1",
  F2: "Fellow ปี 2",
  F3: "Fellow ปี 3",
  professor: "อาจารย์",
};

/** Short chip label, e.g. for the admin people list. */
export const CATEGORY_SHORT: Record<Category, string> = {
  R1: "R1",
  R2: "R2",
  R3: "R3",
  F1: "F1",
  F2: "F2",
  F3: "F3",
  professor: "อาจารย์",
};

export const isProfessor = (c: Category) => c === "professor";
