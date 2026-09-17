import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell, useCurrentUserId } from "@/components/household/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  toDateKey,
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
                note_updated_by: trimmed ? (profile?.member_id ?? myName) : null,
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

  const deleteItem = useMutation({
    mutationFn: async (item: InventoryItem) => {
      const { error } = await supabase
        .from("inventory_items")
        .update({ deleted: true } as never)
        .eq("id", item.id);
      if (error) throw new Error(error.message);
      const { error: logError } = await supabase.from("inventory_edits").insert({
        item_id: item.id,
        edited_by: userId,
        editor_name: myName,
        before_name: item.name,
        after_name: item.name,
        action: "delete",
      } as never);
      if (logError) throw new Error(logError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_edits"] });
      setEditing(null);
      toast.success("已删除");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const undoEdit = useMutation({
    mutationFn: async (edit: InventoryEdit) => {
      const { error } = await supabase
        .from("inventory_items")
        .update(
          (edit.action === "delete"
            ? { deleted: false }
            : { name: edit.before_name }) as never,
        )
        .eq("id", edit.item_id);
      if (error) throw new Error(error.message);
      const { error: markError } = await supabase
        .from("inventory_edits")
        .update({ undone: true, dismissed: true })
        .eq("id", edit.id);
      if (markError) throw new Error(markError.message);
    },
    onSuccess: (_data, edit) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_edits"] });
      toast.success(edit.action === "delete" ? "已恢复这样东西" : "已撤销这次改名");
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

  const dismissAllEdits = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("inventory_edits")
        .update({ dismissed: true })
        .in("id", edits.map((edit) => edit.id));
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_edits"] });
      toast.success("已忽略全部通知");
    },
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
    onSuccess: (_data, { item, status }) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      if (status !== "enough") setShopPrompt(item);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [shopPrompt, setShopPrompt] = useState<InventoryItem | null>(null);
  const [shopDays, setShopDays] = useState("1");

  const addToShopping = useMutation({
    mutationFn: async ({ item, days }: { item: InventoryItem; days: number }) => {
      const row: { name: string; category: string; buy_after?: string } = {
        name: item.name,
        category: item.category,
      };
      if (days > 0) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        row.buy_after = toDateKey(date);
      }
      const { error } = await supabase.from("shopping_items").insert(row as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { days }) => {
      queryClient.invalidateQueries({ queryKey: ["shopping_items"] });
      setShopPrompt(null);
      toast.success(days > 0 ? `已加入采购清单，${days} 天后出现` : "已加入采购清单");
    },
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

  const myReview = profile?.inventory_reviewed_on ?? "";

  const setMyReview = useMutation({
    mutationFn: async (value: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from("profiles")
        .update({ inventory_reviewed_on: value || null })
        .eq("id", userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="家中库存"
      subtitle={lowCount > 0 ? `有 ${lowCount} 样需要补货` : "存货都还充足"}
    >
      {isAdmin && edits.length > 0 && (
        <section className="mb-5 space-y-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              库存改名通知
            </h2>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => dismissAllEdits.mutate()}
              disabled={dismissAllEdits.isPending}
            >
              全部忽略
            </Button>
          </div>

          {edits.map((edit) => (
            <div
              key={edit.id}
              className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {edit.action === "delete"
                    ? `${edit.editor_name} 删除了「${edit.before_name}」`
                    : `${edit.editor_name} 把「${edit.before_name}」改成了「${edit.after_name}」`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(edit.created_at).toLocaleDateString(LOCALE, {
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => undoEdit.mutate(edit)}
                disabled={undoEdit.isPending}
              >
                <Undo2 className="size-4" />{" "}
                {edit.action === "delete" ? "恢复" : "撤销"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="忽略这条通知"
                onClick={() => dismissEdit.mutate(edit)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </section>
      )}

      <div className="mb-5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <Label htmlFor="my-review" className="shrink-0 text-xs font-normal">
          我上次盘点的日期：
        </Label>
        <Input
          id="my-review"
          type="date"
          value={myReview}
          onChange={(event) => setMyReview.mutate(event.target.value)}
          className="h-8 w-auto flex-1 text-xs"
        />
      </div>
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
                        <div className="flex items-center justify-between gap-x-3">
                          <button
                            type="button"
                            onClick={() => setEditing(item.id)}
                            className="min-w-0 flex-1 cursor-pointer text-left"
                            aria-label={`编辑 ${item.name}`}
                          >
                            <p className="truncate font-medium text-foreground underline-offset-2 hover:underline">
                              {item.name}
                            </p>
                          </button>
                          <Select
                            value={item.status}
                            onValueChange={(value) =>
                              setStatus.mutate({
                                item,
                                status: value as StockStatus,
                              })
                            }
                          >
                            <SelectTrigger
                              aria-label="库存状态"
                              className={cn(
                                "h-7 w-auto shrink-0 gap-1 rounded-full border px-2.5 text-xs",
                                item.status === "low"
                                  ? "border-transparent bg-ochre text-ochre-foreground"
                                  : item.status === "out"
                                    ? "border-transparent bg-clay text-clay-foreground"
                                    : "border-transparent bg-primary text-primary-foreground",
                                "[&>svg]:opacity-80",
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STOCK_STATUSES.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {STOCK_STATUS_LABELS[option]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {item.note && editing !== item.id ? (
                          <button
                            type="button"
                            onClick={() => setEditing(item.id)}
                            className="mt-2 block w-full cursor-pointer rounded-lg bg-muted/60 px-2.5 py-1.5 text-left"
                            aria-label={`编辑 ${item.name} 的备注`}
                          >
                            <p className="text-sm text-foreground">
                              {item.note}{" "}
                              <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                                ·{" "}
                                {members.find((member) => member.id === item.note_updated_by)
                                  ?.name ?? item.note_updated_by ?? "某人"}
                                {item.note_updated_at
                                  ? ` · ${new Date(item.note_updated_at).toLocaleDateString(
                                      LOCALE,
                                      { month: "long", day: "numeric" },
                                    )}`
                                  : ""}
                              </span>
                            </p>
                          </button>
                        ) : null}

                        {editing === item.id ? (
                          <ItemEditor
                            item={item}
                            pending={saveItem.isPending || deleteItem.isPending}
                            onCancel={() => setEditing(null)}
                            onSave={(name, note) =>
                              saveItem.mutate({ item, name, note })
                            }
                            onDelete={() => deleteItem.mutate(item)}
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
  onDelete,
  pending,
}: {
  item: InventoryItem;
  onSave: (name: string, note: string) => void;
  onCancel: () => void;
  onDelete: () => void;
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
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={pending} onClick={() => onSave(name, note)}>
          保存
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={onDelete}
          className="ml-auto text-clay hover:bg-clay/10 hover:text-clay"
        >
          <Trash2 className="size-4" /> 删除
        </Button>
      </div>
    </div>
  );
}
