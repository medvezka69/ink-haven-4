import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Bookmark, Eye, Heart, Share2, Star, Flag } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BookCover, EmptyState } from "@/components/BookCard";
import { Comments } from "@/components/Comments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchBook, fetchChapters, notify } from "@/lib/data";
import { formatNumber, REPORT_REASONS } from "@/lib/constants";

export const Route = createFileRoute("/book/$bookId/")({
  head: () => ({
    meta: [
      { title: "Книга — Перо" },
      { name: "description", content: "Страница книги: описание, главы, отзывы и обсуждение." },
      { property: "og:title", content: "Книга на Пере" },
      { property: "og:description", content: "Читай книгу бесплатно и обсуждай её с автором." },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const { bookId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [beat, setBeat] = useState(false);

  const book = useQuery({ queryKey: ["book", bookId], queryFn: () => fetchBook(bookId) });
  const chapters = useQuery({
    queryKey: ["chapters", bookId],
    queryFn: () => fetchChapters(bookId, true),
  });

  useEffect(() => {
    supabase.rpc("increment_book_views", { _book_id: bookId });
  }, [bookId]);

  const liked = useQuery({
    queryKey: ["liked", user?.id, bookId],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("book_likes")
        .select("book_id")
        .eq("user_id", user!.id)
        .eq("book_id", bookId)
        .maybeSingle();
      return !!data;
    },
  });

  const inLibrary = useQuery({
    queryKey: ["in-library", user?.id, bookId],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("library_items")
        .select("shelf")
        .eq("user_id", user!.id)
        .eq("book_id", bookId)
        .maybeSingle();
      return data?.shelf ?? null;
    },
  });

  const myRating = useQuery({
    queryKey: ["my-rating", user?.id, bookId],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("book_ratings")
        .select("value")
        .eq("user_id", user!.id)
        .eq("book_id", bookId)
        .maybeSingle();
      return data?.value ?? 0;
    },
  });

  const following = useQuery({
    queryKey: ["is-following", user?.id, book.data?.author?.id],
    enabled: !!user && !!book.data?.author?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user!.id)
        .eq("following_id", book.data!.author!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const requireAuth = () => {
    if (!user) {
      toast.error("Войди, чтобы продолжить");
      return false;
    }
    return true;
  };

  const toggleLike = async () => {
    if (!requireAuth()) return;
    if (liked.data) {
      await supabase.from("book_likes").delete().eq("user_id", user!.id).eq("book_id", bookId);
    } else {
      await supabase.from("book_likes").insert({ user_id: user!.id, book_id: bookId });
      setBeat(true);
      setTimeout(() => setBeat(false), 400);
      await notify({
        userId: book.data!.author!.id,
        actorId: user!.id,
        type: "like",
        message: `Книге «${book.data!.title}» поставили лайк`,
        bookId,
      });
    }
    qc.invalidateQueries({ queryKey: ["liked"] });
    qc.invalidateQueries({ queryKey: ["book", bookId] });
  };

  const toggleLibrary = async () => {
    if (!requireAuth()) return;
    if (inLibrary.data) {
      await supabase.from("library_items").delete().eq("user_id", user!.id).eq("book_id", bookId);
    } else {
      await supabase
        .from("library_items")
        .insert({ user_id: user!.id, book_id: bookId, shelf: "saved" });
      await notify({
        userId: book.data!.author!.id,
        actorId: user!.id,
        type: "library",
        message: `Книгу «${book.data!.title}» добавили в библиотеку`,
        bookId,
      });
    }
    qc.invalidateQueries({ queryKey: ["in-library"] });
  };

  const rate = async (value: number) => {
    if (!requireAuth()) return;
    await supabase
      .from("book_ratings")
      .upsert({ user_id: user!.id, book_id: bookId, value }, { onConflict: "user_id,book_id" });
    qc.invalidateQueries({ queryKey: ["my-rating"] });
    qc.invalidateQueries({ queryKey: ["book", bookId] });
    toast.success("Спасибо за оценку");
  };

  const toggleFollow = async () => {
    if (!requireAuth()) return;
    const authorId = book.data!.author!.id;
    if (following.data) {
      await supabase.from("follows").delete().eq("follower_id", user!.id).eq("following_id", authorId);
    } else {
      await supabase.from("follows").insert({ follower_id: user!.id, following_id: authorId });
      await notify({ userId: authorId, actorId: user!.id, type: "follow", message: "У тебя новый подписчик" });
    }
    qc.invalidateQueries({ queryKey: ["is-following"] });
  };

  const sendReport = async () => {
    if (!requireAuth()) return;
    await supabase
      .from("reports")
      .insert({ reporter_id: user!.id, target_type: "book", target_id: bookId, reason });
    setReportOpen(false);
    toast.success("Жалоба отправлена");
  };

  if (book.isLoading) {
    return (
      <AppShell>
        <div className="container-page py-16 text-sm text-muted-foreground">Загрузка книги…</div>
      </AppShell>
    );
  }
  if (book.isError || !book.data) {
    return (
      <AppShell>
        <div className="container-page py-16">
          <EmptyState title="Книга недоступна" text="Возможно, она в черновиках или была удалена." />
        </div>
      </AppShell>
    );
  }

  const b = book.data;

  return (
    <AppShell>
      <div className="container-page py-8">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <div>
            <div className="aspect-[3/4] overflow-hidden rounded-xl shadow-[var(--shadow-book)]">
              <BookCover title={b.title} coverUrl={b.cover_url} seed={b.id} />
            </div>
            <div className="mt-4 space-y-2">
              <Button asChild className="w-full" size="lg">
                <Link to="/book/$bookId/read" params={{ bookId }}>
                  <BookOpen className="mr-1 size-4" /> Читать
                </Link>
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={toggleLike}>
                  <Heart className={`mr-1 size-4 ${beat ? "animate-heart" : ""} ${liked.data ? "fill-accent text-accent" : ""}`} />
                  {liked.data ? "Нравится" : "Лайк"}
                </Button>
                <Button variant="outline" onClick={toggleLibrary}>
                  <Bookmark className={`mr-1 size-4 ${inLibrary.data ? "fill-accent text-accent" : ""}`} />
                  {inLibrary.data ? "В библиотеке" : "Сохранить"}
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Ссылка скопирована");
                }}
              >
                <Share2 className="mr-1 size-4" /> Поделиться
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setReportOpen(true)}>
                <Flag className="mr-1 size-4" /> Пожаловаться
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{b.genre}</p>
            <h1 className="font-display mt-1 text-3xl font-bold sm:text-4xl">{b.title}</h1>
            {b.author && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  to="/u/$username"
                  params={{ username: b.author.username }}
                  className="text-sm font-medium hover:text-accent"
                >
                  {b.author.display_name}
                </Link>
                <Button size="sm" variant={following.data ? "outline" : "secondary"} onClick={toggleFollow}>
                  {following.data ? "Вы подписаны" : "Подписаться на автора"}
                </Button>
              </div>
            )}

            <p className="mt-5 max-w-2xl leading-relaxed">{b.description}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {b.raw.tags.map((t) => (
                <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs">
                  #{t}
                </span>
              ))}
              <span className="rounded-full bg-secondary px-3 py-1 text-xs">{b.raw.age_rating}</span>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs">{b.raw.language}</span>
            </div>

            <div className="mt-6 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Eye className="size-4" /> {formatNumber(b.views)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="size-4" /> {formatNumber(b.likes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Star className="size-4" /> {b.rating || "—"}
              </span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="size-4" /> {chapters.data?.length ?? 0} глав
              </span>
            </div>

            <div className="mt-6">
              <p className="mb-1 text-sm text-muted-foreground">Твоя оценка</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => rate(v)} aria-label={`Оценка ${v}`}>
                    <Star
                      className={`size-6 transition-transform hover:scale-110 ${
                        (myRating.data ?? 0) >= v ? "fill-accent text-accent" : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold">Содержание</h2>
              <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {(chapters.data ?? []).map((c, i) => (
                  <Link
                    key={c.id}
                    to="/book/$bookId/read"
                    params={{ bookId }}
                    search={{ chapter: c.id }}
                    className="flex items-center justify-between gap-4 bg-card p-4 text-sm hover:bg-muted"
                  >
                    <span>
                      {i + 1}. {c.title}
                    </span>
                    <span className="text-xs text-muted-foreground">опубликована</span>
                  </Link>
                ))}
                {chapters.data?.length === 0 && (
                  <p className="bg-card p-4 text-sm text-muted-foreground">
                    Автор ещё не опубликовал ни одной главы.
                  </p>
                )}
              </div>
            </section>

            <section className="mt-10">
              <h2 className="font-display mb-4 text-xl font-semibold">Комментарии</h2>
              <Comments bookId={bookId} authorId={b.author?.id ?? ""} />
            </section>
          </div>
        </div>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пожаловаться на книгу</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input type="radio" checked={reason === r} onChange={() => setReason(r)} />
                {r}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={sendReport}>Отправить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
