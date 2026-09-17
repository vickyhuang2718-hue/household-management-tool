import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/household/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type InventoryItem, inventoryQuery } from "@/lib/household";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Pantry & Supplies — Household Hub" },
      {
        name: "description",
        content:
          "Track what is in the pantry, fridge, freezer and cupboards, and see what is running low.",
      },
      { property: "og:title", content: "Pantry & Supplies — Household Hub" },
      {
        property: "og:description",
        content: "Track household stock and spot what is running low.",
      },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery(inventoryQuery);
  const [showForm, setShowForm] = useState(false);

  const adjust = useMutation({
    mutationFn: async ({ item, delta }: { item: InventoryItem; delta: number }) => {
      const quantity = Math.max(0, Number(item.quantity) + delta);
      const { error } = await supabase
        .from("inventory_items")
        .update({ quantity })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory_items"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const addItem = useMutation({
    mutationFn: async (values: {
      name: string;
      category: string;
      quantity: number;
      unit: string;
      low_threshold: number;
    }) => {
      const { error } = await supabase.from("inventory_items").insert(values);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      setShowForm(false);
      toast.success("Item added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const lowCount = items.filter(
    (item) => Number(item.quantity) <= Number(item.low_threshold),
  ).length;

  return (
    <AppShell
      title="Pantry & supplies"
      subtitle={lowCount > 0 ? `${lowCount} running low` : "Everything is stocked"}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading the cupboards…</p>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((category) => {
            const group = items.filter((item) => item.category === category);
            if (group.length === 0) return null;
            return (
              <section key={category}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {category}
                </h2>
                <ul className="mt-3 space-y-2">
                  {group.map((item) => {
                    const low = Number(item.quantity) <= Number(item.low_threshold);
                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm",
                          low && "border-clay/50",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 font-medium text-foreground">
                            {item.name}
                            {low ? (
                              <TriangleAlert className="size-4 text-clay" aria-label="Running low" />
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {Number(item.quantity)} {item.unit} · low at{" "}
                            {Number(item.low_threshold)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Remove one ${item.name}`}
                            onClick={() => adjust.mutate({ item, delta: -1 })}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Add one ${item.name}`}
                            onClick={() => adjust.mutate({ item, delta: 1 })}
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {showForm ? (
        <ItemForm
          pending={addItem.isPending}
          onCancel={() => setShowForm(false)}
          onSubmit={(values) => addItem.mutate(values)}
        />
      ) : (
        <Button className="mt-8 w-full" size="lg" onClick={() => setShowForm(true)}>
          <Plus className="size-4" /> Add an item
        </Button>
      )}
    </AppShell>
  );
}

function ItemForm({
  onSubmit,
  onCancel,
  pending,
}: {
  onSubmit: (values: {
    name: string;
    category: string;
    quantity: number;
    unit: string;
    low_threshold: number;
  }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("pantry");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("pcs");
  const [threshold, setThreshold] = useState("1");

  return (
    <form
      className="mt-8 space-y-4 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        onSubmit({
          name: name.trim(),
          category,
          quantity: Number(quantity) || 0,
          unit: unit.trim() || "pcs",
          low_threshold: Number(threshold) || 0,
        });
      }}
    >
      <h2 className="text-lg font-semibold">New item</h2>
      <div className="space-y-2">
        <Label htmlFor="item-name">Name</Label>
        <Input
          id="item-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Where it lives</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="item-qty">Have</Label>
          <Input
            id="item-qty"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-unit">Unit</Label>
          <Input
            id="item-unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-low">Low at</Label>
          <Input
            id="item-low"
            inputMode="decimal"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          Add item
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
