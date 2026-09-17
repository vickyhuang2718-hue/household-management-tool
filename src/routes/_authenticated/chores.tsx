import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Undo2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { AppShell, useCurrentUserId } from "@/components/household/AppShell";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  type Chore,
  type ChoreEdit,
  type ChoreFields,
  choreEditsQuery,
  choresQuery,
  isAdminQuery,
  memberBadge,
  memberToneClass,
  membersQuery,
  repeatAfter,
  parseDateKey,
  profileQuery,
  toDateKey,
} from "@/lib/household";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chores")({
  head: () => ({
    meta: [
      { title: "家务板 — 家事管家" },
      {
        name: "description",
        content:
          "全家共用的家务板：今天有哪些要做、归谁负责，做完一点即可勾掉。",
      },
      { property: "og:title", content: "家务板 — 家事管家" },
      {
        property: "og:description",
        content: "今天要做什么、归谁负责，做完勾掉。",
      },
    ],
  }),
  component: ChoreBoard,
});

function ChoreBoard() {
  const queryClient = useQueryClient();
  const { data: members = [] } = useQuery(membersQuery);
  const { data: chores = [], isLoading } = useQuery(choresQuery);
  const [filter, setFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Chore | null>(null);
  const [repeatFor, setRepeatFor] = useState<Chore | null>(null);
  const userId = useCurrentUserId();
  const { data: profile } = useQuery(profileQuery(userId));
  const myMemberId = profile?.member_id ?? null;
  const { data: isAdmin = false } = useQuery(isAdminQuery(userId));
  const { data: edits = [] } = useQuery(choreEditsQuery);
  const myName = members.find((m) => m.id === myMemberId)?.name ?? "某位家人";

  useEffect(() => {
    if (myMemberId) setFilter(myMemberId);
  }, [myMemberId]);

  const todayKey = toDateKey(new Date());

  const complete = useMutation({
    mutationFn: async (chore: Chore) => {
      const { error: logError } = await supabase.from("chore_completions").insert({
        chore_id: chore.id,
        member_id: chore.member_id,
        completed_on: todayKey,
      });
      if (logError) throw new Error(logError.message);

      const { error } = await supabase
        .from("chores")
        .update({ archived: true })
        .eq("id", chore.id);
      if (error) throw new Error(error.message);

      return chore;
    },
    onSuccess: (chore) => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      const next = repeatAfter(todayKey, chore.frequency);
      if (next) {
        setRepeatFor(chore);
        toast.success("完成啦，要不要安排下一次？");
      } else {
        toast.success("完成，已从板上移除");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createRepeat = useMutation({
    mutationFn: async (values: ChoreFields) => {
      const { error } = await supabase.from("chores").insert({
        title: values.title,
        notes: values.notes,
        frequency: values.frequency,
        due_date: values.due_date,
        member_id: values.member_id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      setRepeatFor(null);
      toast.success("已安排下一次");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addChore = useMutation({
    mutationFn: async (values: {
      title: string;
      member_id: string | null;
      frequency: string;
      due_date: string;
    }) => {
      const { error } = await supabase.from("chores").insert(values);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      setShowForm(false);
      toast.success("家务已添加");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveEdit = useMutation({
    mutationFn: async ({ chore, values }: { chore: Chore; values: ChoreFields }) => {
      const { error } = await supabase
        .from("chores")
        .update(values)
        .eq("id", chore.id);
      if (error) throw new Error(error.message);

      const before: ChoreFields = {
        title: chore.title,
        notes: chore.notes,
        member_id: chore.member_id,
        frequency: chore.frequency,
        due_date: chore.due_date,
      };
      const { error: logError } = await supabase.from("chore_edits").insert({
        chore_id: chore.id,
        edited_by: userId,
        editor_name: myName,
        before_data: before,
        after_data: values,
      });
      if (logError) throw new Error(logError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      queryClient.invalidateQueries({ queryKey: ["chore_edits"] });
      setSelected(null);
      toast.success("已保存修改，管理员会收到通知");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const undoEdit = useMutation({
    mutationFn: async (edit: ChoreEdit) => {
      const { error } = await supabase
        .from("chores")
        .update(edit.before_data)
        .eq("id", edit.chore_id);
      if (error) throw new Error(error.message);
      const { error: markError } = await supabase
        .from("chore_edits")
        .update({ undone: true, dismissed: true })
        .eq("id", edit.id);
      if (markError) throw new Error(markError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      queryClient.invalidateQueries({ queryKey: ["chore_edits"] });
      toast.success("已撤销这次修改");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dismissEdit = useMutation({
    mutationFn: async (edit: ChoreEdit) => {
      const { error } = await supabase
        .from("chore_edits")
        .update({ dismissed: true })
        .eq("id", edit.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chore_edits"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const dismissAllEdits = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("chore_edits")
        .update({ dismissed: true })
        .in("id", edits.map((edit) => edit.id));
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chore_edits"] });
      toast.success("已忽略全部通知");
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const visible = filter
    ? chores.filter((c) =>
        filter === "unassigned" ? !c.member_id : c.member_id === filter,
      )
    : chores;
  const overdue = visible.filter((c) => c.due_date < todayKey);
  const today = visible.filter((c) => c.due_date === todayKey);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + ((7 - weekEnd.getDay()) % 7)); // 本周日
  const weekEndKey = toDateKey(weekEnd);
  const thisWeek = visible.filter(
    (c) => c.due_date > todayKey && c.due_date <= weekEndKey,
  );
  const upcoming = visible.filter((c) => c.due_date > weekEndKey);

  const filterRow = (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&>button]:shrink-0">
      <button
        type="button"
        onClick={() => setFilter(null)}
        className={cn(
          "rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors",
          filter === null ? "bg-primary text-primary-foreground" : "bg-card",
        )}
      >
        全家
      </button>
      <button
        type="button"
        onClick={() => setFilter("unassigned")}
        className={cn(
          "rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors",
          filter === "unassigned" ? "bg-primary text-primary-foreground" : "bg-card",
        )}
      >
        待认领
      </button>
      {members.map((member) => (
        <button
          key={member.id}
          type="button"
          aria-label={`只看 ${member.name} 的家务`}
          onClick={() => setFilter(member.id)}
          className={cn(
            "flex items-center rounded-full border p-0.5 transition-colors",
            filter === member.id
              ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
              : "border-transparent",
          )}
        >
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-xs font-semibold",
              memberToneClass[member.color] ?? "bg-muted text-foreground",
            )}
          >
            {memberBadge(member)}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <AppShell
      title="今天的家事"
      pinned={filterRow}
      subtitle={new Date().toLocaleDateString("zh-CN", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    >
      {isAdmin && edits.length > 0 && (
        <section className="mb-5 space-y-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              家务改动通知
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
                  {edit.editor_name} 修改了「{edit.before_data.title}」
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {describeEdit(edit, members)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => undoEdit.mutate(edit)}
                disabled={undoEdit.isPending}
              >
                <Undo2 className="size-4" /> 撤销
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

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">正在加载家务板…</p>
      ) : (
        <div className="mt-6 space-y-7">
          <ChoreGroup
            heading="已逾期"
            tone="destructive"
            chores={overdue}
            members={members}
            onComplete={(chore) => complete.mutate(chore)}
            onOpen={setSelected}
          />
          <ChoreGroup
            heading="今天"
            chores={today}
            members={members}
            onComplete={(chore) => complete.mutate(chore)}
            onOpen={setSelected}
          />
          <ChoreGroup
            heading="本周剩余 · Rest of this week"
            chores={thisWeek}
            members={members}
            onComplete={(chore) => complete.mutate(chore)}
            onOpen={setSelected}
          />
          <ChoreGroup
            heading="以后 · Upcoming"
            chores={upcoming}
            members={members}
            onComplete={(chore) => complete.mutate(chore)}
            onOpen={setSelected}
          />
        </div>
      )}

      <ChoreDetailDialog
        chore={selected}
        members={members}
        todayKey={todayKey}
        onClose={() => setSelected(null)}
        onComplete={(chore) => {
          setSelected(null);
          complete.mutate(chore);
        }}
        completing={complete.isPending}
        onSave={(chore, values) => saveEdit.mutate({ chore, values })}
        saving={saveEdit.isPending}
      />

      {showForm ? (
        <ChoreForm
          members={members}
          onCancel={() => setShowForm(false)}
          onSubmit={(values) => addChore.mutate(values)}
          pending={addChore.isPending}
        />
      ) : (
        <Button
          className="fixed bottom-20 left-1/2 z-30 size-14 -translate-x-1/2 rounded-full shadow-lg"
          size="icon"
          aria-label="添加家务"
          onClick={() => setShowForm(true)}
        >
          <Plus className="size-6" />
        </Button>
      )}
    </AppShell>
  );
}

function ChoreGroup({
  heading,
  chores,
  members,
  onComplete,
  onOpen,
  tone,
}: {
  heading: string;
  chores: Chore[];
  members: { id: string; name: string; color: string; initial: string }[];
  onComplete: (chore: Chore) => void;
  onOpen: (chore: Chore) => void;
  tone?: "destructive";
}) {
  if (chores.length === 0) return null;

  return (
    <section>
      <h2
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.18em]",
          tone === "destructive" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {heading}
      </h2>
      <ul className="mt-3 space-y-2">
        {chores.map((chore) => {
          const member = members.find((m) => m.id === chore.member_id);
          return (
            <li
              key={chore.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm",
                tone === "destructive" && "border-destructive/40",
              )}
            >
              <button
                type="button"
                aria-label={`把「${chore.title}」标记为完成`}
                onClick={() => onComplete(chore)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95"
              >
                <Check className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => onOpen(chore)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate font-medium text-foreground">{chore.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {member?.name ?? "未分配"} ·{" "}
                  {parseDateKey(chore.due_date).toLocaleDateString("zh-CN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                  {chore.notes ? ` · ${chore.notes}` : ""}
                </p>
              </button>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  memberToneClass[member?.color ?? ""] ?? "bg-muted text-foreground",
                )}
              >
                {member ? memberBadge(member) : "?"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const FIELD_LABELS: Record<keyof ChoreFields, string> = {
  title: "名称",
  member_id: "负责人",
  notes: "备注",
  frequency: "重复",
  due_date: "到期日",
};

function describeEdit(edit: ChoreEdit, members: { id: string; name: string }[]) {
  const show = (key: keyof ChoreFields, value: ChoreFields[keyof ChoreFields]) => {
    if (!value) return key === "member_id" ? "待认领" : "空";
    if (key === "member_id")
      return members.find((m) => m.id === value)?.name ?? "某位家人";
    if (key === "frequency") return FREQUENCY_LABELS[value as string] ?? String(value);
    if (key === "due_date")
      return parseDateKey(value as string).toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
      });
    return String(value);
  };

  const keys = Object.keys(FIELD_LABELS) as (keyof ChoreFields)[];
  const changed = keys.filter((key) => edit.before_data[key] !== edit.after_data[key]);
  if (changed.length === 0) return "没有实质改动";
  return changed
    .map(
      (key) =>
        `${FIELD_LABELS[key]}：${show(key, edit.before_data[key])} → ${show(key, edit.after_data[key])}`,
    )
    .join("；");
}

function ChoreDetailDialog({
  chore,
  members,
  todayKey,
  onClose,
  onComplete,
  completing,
  onSave,
  saving,
}: {
  chore: Chore | null;
  members: { id: string; name: string; color: string; initial: string }[];
  todayKey: string;
  onClose: () => void;
  onComplete: (chore: Chore) => void;
  completing: boolean;
  onSave: (chore: Chore, values: ChoreFields) => void;
  saving: boolean;
}) {
  return (
    <Dialog open={chore !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        {chore ? (
          <ChoreDetailBody
            key={chore.id}
            chore={chore}
            members={members}
            todayKey={todayKey}
            onClose={onClose}
            onComplete={onComplete}
            completing={completing}
            onSave={onSave}
            saving={saving}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ChoreDetailBody({
  chore,
  members,
  todayKey,
  onClose,
  onComplete,
  completing,
  onSave,
  saving,
}: {
  chore: Chore;
  members: { id: string; name: string; color: string; initial: string }[];
  todayKey: string;
  onClose: () => void;
  onComplete: (chore: Chore) => void;
  completing: boolean;
  onSave: (chore: Chore, values: ChoreFields) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chore.title);
  const [memberId, setMemberId] = useState(chore.member_id ?? "unassigned");
  const [frequency, setFrequency] = useState(chore.frequency);
  const [dueDate, setDueDate] = useState(chore.due_date);
  const [notes, setNotes] = useState(chore.notes ?? "");

  const member = members.find((m) => m.id === chore.member_id);
  const next = repeatAfter(todayKey, chore.frequency);

  if (editing) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-left text-xl">修改家务</DialogTitle>
          <DialogDescription className="sr-only">修改家务详情</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            onSave(chore, {
              title: title.trim(),
              member_id: memberId === "unassigned" ? null : memberId,
              frequency,
              due_date: dueDate,
              notes: notes.trim() ? notes.trim() : null,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="edit-title">名称</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>谁来做</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">待认领</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>多久一次</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {FREQUENCY_LABELS[option] ?? option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-due">到期日</Label>
            <Input
              id="edit-due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">备注</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="可写可不写"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              保存
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              取消
            </Button>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-left text-xl">{chore.title}</DialogTitle>
        <DialogDescription className="sr-only">家务详情</DialogDescription>
      </DialogHeader>
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">负责</dt>
          <dd className="flex items-center gap-2">
            {member ? (
              <>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-[11px] font-semibold",
                    memberToneClass[member.color] ?? "bg-muted text-foreground",
                  )}
                >
                  {memberBadge(member)}
                </span>
                {member.name}
              </>
            ) : (
              "待认领"
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">到期日</dt>
          <dd>
            {parseDateKey(chore.due_date).toLocaleDateString("zh-CN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">重复</dt>
          <dd>{FREQUENCY_LABELS[chore.frequency] ?? chore.frequency}</dd>
        </div>
        <div className="border-t border-border pt-3">
          <dt className="text-muted-foreground">备注</dt>
          <dd className="mt-1 whitespace-pre-wrap">
            {chore.notes ? chore.notes : "没有备注"}
          </dd>
        </div>
        {next && (
          <p className="text-xs text-muted-foreground">
            勾掉后，下一次会安排在{" "}
            {parseDateKey(next).toLocaleDateString("zh-CN", {
              day: "numeric",
              month: "long",
            })}{" "}
            （待认领）。
          </p>
        )}
      </dl>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={completing} onClick={() => onComplete(chore)}>
          <Check className="size-4" /> 标记为完成
        </Button>
        <Button type="button" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-4" /> 修改
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          关闭
        </Button>
      </div>
    </>
  );
}

function ChoreForm({
  members,
  onCancel,
  onSubmit,
  pending,
}: {
  members: { id: string; name: string }[];
  onCancel: () => void;
  onSubmit: (values: {
    title: string;
    member_id: string | null;
    frequency: string;
    due_date: string;
  }) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [memberId, setMemberId] = useState("unassigned");
  const [frequency, setFrequency] = useState<string>("weekly");
  const [dueDate, setDueDate] = useState(toDateKey(new Date()));

  return (
    <form
      className="mt-8 space-y-4 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onSubmit({
          title: title.trim(),
          member_id: memberId === "unassigned" ? null : memberId,
          frequency,
          due_date: dueDate,
        });
      }}
    >
      <h2 className="text-lg font-semibold">新的家务</h2>
      <div className="space-y-2">
        <Label htmlFor="chore-title">要做什么</Label>
        <Input
          id="chore-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例如：拖厨房地板"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>谁来做</Label>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger>
              <SelectValue placeholder="选一个人" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">待认领</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>多久一次</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {FREQUENCY_LABELS[option] ?? option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        勾掉之后会自动生成下一次（按所选周期从完成当天算起，状态为「待认领」）。选「一次性（不重复）」就不会再生成。
      </p>
      <div className="space-y-2">
        <Label htmlFor="chore-due">第一次到期</Label>
        <Input
          id="chore-due"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
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
