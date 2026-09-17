import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Member = {
  id: string;
  name: string;
  role: string;
  color: string;
  initial: string;
  sort_order: number;
};

export type HouseholdSettings = {
  id: string;
  name: string;
  join_key: string;
};

export type JoinRequest = {
  id: string;
  user_id: string;
  display_name: string;
  status: string;
  created_at: string;
};

export type OnboardingState = {
  household_id: string | null;
  household_name: string | null;
  join_status: string | null;
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

export type StockStatus = "enough" | "low" | "out";

export const STOCK_STATUSES: StockStatus[] = ["enough", "low", "out"];

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  enough: "还够用",
  low: "快用完 · 可以买",
  out: "没有了 · 马上补",
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  low_threshold: number;
  status: StockStatus;
  reviewed_at: string;
  note: string | null;
  note_updated_at: string | null;
  note_updated_by: string | null;
};


export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  category: string;
  checked: boolean;
  buy_after: string | null;
};

export type ChoreFields = {
  title: string;
  notes: string | null;
  member_id: string | null;
  frequency: string;
  due_date: string;
};

export type ChoreEdit = {
  id: string;
  chore_id: string;
  editor_name: string;
  before_data: ChoreFields;
  after_data: ChoreFields;
  undone: boolean;
  dismissed: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  member_id: string | null;
  household_id: string | null;
  inventory_reviewed_on: string | null;
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
export const FREQUENCIES = ["daily", "weekly", "monthly", "once"] as const;

export const SLOT_LABELS: Record<string, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
};

export const CATEGORY_LABELS: Record<string, string> = {
  pantry: "干货储藏",
  fridge: "冰箱冷藏",
  freezer: "冷冻室",
  cleaning: "清洁用品",
  toiletries: "洗护用品",
  baby: "宝宝用品",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
  once: "一次性（不重复）",
};

export const TODDLER_DEFAULT_NOTE = "先盛出宝宝的那一份，再加盐、香料和其他调味。";

/** Fixed locale so the server and the browser always render the same text. */
export const LOCALE = "zh-CN";

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
      (await supabase
        .from("inventory_items")
        .select("*")
        .eq("deleted", false)
        .order("name")) as never,
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
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
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
  return repeatAfter(toDateKey(from), frequency);
}

/** Due date for the follow-up task, counted from the day the task was completed. */
export function repeatAfter(completedOn: string, frequency: string) {
  const from = parseDateKey(completedOn);
  if (frequency === "daily") return toDateKey(addDays(from, 1));
  if (frequency === "weekly") return toDateKey(addDays(from, 7));
  if (frequency === "monthly") {
    const next = new Date(from.getFullYear(), from.getMonth() + 1, from.getDate());
    return toDateKey(next);
  }
  return null;
}

export const memberToneClass: Record<string, string> = {
  sage: "bg-sage text-sage-foreground",
  clay: "bg-clay text-clay-foreground",
  ochre: "bg-ochre text-ochre-foreground",
  teal: "bg-teal text-teal-foreground",
  denim: "bg-denim text-denim-foreground",
  cocoa: "bg-cocoa text-cocoa-foreground",
  olive: "bg-olive text-olive-foreground",
  stone: "bg-stone text-stone-foreground",
};

export function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function profileQuery(userId: string | null) {
  return queryOptions({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, member_id, household_id, inventory_reviewed_on")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as Profile | null;
    },
  });
}

export const householdQuery = queryOptions({
  queryKey: ["households"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("households")
      .select("id, name, join_key")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as HouseholdSettings | null;
  },
});

export const onboardingQuery = queryOptions({
  queryKey: ["onboarding_state"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_onboarding_state");
    if (error) throw new Error(error.message);
    const row = (data as OnboardingState[] | null)?.[0] ?? null;
    return (
      row ?? { household_id: null, household_name: null, join_status: null }
    );
  },
});

export const joinRequestsQuery = queryOptions({
  queryKey: ["join_requests"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("join_requests")
      .select("id, user_id, display_name, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as JoinRequest[];
  },
});

export const memberRolesQuery = queryOptions({
  queryKey: ["member_roles"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("household_member_roles");
    if (error) throw new Error(error.message);
    return (data ?? []) as { member_id: string; role: "admin" | "member" }[];
  },
});

export function isAdminQuery(userId: string | null) {
  return queryOptions({
    queryKey: ["is_admin", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  });
}

/** The single character shown on a person's badge. */
export function memberBadge(member: { initial?: string; name: string }) {
  const custom = member.initial?.trim();
  if (custom) return [...custom][0] ?? "";
  return [...member.name.trim()][0] ?? "?";
}

export const COLOR_CHOICES = [
  "sage",
  "clay",
  "ochre",
  "teal",
  "denim",
  "cocoa",
  "olive",
  "stone",
] as const;

export const COLOR_LABELS: Record<string, string> = {
  sage: "青绿 Sage",
  clay: "陶土 Clay",
  ochre: "赭黄 Ochre",
  teal: "青蓝 Teal",
  denim: "靛蓝 Denim",
  cocoa: "可可 Cocoa",
  olive: "橄榄 Olive",
  stone: "石灰 Stone",
};

export type InventoryEdit = {
  id: string;
  item_id: string;
  editor_name: string;
  before_name: string;
  after_name: string;
  action: string;
  undone: boolean;
  dismissed: boolean;
  created_at: string;
};

export const inventoryEditsQuery = queryOptions({
  queryKey: ["inventory_edits"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("inventory_edits")
      .select("*")
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as InventoryEdit[];
  },
});

export const choreEditsQuery = queryOptions({
  queryKey: ["chore_edits"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("chore_edits")
      .select("*")
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ChoreEdit[];
  },
});

export function formatDay(date: Date) {
  return date.toLocaleDateString(LOCALE, {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export function formatShortDay(date: Date) {
  return date.toLocaleDateString(LOCALE, { month: "numeric", day: "numeric" });
}
