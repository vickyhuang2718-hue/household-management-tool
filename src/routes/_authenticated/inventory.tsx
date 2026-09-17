import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, TriangleAlert, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell, useCurrentUserId } from "@/components/household/AppShell";
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
  CATEGORIES,
  CATEGORY_LABELS,
  LOCALE,
  STOCK_STATUSES,
  STOCK_STATUS_LABELS,
  type InventoryEdit,
  type InventoryItem,
  type StockStatus,
  inventoryEditsQuery,
  inventoryQuery,
  isAdminQuery,
  membersQuery,
  profileQuery,
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
  const [editing, setEditing] = useState<string | null>(null);

  const userId = useCurrentUserId();
  const { data: profile } = useQuery(profileQuery(userId));
  const { data: members = [] } = useQuery(membersQuery);
  const { data: isAdmin = false } = useQuery(isAdminQuery(userId));
  const { data: edits = [] } = useQuery({
    ...inventoryEditsQuery,
    enabled: isAdmin,
  });
  const myName =
    members.find((member) => member.id === profile?.member_id)?.name ?? "家人";

  const saveItem = useMutation({
    mutationFn: async ({
      item,
      name,
      note,
    }: {
      item: InventoryItem;
      name: string;
      note: string;
    }) => {
      const trimmedName = name.trim() || item.name;
      const trimmed = note.trim();
      const noteChanged = trimmed !== (item.note ?? "");
      const { error } = await supabase
        .from("inventory_items")
        .update({
          name: trimmedName,
          note: trimmed || null,
          ...(noteChanged
            ? {
                note_updated_at: trimmed ? new Date().toISOString() : null,
                note_updated_by: trimmed ? myName : null,
              }
            : {}),
        })
        .eq("id", item.id);
      if (error) throw new Error(error.message);

      if (trimmedName !== item.name) {
        const { error: logError } = await supabase.from("inventory_edits").insert({
          item_id: item.id,
          edited_by: userId,
          editor_name: myName,
          before_name: item.name,
          after_name: trimmedName,
        });
        if (logError) throw new Error(logError.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_edits"] });
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const undoEdit = useMutation({
    mutationFn: async (edit: InventoryEdit) => {
      const { error } = await supabase
        .from("inventory_items")
        .update({ name: edit.before_name })
        .eq("id", edit.item_id);
      if (error) throw new Error(error.message);
      const { error: markError } = await supabase
        .from("inventory_edits")
        .update({ undone: true, dismissed: true })
        .eq("id", edit.id);
      if (markError) throw new Error(markError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_edits"] });
      toast.success("已撤销这次改名");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dismissEdit = useMutation({
    mutationFn: async (edit: InventoryEdit) => {
      const { error } = await supabase
        .from("inventory_edits")
        .update({ dismissed: true })
        .eq("id", edit.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory_edits"] }),
    onError: (error: Error) => toast.error(error.message),
  });



  const setStatus = useMutation({
    mutationFn: async ({ item, status }: { item: InventoryItem; status: StockStatus }) => {
      const { error } = await supabase
        .from("inventory_items")
        .update({ status, reviewed_at: new Date().toISOString() })
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

  const lowCount = items.filter((item) => item.status !== "enough").length;

  const lastReview = items.reduce<string | null>((latest, item) => {
    if (!item.reviewed_at) return latest;
    return !latest || item.reviewed_at > latest ? item.reviewed_at : latest;
  }, null);

  return (
    <AppShell
      title="家中库存"
      subtitle={lowCount > 0 ? `有 ${lowCount} 样需要补货` : "存货都还充足"}
    >
      <p className="mb-5 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        上次盘点 Last review：
        {lastReview
          ? new Date(lastReview).toLocaleDateString(LOCALE, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "还没有记录"}
      </p>
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
                    const low = item.status !== "enough";
                    return (
                       <li
                        key={item.id}
                        className={cn(
                          "rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm",
                          low && "border-clay/50",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                          <p className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                            <span className="truncate">{item.name}</span>
                            {item.status === "out" ? (
                              <TriangleAlert
                                className="size-4 shrink-0 text-clay"
                                aria-label="没有了"
                              />
                            ) : null}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {STOCK_STATUSES.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setStatus.mutate({ item, status: option })}
                                className={cn(
                                  "rounded-full border border-border px-2.5 py-1 text-xs transition-colors",
                                  item.status === option
                                    ? "border-transparent bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted",
                                )}
                              >
                                {STOCK_STATUS_LABELS[option]}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setEditing(editing === item.id ? null : item.id)
                              }
                              aria-label="编辑"
                              className="rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        {item.note && editing !== item.id ? (
                          <div className="mt-2 rounded-lg bg-muted/60 px-2.5 py-1.5">
                            <p className="text-sm text-foreground">{item.note}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {item.note_updated_by ?? "某人"} ·{" "}
                              {item.note_updated_at
                                ? new Date(item.note_updated_at).toLocaleDateString(
                                    LOCALE,
                                    { month: "long", day: "numeric" },
                                  )
                                : ""}
                            </p>
                          </div>
                        ) : null}

                        {editing === item.id ? (
                          <ItemEditor
                            item={item}
                            pending={saveItem.isPending}
                            onCancel={() => setEditing(null)}
                            onSave={(name, note) =>
                              saveItem.mutate({ item, name, note })
                            }
                          />
                        ) : null}
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

function ItemEditor({
  item,
  onSave,
  onCancel,
  pending,
}: {
  item: InventoryItem;
  onSave: (name: string, note: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? "");
  return (
    <div className="mt-2 space-y-2">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="名称"
      />
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder="写点备注，比如牌子、放在哪、什么时候买的"
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => onSave(name, note)}>
          保存
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}
