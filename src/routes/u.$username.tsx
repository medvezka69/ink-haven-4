import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Share2, Mail } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BookCard, EmptyState } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchBooks, notify, toCard, type BookRow } from "@/lib/data";
import { formatNumber } from "@/lib/constants";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — автор на Пере` },
      {
        name: "description",
        content: `Профиль автора @${params.username}: книги, библиотека и подписчики.`,
      },
      { property: "og:title", content: `@${params.username} — автор на Пере` },
      { property: "og:description", content: "Книги, библиотека и подписчики автора." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState({ display_name: "", bio: "", avatar_url: "" });

  const profile = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, created_at")
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const profileId = profile.data?.id;
  const isMe = !!user && user.id === profileId;

  const stats = useQuery({
    queryKey: ["profile-stats", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [followers, following, books] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", profileId!),
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", profileId!),
        supabase
          .from("books")
          .select("id", { count: "exact", head: true })
          .eq("author_id", profileId!)
          .eq("status", "published"),
      ]);
      return {
        followers: followers.count ?? 0,
        following: following.count ?? 0,
        books: books.count ?? 0,
      };
    },
  });

  const isFollowing = useQuery({
    queryKey: ["is-following", user?.id, profileId],
    enabled: !!user && !!profileId && !isMe,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user!.id)
        .eq("following_id", profileId!)
        .maybeSingle();
      return !!data;
    },
  });

  const books = useQuery({
    queryKey: ["author-books", profileId, isMe],
    enabled: !!profileId,
    queryFn: async () => {
      if (isMe) {
        const { data } = await supabase
          .from("books")
          .select(
            "id, author_id, title, description, cover_url, genre, extra_genres, tags, age_rating, language, status, views, word_goal, created_at, updated_at, published_at, profiles:author_id (id, username, display_name, avatar_url), book_likes(count), book_ratings(value), chapters(count)",
          )
          .eq("author_id", profileId!)
          .order("updated_at", { ascending: false });
        return ((data ?? []) as unknown as BookRow[]).map(toCard);
      }
      return fetchBooks({ authorIds: [profileId!], sort: "new", limit: 30 });
    },
  });

  const library = useQuery({
    queryKey: ["profile-library", profileId],
    enabled: !!profileId && isMe,
    queryFn: async () => {
      const { data } = await supabase
        .from("library_items")
        .select("book_id, shelf, books(id, title, cover_url, genre)")
        .eq("user_id", profileId!);
      return data ?? [];
    },
  });

  const toggleFollow = async () => {
    if (!user) {
      toast.error("Войди, чтобы подписаться");
      return;
    }
    if (isFollowing.data) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profileId!);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: profileId! });
      await notify({
        userId: profileId!,
        actorId: user.id,
        type: "follow",
        message: "У тебя новый подписчик",
      });
    }
    qc.invalidateQueries({ queryKey: ["is-following"] });
    qc.invalidateQueries({ queryKey: ["profile-stats"] });
  };

  const saveProfile = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: draft.display_name,
        bio: draft.bio,
        avatar_url: draft.avatar_url || null,
      })
      .eq("id", user!.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Профиль обновлён");
    setEditOpen(false);
    profile.refetch();
  };

  if (profile.isLoading) {
    return (
      <AppShell>
        <div className="container-page py-16 text-sm text-muted-foreground">Загрузка…</div>
      </AppShell>
    );
  }

  if (!profile.data) {
    return (
      <AppShell>
        <div className="container-page py-16">
          <EmptyState title="Автор не найден" text="Возможно, профиль был удалён." />
        </div>
      </AppShell>
    );
  }

  const p = profile.data;

  return (
    <AppShell>
      <div className="container-page py-8">
        <div className="surface-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          {p.avatar_url ? (
            <img
              src={p.avatar_url}
              alt={`Аватар ${p.display_name}`}
              className="size-20 rounded-full object-cover"
            />
          ) : (
            <span className="font-display flex size-20 items-center justify-center rounded-full bg-secondary text-2xl font-semibold">
              {p.display_name.slice(0, 1)}
            </span>
          )}
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">{p.display_name}</h1>
            <p className="text-sm text-muted-foreground">@{p.username}</p>
            {p.bio && <p className="mt-2 max-w-xl text-sm">{p.bio}</p>}
            <div className="mt-3 flex gap-5 text-sm text-muted-foreground">
              <span>
                <strong className="text-foreground">{formatNumber(stats.data?.followers ?? 0)}</strong>{" "}
                подписчиков
              </span>
              <span>
                <strong className="text-foreground">{formatNumber(stats.data?.following ?? 0)}</strong>{" "}
                подписок
              </span>
              <span>
                <strong className="text-foreground">{formatNumber(stats.data?.books ?? 0)}</strong>{" "}
                книг
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isMe ? (
              <Dialog open={editOpen} onOpenChange={(o) => {
                setEditOpen(o);
                if (o)
                  setDraft({
                    display_name: p.display_name,
                    bio: p.bio,
                    avatar_url: p.avatar_url ?? "",
                  });
              }}>
                <DialogTrigger asChild>
                  <Button>Редактировать профиль</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Профиль</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="dn">Имя</Label>
                      <Input
                        id="dn"
                        value={draft.display_name}
                        onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bio">О себе</Label>
                      <Textarea
                        id="bio"
                        value={draft.bio}
                        onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="av">Ссылка на аватар</Label>
                      <Input
                        id="av"
                        value={draft.avatar_url}
                        onChange={(e) => setDraft({ ...draft, avatar_url: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={saveProfile}>Сохранить</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <>
                <Button onClick={toggleFollow} variant={isFollowing.data ? "outline" : "default"}>
                  {isFollowing.data ? "Вы подписаны" : "Подписаться"}
                </Button>
                <Button variant="outline" asChild>
                  <a href={`mailto:?subject=Пишу тебе из Пера`}>
                    <Mail className="mr-1 size-4" /> Написать
                  </a>
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Ссылка на профиль скопирована");
              }}
            >
              <Share2 className="size-4" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="books" className="mt-8">
          <TabsList>
            <TabsTrigger value="books">Книги</TabsTrigger>
            {isMe && <TabsTrigger value="library">Библиотека</TabsTrigger>}
            <TabsTrigger value="about">О себе</TabsTrigger>
          </TabsList>

          <TabsContent value="books" className="mt-6">
            {books.data?.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {books.data.map((b, i) => (
                  <BookCard key={b.id} book={b} index={i} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={isMe ? "У тебя пока нет книг" : "Здесь пока пусто"}
                text={
                  isMe
                    ? "Создай первую историю — возможно, её кто-то будет читать уже сегодня."
                    : "Автор ещё не опубликовал ни одной книги."
                }
                action={
                  isMe ? (
                    <Button asChild>
                      <Link to="/write">Создать книгу</Link>
                    </Button>
                  ) : undefined
                }
              />
            )}
          </TabsContent>

          {isMe && (
            <TabsContent value="library" className="mt-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(library.data ?? []).map((item) => {
                  const b = item.books as unknown as { id: string; title: string; genre: string };
                  return (
                    <Link
                      key={item.book_id}
                      to="/book/$bookId"
                      params={{ bookId: b.id }}
                      className="surface-card p-4"
                    >
                      <p className="font-medium">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.genre}</p>
                    </Link>
                  );
                })}
                {library.data?.length === 0 && (
                  <p className="text-sm text-muted-foreground">Библиотека пока пуста.</p>
                )}
              </div>
            </TabsContent>
          )}

          <TabsContent value="about" className="mt-6">
            <div className="surface-card p-6">
              <p className="text-sm whitespace-pre-line">
                {p.bio || "Автор пока ничего не рассказал о себе."}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
