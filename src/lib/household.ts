import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Member = {
  id: string;
  name: string;
  role: string;
  color: string;
  sort_order: number;
};

export type Chore = {
  id: string;
  title: string;
  notes: string | null;
  member_id: string | null;
  frequency: string;
  due_date: string;
  archived: boolean;
};

export type Meal = {
  id: string;
  meal_date: string;
  slot: string;
  title: string;
  notes: string | null;
  toddler_note: string;
  cooked: boolean;
};

export type MealIngredient = {
  id: string;
  meal_id: string;
  name: string;
  quantity: string | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  low_threshold: number;
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  category: string;
  checked: boolean;
};

export const SLOTS = ["breakfast", "lunch", "dinner"] as const;
export const CATEGORIES = [
  "pantry",
  "fridge",
  "freezer",
  "cleaning",
  "toiletries",
  "baby",
] as const;
export const FREQUENCIES = ["daily", "weekly", "once"] as const;

export const TODDLER_DEFAULT_NOTE =
  "Plate her portion before adding salt, spice or seasoning.";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

export const membersQuery = queryOptions({
  queryKey: ["members"],
  queryFn: async () =>
    unwrap<Member[]>(
      await supabase.from("members").select("*").order("sort_order", { ascending: true }),
    ),
});

export const choresQuery = queryOptions({
  queryKey: ["chores"],
  queryFn: async () =>
    unwrap<Chore[]>(
      await supabase
        .from("chores")
        .select("*")
        .eq("archived", false)
        .order("due_date", { ascending: true }),
    ),
});

export const mealsQuery = queryOptions({
  queryKey: ["meals"],
  queryFn: async () =>
    unwrap<Meal[]>(await supabase.from("meals").select("*").order("meal_date")),
});

export const mealIngredientsQuery = queryOptions({
  queryKey: ["meal_ingredients"],
  queryFn: async () =>
    unwrap<MealIngredient[]>(await supabase.from("meal_ingredients").select("*")),
});

export const inventoryQuery = queryOptions({
  queryKey: ["inventory_items"],
  queryFn: async () =>
    unwrap<InventoryItem[]>(
      await supabase.from("inventory_items").select("*").order("name"),
    ),
});

export const shoppingQuery = queryOptions({
  queryKey: ["shopping_items"],
  queryFn: async () =>
    unwrap<ShoppingItem[]>(
      await supabase.from("shopping_items").select("*").order("created_at"),
    ),
});

/** yyyy-mm-dd in the user's own timezone (never UTC-shifted). */
export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  return addDays(date, diff);
}

export function nextDueDate(current: string, frequency: string) {
  const base = parseDateKey(current);
  const today = new Date();
  const from = base > today ? base : today;
  if (frequency === "daily") return toDateKey(addDays(from, 1));
  if (frequency === "weekly") return toDateKey(addDays(from, 7));
  return null;
}

export const memberToneClass: Record<string, string> = {
  sage: "bg-sage text-sage-foreground",
  clay: "bg-clay text-clay-foreground",
  ochre: "bg-ochre text-ochre-foreground",
  plum: "bg-plum text-plum-foreground",
};

export function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
