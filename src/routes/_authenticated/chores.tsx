import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
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
  FREQUENCIES,
  type Chore,
  choresQuery,
  initials,
  memberToneClass,
  membersQuery,
  nextDueDate,
  parseDateKey,
  toDateKey,
} from "@/lib/household";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chore Board — Household Hub" },
      {
        name: "description",
        content:
          "Shared chore board for the whole household: see what is due today, who it belongs to and tick it off.",
      },
      { property: "og:title", content: "Chore Board — Household Hub" },
      {
        property: "og:description",
        content: "See what is due today, who it belongs to and tick it off.",
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

  const todayKey = toDateKey(new Date());

  const complete = useMutation({
    mutationFn: async (chore: Chore) => {
      const { error: logError } = await supabase.from("chore_completions").insert({
        chore_id: chore.id,
        member_id: chore.member_id,
        completed_on: todayKey,
      });
      if (logError) throw new Error(logError.message);

      const next = nextDueDate(chore.due_date, chore.frequency);
      const { error } = await supabase
        .from("chores")
        .update(next ? { due_date: next } : { archived: true })
        .eq("id", chore.id);
      if (error) throw new Error(error.message);
      return next;
    },
    onSuccess: (next) => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      toast.success(next ? "Done — back on the board next time" : "Done and cleared");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addChore = useMutation({
    mutationFn: async (values: {
      title: string;
      member_id: string;
      frequency: string;
      due_date: string;
    }) => {
      const { error } = await supabase.from("chores").insert(values);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      setShowForm(false);
      toast.success("Chore added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const visible = filter ? chores.filter((c) => c.member_id === filter) : chores;
  const overdue = visible.filter((c) => c.due_date < todayKey);
  const today = visible.filter((c) => c.due_date === todayKey);
  const upcoming = visible.filter((c) => c.due_date > todayKey);

  return (
    <AppShell
      title="Today at home"
      subtitle={new Date().toLocaleDateString("en-GB", {
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
          Everyone
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
              {initials(member.name)}
            </span>
            {member.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading the board…</p>
      ) : (
        <div className="mt-6 space-y-7">
          <ChoreGroup
            heading="Overdue"
            tone="destructive"
            chores={overdue}
            members={members}
            onComplete={(chore) => complete.mutate(chore)}
          />
          <ChoreGroup
            heading="Today"
            chores={today}
            members={members}
            onComplete={(chore) => complete.mutate(chore)}
          />
          <ChoreGroup
            heading="Coming up"
            chores={upcoming}
            members={members}
            onComplete={(chore) => complete.mutate(chore)}
          />
        </div>
      )}

      {showForm ? (
        <ChoreForm
          members={members}
          onCancel={() => setShowForm(false)}
          onSubmit={(values) => addChore.mutate(values)}
          pending={addChore.isPending}
        />
      ) : (
        <Button className="mt-8 w-full" size="lg" onClick={() => setShowForm(true)}>
          <Plus className="size-4" /> Add a chore
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
  tone,
}: {
  heading: string;
  chores: Chore[];
  members: { id: string; name: string; color: string }[];
  onComplete: (chore: Chore) => void;
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
                aria-label={`Mark ${chore.title} done`}
                onClick={() => onComplete(chore)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95"
              >
                <Check className="size-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{chore.title}</p>
                <p className="text-xs text-muted-foreground">
                  {member?.name ?? "Unassigned"} ·{" "}
                  {parseDateKey(chore.due_date).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                  {chore.notes ? ` · ${chore.notes}` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-[11px] font-semibold",
                  memberToneClass[member?.color ?? ""] ?? "bg-muted text-foreground",
                )}
              >
                {member ? initials(member.name) : "?"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
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
    member_id: string;
    frequency: string;
    due_date: string;
  }) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [frequency, setFrequency] = useState<string>("weekly");
  const [dueDate, setDueDate] = useState(toDateKey(new Date()));

  return (
    <form
      className="mt-8 space-y-4 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim() || !memberId) return;
        onSubmit({ title: title.trim(), member_id: memberId, frequency, due_date: dueDate });
      }}
    >
      <h2 className="text-lg font-semibold">New chore</h2>
      <div className="space-y-2">
        <Label htmlFor="chore-title">What needs doing</Label>
        <Input
          id="chore-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Mop the kitchen"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Who</Label>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick someone" />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>How often</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "once" ? "One-off" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="chore-due">First due</Label>
        <Input
          id="chore-due"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          Add chore
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
