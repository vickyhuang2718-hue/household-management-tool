import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ListChecks,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  householdQuery,
  memberBadge,
  memberToneClass,
  membersQuery,
  profileQuery,
} from "@/lib/household";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/chores", label: "家务", icon: ListChecks },
  { to: "/meals", label: "菜单", icon: CalendarDays },
  { to: "/inventory", label: "库存", icon: Package },
  { to: "/shopping", label: "采购", icon: ShoppingCart },
] as const;

export function useCurrentUserId() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  return userId;
}

export function AppShell({
  title,
  subtitle,
  children,
  pinned,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  pinned?: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const { data: profile } = useQuery(profileQuery(userId));
  const { data: members = [] } = useQuery(membersQuery);
  const { data: household } = useQuery(householdQuery);
  const [saving, setSaving] = useState(false);

  const me = members.find((member) => member.id === profile?.member_id);
  const needsMember = Boolean(userId) && profile !== undefined && !profile?.member_id;

  async function pickMember(memberId: string) {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, member_id: memberId });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("已记住你是谁");
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (needsMember) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-foreground">你是家里的哪一位？</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            选好之后，家务板会先显示属于你的那些。
          </p>
          <ul className="mt-6 space-y-2">
            {members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => pickMember(member.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary"
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full text-base",
                      memberToneClass[member.color] ?? "bg-muted text-foreground",
                    )}
                  >
                    {memberBadge(member)}
                  </span>
                  <span className="font-medium text-foreground">{member.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-6 w-full" onClick={signOut}>
            退出登录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-card/70 px-5 pt-8 pb-5 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {household?.name ?? "Household Hub"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-foreground">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {me ? (
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-base",
                  memberToneClass[me.color] ?? "bg-muted text-foreground",
                )}
                title={me.name}
              >
                {memberBadge(me)}
              </span>
            ) : null}
            <Button variant="ghost" size="icon" aria-label="家庭设置" asChild>
              <Link to="/settings">
                <Settings className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="退出登录" onClick={signOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {pinned ? (
        <div className="shrink-0 border-b border-border/60 bg-background">
          <div className="mx-auto w-full max-w-3xl px-4 py-2">{pinned}</div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-5">
        {children}
      </main>

      <nav className="z-20 shrink-0 border-t border-border bg-card/95 backdrop-blur">
        <ul className="mx-auto flex max-w-3xl">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                activeProps={{ "data-active": "true" }}
                className="flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground transition-colors data-[active=true]:text-primary"
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
