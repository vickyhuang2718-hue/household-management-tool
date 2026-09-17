import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, useCurrentUserId } from "@/components/household/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  COLOR_CHOICES,
  COLOR_LABELS,
  EMOJI_CHOICES,
  householdQuery,
  isAdminQuery,
  memberToneClass,
  membersQuery,
  profileQuery,
} from "@/lib/household";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "家庭设置 — 家事管家" },
      {
        name: "description",
        content: "修改家庭名称，挑选属于自己的头像图标和颜色。",
      },
      { property: "og:title", content: "家庭设置 — 家事管家" },
      { property: "og:description", content: "修改家庭名称，挑选自己的头像图标。" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const { data: profile } = useQuery(profileQuery(userId));
  const { data: members = [] } = useQuery(membersQuery);
  const { data: household } = useQuery(householdQuery);
  const { data: isAdmin = false } = useQuery(isAdminQuery(userId));

  const me = members.find((member) => member.id === profile?.member_id) ?? null;
  const [householdName, setHouseholdName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (household?.name) setHouseholdName(household.name);
  }, [household?.name]);

  async function saveHouseholdName(event: React.FormEvent) {
    event.preventDefault();
    if (!household) return;
    setSaving(true);
    const { error } = await supabase
      .from("household_settings")
      .update({ name: householdName.trim() })
      .eq("id", household.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["household_settings"] });
    toast.success("家庭名称已更新");
  }

  async function updateMe(patch: { emoji?: string; color?: string }) {
    if (!me) return;
    const { error } = await supabase.from("members").update(patch).eq("id", me.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["members"] });
  }

  return (
    <AppShell title="家庭设置" subtitle="名称、头像，都可以自己定">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">家庭名称</h2>
        {isAdmin ? (
          <form className="mt-3 space-y-3" onSubmit={saveHouseholdName}>
            <Label htmlFor="household-name" className="sr-only">
              家庭名称
            </Label>
            <Input
              id="household-name"
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              placeholder="给这个家起个名字"
              maxLength={40}
              required
            />
            <Button type="submit" disabled={saving}>
              保存
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {household?.name ?? "—"} · 只有管理员可以修改名称。
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">我的头像</h2>
        {me ? (
          <>
            <div className="mt-3 flex items-center gap-3">
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-full text-lg",
                  memberToneClass[me.color] ?? "bg-muted text-foreground",
                )}
              >
                {me.emoji}
              </span>
              <span className="font-medium text-foreground">{me.name}</span>
            </div>

            <p className="mt-4 text-xs font-medium text-muted-foreground">图标</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EMOJI_CHOICES.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`选择图标 ${emoji}`}
                  onClick={() => updateMe({ emoji })}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl border text-lg transition-colors",
                    me.emoji === emoji
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary",
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs font-medium text-muted-foreground">颜色</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLOR_CHOICES.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateMe({ color })}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    me.color === color
                      ? "border-primary text-foreground"
                      : "border-border text-muted-foreground hover:border-primary",
                  )}
                >
                  <span
                    className={cn(
                      "size-4 rounded-full",
                      memberToneClass[color] ?? "bg-muted",
                    )}
                  />
                  {COLOR_LABELS[color]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">先选好你是家里的哪一位。</p>
        )}
      </section>

      {isAdmin ? (
        <p className="mt-4 text-xs text-muted-foreground">
          你是这个家的管理员（第一个注册的人）。
        </p>
      ) : null}
    </AppShell>
  );
}
