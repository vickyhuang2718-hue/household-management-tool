import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  COLOR_CHOICES,
  COLOR_LABELS,
  memberBadge,
  memberToneClass,
  type Member,
} from "@/lib/household";
import { cn } from "@/lib/utils";

export function MyProfileEditor({ me }: { me: Member }) {
  const queryClient = useQueryClient();
  const [myName, setMyName] = useState(me.name);
  const [myInitial, setMyInitial] = useState(memberBadge(me));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMyName(me.name);
    setMyInitial(memberBadge(me));
  }, [me.id, me.name, me.initial]);

  function refreshMembers() {
    queryClient.invalidateQueries({ queryKey: ["members"] });
  }

  async function saveMyProfile(event: React.FormEvent) {
    event.preventDefault();
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

  async function updateColor(color: string) {
    const { error } = await supabase
      .from("members")
      .update({ color })
      .eq("id", me.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refreshMembers();
  }

  return (
    <div>
      <div className="flex items-center gap-3">
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
      <div className="mt-2 flex flex-wrap gap-2">
        {COLOR_CHOICES.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => updateColor(color)}
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
    </div>
  );
}
