import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Baby, ChefHat, CopyPlus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/household/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  SLOTS,
  TODDLER_DEFAULT_NOTE,
  type Meal,
  addDays,
  mealIngredientsQuery,
  mealsQuery,
  startOfWeek,
  toDateKey,
} from "@/lib/household";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/meals")({
  head: () => ({
    meta: [
      { title: "Meal Plan — Household Hub" },
      {
        name: "description",
        content:
          "Plan breakfast, lunch and dinner for the week, with a toddler portion reminder on every meal.",
      },
      { property: "og:title", content: "Meal Plan — Household Hub" },
      {
        property: "og:description",
        content: "Plan the week's meals with a toddler portion reminder on every dish.",
      },
    ],
  }),
  component: MealsPage,
});

function MealsPage() {
  const queryClient = useQueryClient();
  const { data: meals = [], isLoading } = useQuery(mealsQuery);
  const { data: ingredients = [] } = useQuery(mealIngredientsQuery);
  const [weekOffset, setWeekOffset] = useState(0);
  const [editing, setEditing] = useState<{ date: string; slot: string } | null>(null);

  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const saveMeal = useMutation({
    mutationFn: async (values: {
      meal_date: string;
      slot: string;
      title: string;
      notes: string;
      toddler_note: string;
    }) => {
      const { error } = await supabase
        .from("meals")
        .upsert(values, { onConflict: "meal_date,slot" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      setEditing(null);
      toast.success("Meal saved");
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
      if (source.length === 0) throw new Error("Last week has no meals to copy.");
      const rows = source.map((meal) => ({
        meal_date: toDateKey(addDays(new Date(meal.meal_date), 7)),
        slot: meal.slot,
        title: meal.title,
        notes: meal.notes,
        toddler_note: meal.toddler_note,
      }));
      const { error } = await supabase
        .from("meals")
        .upsert(rows, { onConflict: "meal_date,slot" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      toast.success("Last week's meals copied across");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const findMeal = (date: Date, slot: string) =>
    meals.find((meal) => meal.meal_date === toDateKey(date) && meal.slot === slot);

  return (
    <AppShell title="Meal plan" subtitle="Breakfast, lunch and dinner for the week">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
          Previous
        </Button>
        <p className="text-sm font-medium">
          {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
          {addDays(weekStart, 6).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </p>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
          Next
        </Button>
      </div>

      <Button
        variant="secondary"
        className="mt-3 w-full"
        onClick={() => copyWeek.mutate()}
        disabled={copyWeek.isPending}
      >
        <CopyPlus className="size-4" /> Copy last week into this week
      </Button>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading the plan…</p>
      ) : (
        <div className="mt-6 space-y-5">
          {days.map((day) => (
            <section key={toDateKey(day)}>
              <h2 className="text-sm font-semibold text-foreground">
                {day.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </h2>
              <div className="mt-2 space-y-2">
                {SLOTS.map((slot) => {
                  const meal = findMeal(day, slot);
                  const isEditing =
                    editing?.date === toDateKey(day) && editing?.slot === slot;

                  if (isEditing) {
                    return (
                      <MealForm
                        key={slot}
                        slot={slot}
                        meal={meal}
                        pending={saveMeal.isPending}
                        onCancel={() => setEditing(null)}
                        onSave={(values) =>
                          saveMeal.mutate({
                            meal_date: toDateKey(day),
                            slot,
                            ...values,
                          })
                        }
                      />
                    );
                  }

                  return (
                    <div
                      key={slot}
                      className="rounded-xl border border-border bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          className="flex-1 text-left"
                          onClick={() => setEditing({ date: toDateKey(day), slot })}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {slot}
                          </p>
                          <p
                            className={cn(
                              "mt-0.5 font-medium",
                              meal ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {meal?.title ?? "Tap to plan"}
                          </p>
                          {meal?.notes ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {meal.notes}
                            </p>
                          ) : null}
                        </button>
                        {meal ? (
                          <button
                            type="button"
                            aria-label="Mark cooked"
                            onClick={() => toggleCooked.mutate(meal)}
                            className={cn(
                              "flex size-9 items-center justify-center rounded-full border border-border transition-colors",
                              meal.cooked
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            <ChefHat className="size-4" />
                          </button>
                        ) : null}
                      </div>

                      {meal ? (
                        <>
                          <p className="mt-2 flex items-start gap-2 rounded-lg bg-accent/60 p-2 text-xs text-accent-foreground">
                            <Baby className="mt-0.5 size-4 shrink-0" />
                            {meal.toddler_note}
                          </p>
                          {ingredients.filter((i) => i.meal_id === meal.id).length > 0 ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Needs:{" "}
                              {ingredients
                                .filter((i) => i.meal_id === meal.id)
                                .map((i) =>
                                  i.quantity ? `${i.name} (${i.quantity})` : i.name,
                                )
                                .join(", ")}
                            </p>
                          ) : null}
                        </>
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

function MealForm({
  slot,
  meal,
  onSave,
  onCancel,
  pending,
}: {
  slot: string;
  meal?: Meal | undefined;
  onSave: (values: { title: string; notes: string; toddler_note: string }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState(meal?.title ?? "");
  const [notes, setNotes] = useState(meal?.notes ?? "");
  const [toddlerNote, setToddlerNote] = useState(
    meal?.toddler_note ?? TODDLER_DEFAULT_NOTE,
  );

  return (
    <form
      className="space-y-3 rounded-xl border border-primary/40 bg-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onSave({ title: title.trim(), notes, toddler_note: toddlerNote });
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {slot}
      </p>
      <div className="space-y-2">
        <Label htmlFor={`meal-${slot}`}>Dish</Label>
        <Input
          id={`meal-${slot}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Dal with rice"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`notes-${slot}`}>Notes</Label>
        <Textarea
          id={`notes-${slot}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`toddler-${slot}`}>Toddler portion</Label>
        <Textarea
          id={`toddler-${slot}`}
          value={toddlerNote}
          onChange={(event) => setToddlerNote(event.target.value)}
          rows={2}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
