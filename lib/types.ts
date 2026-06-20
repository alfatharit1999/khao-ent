export type Category = "R1" | "R2" | "R3" | "F1" | "F2" | "F3" | "professor";

export type Person = {
  id: string;
  name: string;
  category: Category;
  sort_order: number;
  active: boolean;
  note: string | null;
};

export type OrderLocation = "OR" | "OPD" | "BOTH" | null;

export type DayState = {
  date: string;
  sealed: boolean;
  prof_status: "ordering" | "skip" | null;
};

export type Order = {
  id: string;
  person_id: string;
  order_date: string; // YYYY-MM-DD
  location: OrderLocation;
  menu_item: string | null;
  price: number;
  fronted: boolean;
  created_at: string;
};

export type CreditType = "topup" | "front_credit" | "adjustment" | "settlement";

export type Credit = {
  id: string;
  person_id: string;
  date: string; // YYYY-MM-DD
  type: CreditType;
  amount: number; // signed; + adds credit, - removes
  note: string | null;
};

export type FundEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string | null;
  income: number;
  expense: number;
  recipient: string | null;
  account: string | null;
  note: string | null;
};

export type Balance = {
  person_id: string;
  name: string;
  category: Category;
  sort_order: number;
  topups: number; // sum of all credits
  spent: number; // sum of all order prices
  balance: number; // topups - spent
};

export type Setting = {
  key: string;
  value: string;
};
