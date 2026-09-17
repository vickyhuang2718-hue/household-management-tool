import { Link } from "@tanstack/react-router";
import { CalendarDays, ListChecks, Package, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Chores", icon: ListChecks },
  { to: "/meals", label: "Meals", icon: CalendarDays },
  { to: "/inventory", label: "Pantry", icon: Package },
  { to: "/shopping", label: "Shopping", icon: ShoppingCart },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card/70 px-5 pt-8 pb-5 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Household Hub
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
        <ul className="mx-auto flex max-w-3xl">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
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
