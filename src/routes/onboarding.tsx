import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { onboardingQuery } from "@/lib/household";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "加入家庭 — 家事管家" },
      {
        name: "description",
        content: "新建一个家庭，或者用管理员给你的邀请码申请加入。",
      },
      { property: "og:title", content: "加入家庭 — 家事管家" },
      { property: "og:description", content: "新建家庭或用邀请码申请加入。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: state, isLoading, refetch } = useQuery(onboardingQuery);

  const [tab, setTab] = useState<"create" | "join">("create");
  const [householdName, setHouseholdName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joinKey, setJoinKey] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (state?.household_id) navigate({ to: "/chores", replace: true });
  }, [state?.household_id, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function createHousehold(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const { error } = await supabase.rpc("create_household", {
      _name: householdName,
      _display_name: displayName,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.clear();
    toast.success("家庭已创建，你就是管理员");
    navigate({ to: "/chores", replace: true });
  }

  async function requestJoin(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const { error } = await supabase.rpc("request_join_household", {
      _key: joinKey,
      _display_name: displayName,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("申请已发送，等管理员通过");
    refetch();
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">正在加载…</p>
      </div>
    );
  }

  if (state?.join_status === "pending") {
    return (
      <Shell>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">等待通过</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          申请已经发给这个家的管理员了。管理员点一下「通过」，你就能看到家里的家务、菜单和库存。
        </p>
        <Button className="mt-6 w-full" onClick={() => refetch()}>
          刷新看看
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={signOut}>
          退出登录
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">先安个家</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        新建一个家庭，或者用管理员给你的邀请码申请加入。
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
        {(["create", "join"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              "rounded-full px-3 py-2 text-sm font-medium transition-colors " +
              (tab === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground")
            }
          >
            {key === "create" ? "新建家庭" : "加入家庭"}
          </button>
        ))}
      </div>

      {state?.join_status === "declined" ? (
        <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          上一次的申请没有通过，可以再确认一下邀请码。
        </p>
      ) : null}

      {tab === "create" ? (
        <form className="mt-6 space-y-4" onSubmit={createHousehold}>
          <div className="space-y-2">
            <Label htmlFor="household-name">家庭名称</Label>
            <Input
              id="household-name"
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              placeholder="例如：我们的家 Our home"
              maxLength={40}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-display-name">你的称呼</Label>
            <Input
              id="create-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="例如：妻子"
              maxLength={20}
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            创建家庭
          </Button>
          <p className="text-xs text-muted-foreground">
            创建后你会成为管理员，可以在「设置」里看到邀请码，发给家人加入。
          </p>
        </form>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={requestJoin}>
          <div className="space-y-2">
            <Label htmlFor="join-key">邀请码</Label>
            <Input
              id="join-key"
              value={joinKey}
              onChange={(event) => setJoinKey(event.target.value.toUpperCase())}
              placeholder="管理员给你的 6 位码"
              className="tracking-[0.3em]"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="join-display-name">你的称呼</Label>
            <Input
              id="join-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="例如：公公"
              maxLength={20}
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            申请加入
          </Button>
        </form>
      )}

      <Button variant="ghost" className="mt-4 w-full" onClick={signOut}>
        退出登录
      </Button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Household Hub
        </p>
        {children}
      </div>
    </div>
  );
}
