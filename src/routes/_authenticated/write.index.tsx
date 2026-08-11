import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookPlus, PenLine, Eye } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { BookCover, EmptyState } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GENRES, GENRE_EMOJI, formatNumber } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/write/")({
  head: () => ({
    meta: [
      { title: "Кабинет автора — Перо" },
      { name: "description", content: "Создавай книги, пиши главы и следи за статистикой." },
      { property: "og:title", content: "Кабинет автора — Перо" },
      { property: "og:description", content: "Твоя мастерская: черновики, главы, публикации." },
    ],
  }),
  component: WriteHome,
});

function WriteHome() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<string>(GENRES[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const books = useQuery({
    queryKey: ["my-books", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("books")
        .select("id, title, cover_url, genre, status, views, updated_at")
        .eq("author_id", user!.id)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("books")
      .insert({
        author_id: user!.id,
        title: title.trim(),
        genre,
        description: description.trim(),
        status: "draft",
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Не удалось создать книгу");
      return;
    }
    await supabase.from("chapters").insert({
      book_id: data.id,
      title: "Глава 1",
      content: "<p></p>",
      position: 1,
      is_published: false,
    });
    qc.invalidateQueries({ queryKey: ["my-books"] });
    setOpen(false);
    setTitle("");
    setDescription("");
    navigate({ to: "/write/$bookId", params: { bookId: data.id } });
  };

  return (
    <AppShell>
      <div className="container-page py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Кабинет автора</h1>
            <p className="text-sm text-muted-foreground">
              Здесь живут твои черновики и опубликованные истории.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <BookPlus className="mr-2 size-4" /> Новая книга
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новая книга</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Название книги"
                />
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  aria-label="Жанр"
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                >
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {GENRE_EMOJI[g]} {g}
                    </option>
                  ))}
                </select>
                <Textarea
                  value={description}
                  maxLength={1000}
                  rows={4}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="О чём эта книга?"
                />
              </div>
              <DialogFooter>
                <Button onClick={create} disabled={saving || !title.trim()}>
                  Создать и открыть редактор
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(books.data ?? []).map((b) => (
            <div key={b.id} className="surface-card flex gap-3 p-3">
              <div className="h-32 w-22 shrink-0 overflow-hidden rounded-md" style={{ width: 88 }}>
                <BookCover title={b.title} coverUrl={b.cover_url} seed={b.id} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display truncate font-semibold">{b.title}</p>
                <p className="text-xs text-muted-foreground">
                  {b.genre} · {b.status === "draft" ? "Черновик" : b.status === "unlisted" ? "По ссылке" : "Опубликована"}
                </p>
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3" /> {formatNumber(b.views)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/write/$bookId" params={{ bookId: b.id }}>
                      <PenLine className="mr-1 size-3.5" /> Писать
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/book/$bookId" params={{ bookId: b.id }}>
                      Страница
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {books.data?.length === 0 && (
          <div className="mt-8">
            <EmptyState
              title="Ещё ни одной книги"
              text="Начни с названия — остальное придёт по дороге."
              action={<Button onClick={() => setOpen(true)}>Создать книгу</Button>}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
