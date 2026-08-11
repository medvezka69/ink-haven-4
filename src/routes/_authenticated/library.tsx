import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { BookCover, EmptyState } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SHELVES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Моя библиотека — Перо" },
      { name: "description", content: "Книги, которые ты читаешь, сохранил или уже прочитал." },
      { property: "og:title", content: "Моя библиотека — Перо" },
      { property: "og:description", content: "Твои полки и прогресс чтения." },
    ],
  }),
  component: LibraryPage,
});

type Item = {
  book_id: string;
  shelf: string;
  books: { id: string; title: string; cover_url: string | null; genre: string } | null;
};

function LibraryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const items = useQuery({
    queryKey: ["library", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("library_items")
        .select("book_id, shelf, books(id, title, cover_url, genre)")
        .eq("user_id", user!.id);
      return (data ?? []) as unknown as Item[];
    },
  });

  const progress = useQuery({
    queryKey: ["progress-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reading_progress")
        .select("book_id, percent")
        .eq("user_id", user!.id);
      return Object.fromEntries((data ?? []).map((p) => [p.book_id, p.percent]));
    },
  });

  const move = async (bookId: string, shelf: string) => {
    await supabase
      .from("library_items")
      .update({ shelf: shelf as "reading" | "saved" | "finished" | "want" })
      .eq("user_id", user!.id)
      .eq("book_id", bookId);
    qc.invalidateQueries({ queryKey: ["library"] });
  };

  return (
    <AppShell>
      <div className="container-page py-8">
        <h1 className="font-display text-3xl font-bold">📚 Моя библиотека</h1>

        <Tabs defaultValue="reading" className="mt-6">
          <TabsList className="flex-wrap">
            {SHELVES.map((s) => (
              <TabsTrigger key={s.key} value={s.key}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {SHELVES.map((s) => {
            const list = (items.data ?? []).filter((i) => i.shelf === s.key);
            return (
              <TabsContent key={s.key} value={s.key} className="mt-6">
                {list.length === 0 ? (
                  <EmptyState
                    title="Полка пустая"
                    text="Добавь книгу в библиотеку со страницы книги — и она появится здесь."
                    action={
                      <Button asChild>
                        <Link to="/read">Найти книгу</Link>
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((item) => {
                      const b = item.books;
                      if (!b) return null;
                      const pct = progress.data?.[b.id] ?? 0;
                      return (
                        <div key={item.book_id} className="surface-card flex gap-3 p-3">
                          <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md">
                            <BookCover title={b.title} coverUrl={b.cover_url} seed={b.id} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              to="/book/$bookId"
                              params={{ bookId: b.id }}
                              className="font-display block truncate font-semibold hover:text-accent"
                            >
                              {b.title}
                            </Link>
                            <p className="text-xs text-muted-foreground">{b.genre}</p>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{pct}% прочитано</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button asChild size="sm">
                                <Link to="/book/$bookId/read" params={{ bookId: b.id }}>
                                  Продолжить
                                </Link>
                              </Button>
                              <select
                                value={item.shelf}
                                onChange={(e) => move(b.id, e.target.value)}
                                aria-label="Полка"
                                className="rounded-md border border-border bg-card px-2 text-xs"
                              >
                                {SHELVES.map((sh) => (
                                  <option key={sh.key} value={sh.key}>
                                    {sh.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AppShell>
  );
}
