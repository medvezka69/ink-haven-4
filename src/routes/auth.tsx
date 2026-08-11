import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход и регистрация — Перо" },
      { name: "description", content: "Войди в Перо, чтобы писать книги и читать чужие истории." },
      { property: "og:title", content: "Вход в Перо" },
      { property: "og:description", content: "Один аккаунт — и автор, и читатель." },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Минимум 2 символа").max(60),
  username: z
    .string()
    .trim()
    .min(3, "Минимум 3 символа")
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Только латиница, цифры и _"),
  email: z.string().trim().email("Некорректный email").max(255),
  password: z.string().min(6, "Минимум 6 символов").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    email: "",
    password: "",
    avatar: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) throw error;
        toast.success("С возвращением!");
        navigate({ to: "/" });
      } else if (mode === "up") {
        const parsed = signUpSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]!.message);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              username: form.username.trim(),
              display_name: form.displayName.trim(),
              avatar_url: form.avatar.trim() || null,
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Аккаунт создан");
          navigate({ to: "/" });
        } else {
          toast.success("Проверь почту — мы отправили письмо для подтверждения");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Письмо для восстановления отправлено");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не получилось");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="container-page flex justify-center py-12">
        <div className="surface-card w-full max-w-md p-7">
          <h1 className="font-display text-2xl font-bold">
            {mode === "in" ? "С возвращением" : mode === "up" ? "Создать аккаунт" : "Восстановление"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Один аккаунт — ты сразу и автор, и читатель.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "up" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Имя</Label>
                  <Input id="name" value={form.displayName} onChange={set("displayName")} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={set("username")}
                    placeholder="polina"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="avatar">Ссылка на аватар (необязательно)</Label>
                  <Input id="avatar" value={form.avatar} onChange={set("avatar")} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={set("email")} required />
            </div>
            {mode !== "reset" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={set("password")}
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Подождите…"
                : mode === "in"
                  ? "Войти"
                  : mode === "up"
                    ? "Зарегистрироваться"
                    : "Отправить письмо"}
            </Button>
          </form>

          <div className="mt-5 space-y-2 text-sm text-muted-foreground">
            {mode !== "in" && (
              <button className="hover:text-accent" onClick={() => setMode("in")}>
                У меня уже есть аккаунт
              </button>
            )}
            {mode !== "up" && (
              <button className="block hover:text-accent" onClick={() => setMode("up")}>
                Создать новый аккаунт
              </button>
            )}
            {mode !== "reset" && (
              <button className="block hover:text-accent" onClick={() => setMode("reset")}>
                Забыл пароль
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
