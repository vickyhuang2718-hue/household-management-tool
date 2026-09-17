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
import {
  CATEGORIES,
  CATEGORY_LABELS,
  LOCALE,
  STOCK_STATUSES,
  STOCK_STATUS_LABELS,
  type InventoryItem,
  type StockStatus,
  inventoryQuery,
} from "@/lib/household";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "家中库存 — 家事管家" },
      {
        name: "description",
        content:
          "记录储藏室、冰箱、冷冻室和柜子里的存货，快用完时一眼看到。",
      },
      { property: "og:title", content: "家中库存 — 家事管家" },
      {
        property: "og:description",
        content: "记录家中存货，随时看到快用完的东西。",
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
      toast.success("已添加");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const lowCount = items.filter(
    (item) => Number(item.quantity) <= Number(item.low_threshold),
  ).length;

  return (
    <AppShell
      title="家中库存"
      subtitle={lowCount > 0 ? `有 ${lowCount} 样快用完了` : "存货都还充足"}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">正在加载库存…</p>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((category) => {
            const group = items.filter((item) => item.category === category);
            if (group.length === 0) return null;
            return (
              <section key={category}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {CATEGORY_LABELS[category] ?? category}
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
                              <TriangleAlert className="size-4 text-clay" aria-label="快用完了" />
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {Number(item.quantity)} {item.unit} · 低于{" "}
                            {Number(item.low_threshold)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`减少一个 ${item.name}`}
                            onClick={() => adjust.mutate({ item, delta: -1 })}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`增加一个 ${item.name}`}
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
          <Plus className="size-4" /> 添加物品
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
      <h2 className="text-lg font-semibold">新物品</h2>
      <div className="space-y-2">
        <Label htmlFor="item-name">名称</Label>
        <Input
          id="item-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>放在哪里</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((option) => (
              <SelectItem key={option} value={option}>
                {CATEGORY_LABELS[option] ?? option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="item-qty">现有</Label>
          <Input
            id="item-qty"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-unit">单位</Label>
          <Input
            id="item-unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-low">低于</Label>
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
          添加
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  );
}
