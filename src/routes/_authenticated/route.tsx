import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: state } = await supabase.rpc("my_onboarding_state");
    const household = (state as { household_id: string | null }[] | null)?.[0]
      ?.household_id;
    if (!household) throw redirect({ to: "/onboarding" });

    return { user: data.user };
  },
  component: () => <Outlet />,
});
