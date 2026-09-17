import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/household/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  type ShoppingItem,
  addDays,
  inventoryQuery,
  mealIngredientsQuery,
  mealsQuery,
  shoppingQuery,
  toDateKey,
} from "@/lib/household";


import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shopping")({
  head: () => ({
    meta: [
      { title: "采购清单 Shopping List — 家事管家" },
      {
        name: "description",
        content:
          "手动添加采购清单，并根据快用完的库存和本周菜单给出建议。中英双语显示。",
      },
      { property: "og:title", content: "采购清单 Shopping List — 家事管家" },
      {
        property: "og:description",
        content: "根据库存和本周菜单给出建议，由你决定加不加。",
      },
    ],
  }),
  component: ShoppingPage,
});

function ShoppingPage() {
  const queryClient = useQueryClient();
  const { data: list = [], isLoading } = useQuery(shoppingQuery);
  const { data: upcoming = [] } = useQuery(upcomingShoppingQuery);
  const { data: inventory = [] } = useQuery(inventoryQuery);
  const { data: meals = [] } = useQuery(mealsQuery);
  const { data: ingredients = [] } = useQuery(mealIngredientsQuery);
  const [name, setName] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["shopping_items"] });

  const addItem = useMutation({
    mutationFn: async (values: { name: string; category?: string | undefined }) => {
      const { error } = await supabase
        .from("shopping_items")
        .insert({ name: values.name, category: values.category ?? "pantry" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      setName("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (item: ShoppingItem) => {
      const { error } = await supabase
        .from("shopping_items")
        .update({ checked: !item.checked })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const saveUpcomingName = useMutation({
    mutationFn: async (values: { id: string; name: string }) => {
      const { error } = await supabase
        .from("shopping_items")
        .update({ name: values.name })
        .eq("id", values.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const postponeUpcoming = useMutation({
    mutationFn: async (values: { id: string; from: string; days: number }) => {
      const { error } = await supabase
        .from("shopping_items")
        .update({
          buy_after: toDateKey(addDays(new Date(`${values.from}T00:00:00`), values.days)),
        })
        .eq("id", values.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast.success("已推迟 · Postponed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const finishTrip = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shopping_items").delete().eq("checked", true);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("本次采购完成，已清掉勾选的物品 / Trip finished");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const listNames = new Set(list.map((item) => item.name.toLowerCase()));
  const inventoryNames = new Set(inventory.map((item) => item.name.toLowerCase()));


  const weekStart = toDateKey(new Date());
  const weekEnd = toDateKey(addDays(new Date(), 7));
  const weekMealIds = new Set(
    meals
      .filter((meal) => meal.meal_date >= weekStart && meal.meal_date <= weekEnd)
      .map((meal) => meal.id),
  );
  const missingIngredients = ingredients
    .filter((ingredient) => weekMealIds.has(ingredient.meal_id))
    .filter(
      (ingredient) =>
        !inventoryNames.has(ingredient.name.toLowerCase()) &&
        !listNames.has(ingredient.name.toLowerCase()),
    );

  const checkedCount = list.filter((item) => item.checked).length;

  return (
    <AppShell
      title="采购清单 Shopping"
      subtitle="想到什么就添加，建议随手一点即可加入 · Add what you need"
    >
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          addItem.mutate({ name: name.trim() });
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="添加物品 Add an item"
          aria-label="添加物品 Add an item"
        />
        <Button type="submit" size="icon" aria-label="加入清单 Add to list">
          <Plus className="size-4" />
        </Button>
      </form>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">正在加载清单… Loading…</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {list.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
            >
              <button
                type="button"
                aria-label={`买好了 ${item.name}`}
                onClick={() => toggle.mutate(item)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border border-border transition-colors",
                  item.checked
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Check className="size-4" />
              </button>
              <span
                className={cn(
                  "flex-1 font-medium",
                  item.checked && "text-muted-foreground line-through",
                )}
              >
                {item.name}
                {item.quantity ? ` · ${item.quantity}` : ""}
              </span>
            </li>
          ))}
          {list.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              清单是空的 · Your list is empty.
            </li>
          ) : null}
        </ul>
      )}

      {checkedCount > 0 ? (
        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => finishTrip.mutate()}
          disabled={finishTrip.isPending}
        >
          <Trash2 className="size-4" /> 完成采购，清掉已勾选的 {checkedCount} 项 · Finish trip
        </Button>
      ) : null}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          稍后要买 · Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            没有安排稍后要买的东西 · Nothing scheduled yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((item) => {
              const days = Math.round(
                (new Date(`${item.buy_after}T00:00:00`).getTime() -
                  new Date(`${toDateKey(new Date())}T00:00:00`).getTime()) /
                  86400000,
              );
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-border bg-card p-3 shadow-sm"
                >
                  {editingId === item.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        aria-label="物品名称 Item name"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">推迟 Postpone：</span>
                        {[1, 2, 3].map((days) => (
                          <Button
                            key={days}
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={postponeUpcoming.isPending}
                            onClick={() =>
                              postponeUpcoming.mutate({
                                id: item.id,
                                from: item.buy_after ?? toDateKey(new Date()),
                                days,
                              })
                            }
                          >
                            {days} 天
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={saveUpcomingName.isPending || !editingName.trim()}
                          onClick={() =>
                            saveUpcomingName.mutate({ id: item.id, name: editingName.trim() })
                          }
                        >
                          保存
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        className="flex-1 min-w-0 cursor-pointer text-left font-medium underline-offset-2 hover:underline"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingName(item.name);
                        }}
                      >
                        {item.name}
                        {item.quantity ? ` · ${item.quantity}` : ""}
                      </button>
                      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                        {days} 天后 · due in {days} {days === 1 ? "day" : "days"}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Suggestions
        heading="本周菜单需要 · Needed for this week's meals"
        items={missingIngredients.map((ingredient) => ({
          key: ingredient.id,
          label: ingredient.quantity
            ? `${ingredient.name} · ${ingredient.quantity}`
            : ingredient.name,
          name: ingredient.name,
        }))}
        onAdd={(values) => addItem.mutate(values)}
      />
    </AppShell>
  );
}

const upcomingShoppingQuery = queryOptions({
  queryKey: ["shopping_items", "upcoming"],
  queryFn: async (): Promise<ShoppingItem[]> => {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("*")
      .gt("buy_after", toDateKey(new Date()))
      .order("buy_after");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

function Suggestions({
  heading,
  items,
  onAdd,
}: {
  heading: string;
  items: { key: string; label: string; name: string; category?: string | undefined }[];
  onAdd: (values: { name: string; category?: string | undefined }) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {heading}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onAdd({ name: item.name, category: item.category })}
              className="flex items-center gap-2 rounded-full border border-dashed border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="size-3.5" />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
