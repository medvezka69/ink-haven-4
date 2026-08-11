import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Новый пароль — Перо" },
      { name: "description", content: "Установи новый пароль для аккаунта в Пере." },
      { property: "og:title", content: "Новый пароль — Перо" },
      { property: "og:description", content: "Восстановление доступа к аккаунту." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Минимум 6 символов");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Пароль обновлён");
    navigate({ to: "/" });
  };

  return (
    <AppShell>
      <div className="container-page flex justify-center py-12">
        <form onSubmit={submit} className="surface-card w-full max-w-md space-y-4 p-7">
          <h1 className="font-display text-2xl font-bold">Новый пароль</h1>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Пароль</Label>
            <Input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            Сохранить
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
