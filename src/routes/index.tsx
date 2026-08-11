import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Feather } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BookCard, BookCardSkeleton, BookCover, EmptyState } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { GENRES, GENRE_EMOJI } from "@/lib/constants";
import { fetchBooks } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Перо — истории, которые хочется писать и читать" },
      {
        name: "description",
        content:
          "Бесплатная платформа для писателей и читателей: редактор книг, библиотека, режим чтения и сообщество авторов.",
      },
      { property: "og:title", content: "Перо — платформа для писателей и читателей" },
      {
        property: "og:description",
        content: "Создавай свои книги, находи читателей и открывай новые истории.",
      },
    ],
  }),
  component: Index,
});

function Section({
  title,
  emoji,
  children,
  action,
}: {
  title: string;
  emoji: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="container-page py-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl font-semibold sm:text-2xl">
          <span className="mr-2">{emoji}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  );
}

function Index() {
  const { user } = useAuth();

  const popular = useQuery({
    queryKey: ["books", "popular"],
    queryFn: () => fetchBooks({ sort: "popular", limit: 10 }),
  });
  const fresh = useQuery({
    queryKey: ["books", "new"],
    queryFn: () => fetchBooks({ sort: "new", limit: 5 }),
  });
  const continueReading = useQuery({
    queryKey: ["continue", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reading_progress")
        .select("percent, book_id, books(id, title, cover_url, genre)")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });
  const followed = useQuery({
    queryKey: ["followed-books", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      const ids = (data ?? []).map((f) => f.following_id);
      if (!ids.length) return [];
      return fetchBooks({ authorIds: ids, sort: "new", limit: 5 });
    },
  });

  return (
    <AppShell>
      <section className="container-page relative overflow-hidden py-14 sm:py-24">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="animate-rise max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Feather className="size-3.5" /> Бесплатно для авторов и читателей
          </span>
          <h1 className="font-display mt-5 text-4xl leading-[1.1] font-bold sm:text-6xl">
            Истории, которые хочется писать.
            <br />
            <span className="text-accent">Истории, которые хочется читать.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Создавай свои книги, находи читателей и открывай новые истории.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/write">
                Начать писать <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/read">Найти книгу</Link>
            </Button>
          </div>
        </div>
      </section>

      <Section
        title="Сейчас популярно"
        emoji="🔥"
        action={
          <Link to="/read" className="text-sm text-accent hover:underline">
            Весь каталог
          </Link>
        }
      >
        {popular.isLoading ? (
          <Grid>
            {Array.from({ length: 5 }).map((_, i) => (
              <BookCardSkeleton key={i} />
            ))}
          </Grid>
        ) : popular.data?.length ? (
          <Grid>
            {popular.data.slice(0, 10).map((b, i) => (
              <BookCard key={b.id} book={b} index={i} />
            ))}
          </Grid>
        ) : (
          <EmptyState
            title="Здесь пока тихо"
            text="Ни одной опубликованной книги. Возможно, первая будет твоей."
            action={
              <Button asChild>
                <Link to="/write">Создать книгу</Link>
              </Button>
            }
          />
        )}
      </Section>

      <Section title="Новые книги" emoji="✨">
        <Grid>
          {(fresh.data ?? []).map((b, i) => (
            <BookCard key={b.id} book={b} index={i} />
          ))}
        </Grid>
      </Section>

      {user && (continueReading.data?.length ?? 0) > 0 && (
        <Section title="Продолжить чтение" emoji="📖">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(continueReading.data ?? []).map((item) => {
              const book = item.books as unknown as {
                id: string;
                title: string;
                cover_url: string | null;
                genre: string;
              } | null;
              if (!book) return null;
              return (
                <Link
                  key={item.book_id}
                  to="/book/$bookId/read"
                  params={{ bookId: book.id }}
                  className="surface-card flex gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-lift)]"
                >
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md">
                    <BookCover title={book.title} coverUrl={book.cover_url} seed={book.id} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate font-semibold">{book.title}</p>
                    <p className="text-xs text-muted-foreground">{book.genre}</p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-accent" style={{ width: `${item.percent}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.percent}% прочитано · Продолжить
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {user && (followed.data?.length ?? 0) > 0 && (
        <Section title="Авторы, на которых я подписан" emoji="❤️">
          <Grid>
            {(followed.data ?? []).map((b, i) => (
              <BookCard key={b.id} book={b} index={i} />
            ))}
          </Grid>
        </Section>
      )}

      <Section title="Жанры" emoji="🎭">
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <Link
              key={g}
              to="/read"
              search={{ genre: g }}
              className="surface-card px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
            >
              <span className="mr-1.5">{GENRE_EMOJI[g]}</span>
              {g}
            </Link>
          ))}
        </div>
      </Section>
    </AppShell>
  );
}
