import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChefHat, CopyPlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/household/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  BABY_TAGS,
  BABY_TAG_LABELS,
  BABY_TAG_TONES,
  SLOTS,
  SLOT_LABELS,
  type BabyTag,
  type Meal,
  type MealDish,
  addDays,
  mealDishesQuery,
  mealIngredientsQuery,
  mealsQuery,
  startOfWeek,
  toDateKey,
} from "@/lib/household";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/meals")({
  head: () => ({
    meta: [
      { title: "每周菜单 — 家事管家" },
      {
        name: "description",
        content: "安排一周的早中晚三餐，每道菜都标注宝宝能不能吃。",
      },
      { property: "og:title", content: "每周菜单 — 家事管家" },
      {
        property: "og:description",
        content: "安排一周三餐，每道菜都标注宝宝能不能吃。",
      },
    ],
  }),
  component: MealsPage,
});

type DishDraft = { name: string; notes: string; baby_tag: BabyTag };

function MealsPage() {
  const queryClient = useQueryClient();
  const { data: meals = [], isLoading } = useQuery(mealsQuery);
  const { data: dishes = [] } = useQuery(mealDishesQuery);
  const { data: ingredients = [] } = useQuery(mealIngredientsQuery);
  const [weekOffset, setWeekOffset] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const [editingDish, setEditingDish] = useState<string | null>(null);

  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["meals"] });
    queryClient.invalidateQueries({ queryKey: ["meal_dishes"] });
  };

  async function ensureMeal(mealDate: string, slot: string, fallbackTitle: string) {
    const existing = meals.find(
      (meal) => meal.meal_date === mealDate && meal.slot === slot,
    );
    if (existing) return existing.id;
    const { data, error } = await supabase
      .from("meals")
      .upsert({ meal_date: mealDate, slot, title: fallbackTitle }, {
        onConflict: "meal_date,slot",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  const addDish = useMutation({
    mutationFn: async (values: {
      meal_date: string;
      slot: string;
      draft: DishDraft;
    }) => {
      const mealId = await ensureMeal(values.meal_date, values.slot, values.draft.name);
      const count = dishes.filter((dish) => dish.meal_id === mealId).length;
      const { error } = await supabase.from("meal_dishes").insert({
        meal_id: mealId,
        name: values.draft.name,
        notes: values.draft.notes || null,
        baby_tag: values.draft.baby_tag,
        sort_order: count,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      refresh();
      setAdding(null);
      toast.success("已添加这道菜");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateDish = useMutation({
    mutationFn: async (values: { id: string; draft: DishDraft }) => {
      const { error } = await supabase
        .from("meal_dishes")
        .update({
          name: values.draft.name,
          notes: values.draft.notes || null,
          baby_tag: values.draft.baby_tag,
        })
        .eq("id", values.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      refresh();
      setEditingDish(null);
      toast.success("已保存");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteDish = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_dishes").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      refresh();
      setEditingDish(null);
      toast.success("已删除这道菜");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleCooked = useMutation({
    mutationFn: async (meal: Meal) => {
      const { error } = await supabase
        .from("meals")
        .update({ cooked: !meal.cooked })
        .eq("id", meal.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meals"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const copyWeek = useMutation({
    mutationFn: async () => {
      const source = meals.filter((meal) => {
        const key = meal.meal_date;
        return key >= toDateKey(addDays(weekStart, -7)) && key < toDateKey(weekStart);
      });
      if (source.length === 0) throw new Error("上周还没有安排菜单，无法复制。");
      for (const meal of source) {
        const nextDate = toDateKey(addDays(new Date(`${meal.meal_date}T00:00:00`), 7));
        const { data, error } = await supabase
          .from("meals")
          .upsert(
            {
              meal_date: nextDate,
              slot: meal.slot,
              title: meal.title,
              notes: meal.notes,
              toddler_note: meal.toddler_note,
            },
            { onConflict: "meal_date,slot" },
          )
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        const sourceDishes = dishes.filter((dish) => dish.meal_id === meal.id);
        if (sourceDishes.length === 0) continue;
        const { error: dishError } = await supabase.from("meal_dishes").insert(
          sourceDishes.map((dish) => ({
            meal_id: data.id as string,
            name: dish.name,
            notes: dish.notes,
            baby_tag: dish.baby_tag,
            sort_order: dish.sort_order,
          })),
        );
        if (dishError) throw new Error(dishError.message);
      }
    },
    onSuccess: () => {
      refresh();
      toast.success("已复制上周的菜单");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const findMeal = (date: Date, slot: string) =>
    meals.find((meal) => meal.meal_date === toDateKey(date) && meal.slot === slot);

  return (
    <AppShell title="每周菜单" subtitle="一周的早餐、午餐和晚餐">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
          上一周
        </Button>
        <p className="text-sm font-medium">
          {weekStart.toLocaleDateString("zh-CN", { day: "numeric", month: "short" })} –{" "}
          {addDays(weekStart, 6).toLocaleDateString("zh-CN", {
            day: "numeric",
            month: "short",
          })}
        </p>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
          下一周
        </Button>
      </div>

      <Button
        variant="secondary"
        className="mt-3 w-full"
        onClick={() => copyWeek.mutate()}
        disabled={copyWeek.isPending}
      >
        <CopyPlus className="size-4" /> 把上周的菜单复制过来
      </Button>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">正在加载菜单…</p>
      ) : (
        <div className="mt-6 space-y-5">
          {days.map((day) => (
            <section key={toDateKey(day)}>
              <h2 className="text-sm font-semibold text-foreground">
                {day.toLocaleDateString("zh-CN", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </h2>
              <div className="mt-2 space-y-2">
                {SLOTS.map((slot) => {
                  const meal = findMeal(day, slot);
                  const slotKey = `${toDateKey(day)}-${slot}`;
                  const slotDishes = meal
                    ? dishes.filter((dish) => dish.meal_id === meal.id)
                    : [];

                  return (
                    <div
                      key={slot}
                      className="rounded-xl border border-border bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {SLOT_LABELS[slot] ?? slot}
                        </p>
                        {meal ? (
                          <button
                            type="button"
                            aria-label="标记为已做"
                            onClick={() => toggleCooked.mutate(meal)}
                            className={cn(
                              "flex size-8 items-center justify-center rounded-full border border-border transition-colors",
                              meal.cooked
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            <ChefHat className="size-4" />
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-2 space-y-2">
                        {slotDishes.length === 0 && adding !== slotKey ? (
                          <p className="text-sm text-muted-foreground">还没有安排菜</p>
                        ) : null}

                        {slotDishes.map((dish) =>
                          editingDish === dish.id ? (
                            <DishForm
                              key={dish.id}
                              initial={{
                                name: dish.name,
                                notes: dish.notes ?? "",
                                baby_tag: dish.baby_tag,
                              }}
                              pending={updateDish.isPending}
                              onSave={(draft) => updateDish.mutate({ id: dish.id, draft })}
                              onCancel={() => setEditingDish(null)}
                              onDelete={() => deleteDish.mutate(dish.id)}
                            />
                          ) : (
                            <DishRow
                              key={dish.id}
                              dish={dish}
                              onClick={() => setEditingDish(dish.id)}
                            />
                          ),
                        )}

                        {adding === slotKey ? (
                          <DishForm
                            initial={{ name: "", notes: "", baby_tag: "reserve" }}
                            pending={addDish.isPending}
                            onSave={(draft) =>
                              addDish.mutate({
                                meal_date: toDateKey(day),
                                slot,
                                draft,
                              })
                            }
                            onCancel={() => setAdding(null)}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAdding(slotKey)}
                            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground"
                          >
                            <Plus className="size-3.5" /> 添加一道菜
                          </button>
                        )}
                      </div>

                      {meal && ingredients.filter((i) => i.meal_id === meal.id).length > 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          需要：{" "}
                          {ingredients
                            .filter((i) => i.meal_id === meal.id)
                            .map((i) => (i.quantity ? `${i.name} (${i.quantity})` : i.name))
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function DishRow({ dish, onClick }: { dish: MealDish; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start gap-1 rounded-lg bg-accent/40 px-3 py-2 text-left"
    >
      <span className="font-medium text-foreground">{dish.name}</span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium",
          BABY_TAG_TONES[dish.baby_tag],
        )}
      >
        {BABY_TAG_LABELS[dish.baby_tag]}
      </span>
      {dish.notes ? (
        <span className="text-xs text-muted-foreground">{dish.notes}</span>
      ) : null}
    </button>
  );
}

function DishForm({
  initial,
  onSave,
  onCancel,
  onDelete,
  pending,
}: {
  initial: DishDraft;
  onSave: (draft: DishDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [notes, setNotes] = useState(initial.notes);
  const [babyTag, setBabyTag] = useState<BabyTag>(initial.baby_tag);

  return (
    <form
      className="space-y-3 rounded-lg border border-primary/40 bg-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), notes: notes.trim(), baby_tag: babyTag });
      }}
    >
      <div className="space-y-2">
        <Label>菜名</Label>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例如：番茄炒蛋"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>宝宝能不能吃</Label>
        <Select value={babyTag} onValueChange={(value) => setBabyTag(value as BabyTag)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BABY_TAGS.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {BABY_TAG_LABELS[tag]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>备注</Label>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          保存
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            aria-label="删除这道菜"
            onClick={onDelete}
            className="text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    </form>
  );
}
