import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, ListChecks, Package, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "家事管家 — 一家人的家务与菜单" },
      {
        name: "description",
        content: "一家人共用的家务分工、每周菜单、家庭库存与采购清单，登录后即可同步。",
      },
      { property: "og:title", content: "家事管家 — 一家人的家务与菜单" },
      {
        property: "og:description",
        content: "家务分工、每周菜单、库存与采购清单，全家共用。",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: ListChecks, title: "家务分工", text: "谁做什么，今天到期一目了然。" },
  { icon: CalendarDays, title: "每周菜单", text: "三餐提前安排，宝宝那份单独盛出。" },
  { icon: Package, title: "家中库存", text: "米面粮油、纸巾尿布，快用完自动提醒。" },
  { icon: ShoppingCart, title: "采购清单", text: "手动添加，缺什么随手一点加入。" },
];

function Landing() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chores", replace: true });
      else setChecked(true);
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background px-5 py-16">
      <div className="mx-auto w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Household Hub
        </p>
        <h1 className="mt-2 text-4xl font-semibold leading-tight text-foreground">
          一家人的家事管家
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          家务、菜单、库存和采购，一家四口共用一处，人人都能随时更新。
        </p>

        <ul className="mt-8 space-y-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <Button asChild size="lg" className="mt-8 w-full" disabled={!checked}>
          <Link to="/auth">登录 / 注册</Link>
        </Button>
      </div>
    </div>
  );
}
