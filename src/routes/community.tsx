import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { BookCard } from "@/components/BookCard";
import { fetchBooks } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/constants";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Сообщество — Перо" },
      {
        name: "description",
        content: "Популярные авторы, свежие обсуждения и активные читатели платформы Перо.",
      },
      { property: "og:title", content: "Сообщество — Перо" },
      { property: "og:description", content: "Авторы, книги и разговоры вокруг историй." },
    ],
  }),
  component: Community,
});

function Community() {
  const authors = useQuery({
    queryKey: ["community", "authors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, books(count), followers:follows!follows_following_fk(count)")
        .limit(12);
      return (data ?? []) as unknown as {
        id: string;
        username: string;
        display_name: string;
        bio: string;
        books: { count: number }[];
        followers: { count: number }[];
      }[];
    },
  });

  const discussions = useQuery({
    queryKey: ["community", "comments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("id, body, created_at, book_id, books(title), profiles:user_id(username, display_name)")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as unknown as {
        id: string;
        body: string;
        book_id: string;
        books: { title: string } | null;
        profiles: { username: string; display_name: string } | null;
      }[];
    },
  });

  const books = useQuery({
    queryKey: ["community", "books"],
    queryFn: () => fetchBooks({ sort: "popular", limit: 5 }),
  });

  return (
    <AppShell>
      <div className="container-page py-8">
        <h1 className="font-display text-3xl font-bold">👥 Сообщество</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Люди, которые пишут и читают здесь прямо сейчас.
        </p>

        <section className="mt-8">
          <h2 className="font-display mb-4 text-xl font-semibold">Авторы</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(authors.data ?? [])
              .filter((a) => (a.books?.[0]?.count ?? 0) > 0)
              .map((a) => (
                <Link
                  key={a.id}
                  to="/u/$username"
                  params={{ username: a.username }}
                  className="surface-card flex gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold">
                    {a.display_name.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{a.username}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.bio}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatNumber(a.books?.[0]?.count ?? 0)} книг ·{" "}
                      {formatNumber(a.followers?.[0]?.count ?? 0)} подписчиков
                    </p>
                  </div>
                </Link>
              ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display mb-4 text-xl font-semibold">Популярные книги</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {(books.data ?? []).map((b, i) => (
              <BookCard key={b.id} book={b} index={i} />
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display mb-4 text-xl font-semibold">Обсуждения</h2>
          <div className="space-y-3">
            {(discussions.data ?? []).map((c) => (
              <Link
                key={c.id}
                to="/book/$bookId"
                params={{ bookId: c.book_id }}
                className="surface-card block p-4 transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <p className="text-sm">{c.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.profiles?.display_name ?? "Читатель"} · о книге «{c.books?.title}»
                </p>
              </Link>
            ))}
            {discussions.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">Пока никто ничего не написал.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
