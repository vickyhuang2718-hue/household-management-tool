import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export const Route = createFileRoute("/shopping")({
  head: () => ({
    meta: [
      { title: "Shopping List — Household Hub" },
      {
        name: "description",
        content:
          "Build the shopping list by hand, with suggestions from low pantry stock and this week's meals.",
      },
      { property: "og:title", content: "Shopping List — Household Hub" },
      {
        property: "og:description",
        content: "Suggestions from low stock and this week's meals, added only when you choose.",
      },
    ],
  }),
  component: ShoppingPage,
});

function ShoppingPage() {
  const queryClient = useQueryClient();
  const { data: list = [], isLoading } = useQuery(shoppingQuery);
  const { data: inventory = [] } = useQuery(inventoryQuery);
  const { data: meals = [] } = useQuery(mealsQuery);
  const { data: ingredients = [] } = useQuery(mealIngredientsQuery);
  const [name, setName] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["shopping_items"] });

  const addItem = useMutation({
    mutationFn: async (values: { name: string; category?: string }) => {
      const { error } = await supabase.from("shopping_items").insert(values);
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

  const finishTrip = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shopping_items").delete().eq("checked", true);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Trip finished — ticked items cleared");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const listNames = new Set(list.map((item) => item.name.toLowerCase()));
  const inventoryNames = new Set(inventory.map((item) => item.name.toLowerCase()));

  const lowSuggestions = inventory
    .filter((item) => Number(item.quantity) <= Number(item.low_threshold))
    .filter((item) => !listNames.has(item.name.toLowerCase()));

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
      title="Shopping"
      subtitle="Add what you need — suggestions are only ever a tap away"
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
          placeholder="Add an item"
          aria-label="Add an item"
        />
        <Button type="submit" size="icon" aria-label="Add to list">
          <Plus className="size-4" />
        </Button>
      </form>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading the list…</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {list.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
            >
              <button
                type="button"
                aria-label={`Tick off ${item.name}`}
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
              Your list is empty.
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
          <Trash2 className="size-4" /> Finish trip and clear {checkedCount} ticked
        </Button>
      ) : null}

      <Suggestions
        heading="Running low in the house"
        items={lowSuggestions.map((item) => ({
          key: item.id,
          label: `${item.name} (${Number(item.quantity)} ${item.unit} left)`,
          name: item.name,
          category: item.category,
        }))}
        onAdd={(values) => addItem.mutate(values)}
      />

      <Suggestions
        heading="Needed for this week's meals"
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
