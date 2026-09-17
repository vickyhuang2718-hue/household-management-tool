import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { AppShell, useCurrentUserId } from "@/components/household/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  COLOR_CHOICES,
  COLOR_LABELS,
  householdQuery,
  isAdminQuery,
  joinRequestsQuery,
  memberBadge,
  memberToneClass,
  membersQuery,
  profileQuery,
  type Member,
} from "@/lib/household";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "家庭设置 — 家事管家" },
      {
        name: "description",
        content: "修改家庭名称、自己的称呼、头像上的字和颜色。",
      },
      { property: "og:title", content: "家庭设置 — 家事管家" },
      { property: "og:description", content: "修改家庭名称和每个人的头像颜色。" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const userId = useCurrentUserId();
  const { data: profile } = useQuery(profileQuery(userId));
  const { data: members = [] } = useQuery(membersQuery);
  const { data: household } = useQuery(householdQuery);
  const { data: isAdmin = false } = useQuery(isAdminQuery(userId));
  const { data: joinRequests = [] } = useQuery({
    ...joinRequestsQuery,
    enabled: isAdmin,
  });

  const me = members.find((member) => member.id === profile?.member_id) ?? null;
  const [householdName, setHouseholdName] = useState("");
  const [myName, setMyName] = useState("");
  const [myInitial, setMyInitial] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (household?.name) setHouseholdName(household.name);
  }, [household?.name]);

  useEffect(() => {
    if (me) {
      setMyName(me.name);
      setMyInitial(memberBadge(me));
    }
  }, [me?.id, me?.name, me?.initial]);

  function refreshMembers() {
    queryClient.invalidateQueries({ queryKey: ["members"] });
  }

  async function saveHouseholdName(event: React.FormEvent) {
    event.preventDefault();
    if (!household) return;
    setSaving(true);
    const { error } = await supabase
      .from("households")
      .update({ name: householdName.trim() })
      .eq("id", household.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["households"] });
    toast.success("家庭名称已更新");
  }

  async function resolveRequest(id: string, approve: boolean) {
    const { error } = await supabase.rpc("resolve_join_request", {
      _request_id: id,
      _approve: approve,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["join_requests"] });
    refreshMembers();
    toast.success(approve ? "已通过，TA 可以进来了" : "已婉拒");
  }

  async function saveMyProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!me) return;
    const name = myName.trim();
    const initial = [...myInitial.trim()][0] ?? "";
    if (!name) return;
    setSaving(true);
    const { error } = await supabase
      .from("members")
      .update({ name, initial })
      .eq("id", me.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    refreshMembers();
    toast.success("已保存");
  }

  async function updateColor(member: Member, color: string) {
    const { error } = await supabase
      .from("members")
      .update({ color })
      .eq("id", member.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refreshMembers();
  }

  return (
    <AppShell title="家庭设置" subtitle="名称、称呼、颜色，都可以自己定">
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

      {isAdmin ? (
        <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">邀请码</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            把这串码发给家人，他们注册后输入就能申请加入。
          </p>
          <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-center text-xl font-semibold tracking-[0.3em] text-foreground">
            {household?.join_key ?? "—"}
          </p>

          <h3 className="mt-5 text-sm font-semibold text-foreground">加入申请</h3>
          {joinRequests.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">暂时没有新的申请。</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {joinRequests.map((request) => (
                <li
                  key={request.id}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <span className="flex-1 text-sm text-foreground">
                    {request.display_name}
                  </span>
                  <Button size="sm" onClick={() => resolveRequest(request.id, true)}>
                    通过
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resolveRequest(request.id, false)}
                  >
                    婉拒
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">我的资料</h2>
        {me ? (
          <>
            <div className="mt-3 flex items-center gap-3">
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-full text-lg font-semibold",
                  memberToneClass[me.color] ?? "bg-muted text-foreground",
                )}
              >
                {[...myInitial.trim()][0] ?? memberBadge(me)}
              </span>
              <span className="font-medium text-foreground">{myName || me.name}</span>
            </div>

            <form className="mt-4 space-y-3" onSubmit={saveMyProfile}>
              <div className="space-y-1.5">
                <Label htmlFor="my-name">称呼</Label>
                <Input
                  id="my-name"
                  value={myName}
                  onChange={(event) => setMyName(event.target.value)}
                  placeholder="你在家里的称呼"
                  maxLength={20}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="my-initial">头像上的字</Label>
                <Input
                  id="my-initial"
                  value={myInitial}
                  onChange={(event) =>
                    setMyInitial([...event.target.value.trim()][0] ?? "")
                  }
                  placeholder="一个字或一个字母"
                  className="w-20 text-center text-lg"
                />
              </div>
              <Button type="submit" disabled={saving}>
                保存
              </Button>
            </form>

            <p className="mt-4 text-xs font-medium text-muted-foreground">我的颜色</p>
            <ColorRow member={me} onPick={updateColor} />
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

      <Button
        variant="outline"
        className="mt-6 w-full"
        disabled={saving}
        onClick={async () => {
          await queryClient.cancelQueries();
          queryClient.clear();
          await supabase.auth.signOut();
          navigate({ to: "/auth", replace: true });
        }}
      >
        <LogOut className="size-4" /> 退出登录
      </Button>
    </AppShell>
  );
}

function ColorRow({
  member,
  onPick,
}: {
  member: Member;
  onPick: (member: Member, color: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {COLOR_CHOICES.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onPick(member, color)}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            member.color === color
              ? "border-primary text-foreground"
              : "border-border text-muted-foreground hover:border-primary",
          )}
        >
          <span
            className={cn("size-4 rounded-full", memberToneClass[color] ?? "bg-muted")}
          />
          {COLOR_LABELS[color]}
        </button>
      ))}
    </div>
  );
}
