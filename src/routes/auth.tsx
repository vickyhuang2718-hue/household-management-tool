import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "登录 — 家事管家" },
      { name: "description", content: "用邮箱和密码登录家事管家，与家人共用家务与菜单。" },
      { property: "og:title", content: "登录 — 家事管家" },
      { property: "og:description", content: "用邮箱和密码登录，与家人共用家务与菜单。" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chores", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/chores", replace: true });
        } else {
          setSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/chores", replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "出错了，请再试一次");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-foreground">请查收邮箱</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            我们给 {email} 发了一封确认邮件，点击里面的链接就能完成注册并登录。
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={() => setSent(false)}>
            返回登录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Household Hub
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">
          {mode === "signin" ? "登录家事管家" : "注册新账号"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "家里的安排全都在这儿。"
            : "注册后选择你是家里的哪一位，家务会优先显示你的。"}
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
            {mode === "signup" ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                密码提示：至少 6 个字符。请避免常见密码（如 123456、password、生日或手机号）——这些密码已被泄露，会被系统拒绝。建议用一句只有你知道的短句，混合大小写字母和数字，例如「WoJia2SuiBao2026!」。
              </p>
            ) : null}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {mode === "signin" ? "登录" : "注册"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-6 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "还没有账号？点此注册" : "已有账号？点此登录"}
        </button>
      </div>
    </div>
  );
}
