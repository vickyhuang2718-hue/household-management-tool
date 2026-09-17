import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  type Chore,
  choresQuery,
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
  const userId = useCurrentUserId();
  const { data: profile } = useQuery(profileQuery(userId));
  const myMemberId = profile?.member_id ?? null;

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

      const next = repeatAfter(todayKey, chore.frequency);
      if (next) {
        const { error: repeatError } = await supabase.from("chores").insert({
          title: chore.title,
          notes: chore.notes,
          frequency: chore.frequency,
          due_date: next,
          member_id: null,
        });
        if (repeatError) throw new Error(repeatError.message);
      }
      return next;
    },
    onSuccess: (next) => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      toast.success(next ? "完成啦，已新建下一次（待认领）" : "完成，已从板上移除");
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

  const visible = filter
    ? chores.filter((c) =>
        filter === "unassigned" ? !c.member_id : c.member_id === filter,
      )
    : chores;
  const overdue = visible.filter((c) => c.due_date < todayKey);
  const today = visible.filter((c) => c.due_date === todayKey);
  const upcoming = visible.filter((c) => c.due_date > todayKey);

  return (
    <AppShell
      title="今天的家事"
      subtitle={new Date().toLocaleDateString("zh-CN", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    >
      <div className="flex flex-wrap gap-2">
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
            onClick={() => setFilter(member.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-medium transition-colors",
              filter === member.id ? "bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
                memberToneClass[member.color] ?? "bg-muted text-foreground",
              )}
            >
              {memberBadge(member)}
            </span>
            {member.name}
          </button>
        ))}
      </div>

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
            heading="接下来"
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
      />

      {showForm ? (
        <ChoreForm
          members={members}
          onCancel={() => setShowForm(false)}
          onSubmit={(values) => addChore.mutate(values)}
          pending={addChore.isPending}
        />
      ) : (
        <Button className="mt-8 w-full" size="lg" onClick={() => setShowForm(true)}>
          <Plus className="size-4" /> 添加家务
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

function ChoreDetailDialog({
  chore,
  members,
  todayKey,
  onClose,
  onComplete,
  completing,
}: {
  chore: Chore | null;
  members: { id: string; name: string; color: string; initial: string }[];
  todayKey: string;
  onClose: () => void;
  onComplete: (chore: Chore) => void;
  completing: boolean;
}) {
  const member = members.find((m) => m.id === chore?.member_id);
  const next = chore ? repeatAfter(todayKey, chore.frequency) : null;

  return (
    <Dialog open={chore !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        {chore ? (
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
              <Button
                className="flex-1"
                disabled={completing}
                onClick={() => onComplete(chore)}
              >
                <Check className="size-4" /> 标记为完成
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                关闭
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
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
