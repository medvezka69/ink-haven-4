import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Уведомления — Перо" },
      { name: "description", content: "Новые подписчики, лайки, комментарии и главы авторов." },
      { property: "og:title", content: "Уведомления — Перо" },
      { property: "og:description", content: "Всё, что произошло вокруг твоих историй." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, message, is_read, created_at, book_id, profiles:actor_id(username, display_name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(60);
      return (data ?? []) as unknown as {
        id: string;
        type: string;
        message: string;
        is_read: boolean;
        created_at: string;
        book_id: string | null;
        profiles: { username: string; display_name: string } | null;
      }[];
    },
  });

  const markAll = async () => {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user!.id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <AppShell>
      <div className="container-page max-w-3xl py-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold">🔔 Уведомления</h1>
          <Button variant="outline" size="sm" onClick={markAll}>
            <Check className="mr-1 size-4" /> Прочитать все
          </Button>
        </div>

        <div className="mt-6 space-y-2">
          {list.data?.length === 0 && (
            <EmptyState title="Пока тихо" text="Здесь появятся лайки, подписки и комментарии." />
          )}
          {(list.data ?? []).map((n) => {
            const inner = (
              <div
                className={`surface-card flex items-start gap-3 p-4 ${
                  n.is_read ? "opacity-60" : ""
                }`}
              >
                <Bell className="mt-0.5 size-4 text-accent" />
                <div>
                  <p className="text-sm">
                    {n.profiles ? <strong>{n.profiles.display_name}</strong> : null} {n.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("ru-RU")}
                  </p>
                </div>
              </div>
            );
            return n.book_id ? (
              <Link key={n.id} to="/book/$bookId" params={{ bookId: n.book_id }} className="block">
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
