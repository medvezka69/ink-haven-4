import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Heart, Pin, Reply, Trash2, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REPORT_REASONS } from "@/lib/constants";

type CommentRow = {
  id: string;
  body: string;
  parent_id: string | null;
  user_id: string;
  is_pinned: boolean;
  created_at: string;
  chapter_id: string | null;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
  comment_likes: { count: number }[];
};

export function Comments({
  bookId,
  chapterId,
  authorId,
}: {
  bookId: string;
  chapterId?: string | null;
  authorId: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);

  const key = ["comments", bookId, chapterId ?? "book"];

  const comments = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase
        .from("comments")
        .select(
          "id, body, parent_id, user_id, is_pinned, created_at, chapter_id, profiles:user_id(username, display_name, avatar_url), comment_likes(count)",
        )
        .eq("book_id", bookId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      q = chapterId ? q.eq("chapter_id", chapterId) : q.is("chapter_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CommentRow[];
    },
  });

  const send = async () => {
    if (!user) {
      toast.error("Войди, чтобы комментировать");
      return;
    }
    const text = body.trim();
    if (!text || text.length > 2000) {
      toast.error("Комментарий пустой или слишком длинный");
      return;
    }
    const { error } = await supabase.from("comments").insert({
      book_id: bookId,
      chapter_id: chapterId ?? null,
      user_id: user.id,
      parent_id: replyTo,
      body: text,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await notify({
      userId: authorId,
      actorId: user.id,
      type: "comment",
      message: "Новый комментарий к твоей книге",
      bookId,
    });
    setBody("");
    setReplyTo(null);
    qc.invalidateQueries({ queryKey: key });
  };

  const like = async (commentId: string) => {
    if (!user) {
      toast.error("Войди, чтобы ставить лайки");
      return;
    }
    const { error } = await supabase
      .from("comment_likes")
      .insert({ comment_id: commentId, user_id: user.id });
    if (error) {
      await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);
    }
    qc.invalidateQueries({ queryKey: key });
  };

  const remove = async (id: string) => {
    await supabase.from("comments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: key });
  };

  const pin = async (id: string, pinned: boolean) => {
    await supabase.from("comments").update({ is_pinned: !pinned }).eq("id", id);
    qc.invalidateQueries({ queryKey: key });
  };

  const sendReport = async () => {
    if (!user || !reportTarget) return;
    await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: "comment",
      target_id: reportTarget,
      reason,
    });
    setReportTarget(null);
    toast.success("Жалоба отправлена модераторам");
  };

  const roots = (comments.data ?? []).filter((c) => !c.parent_id);
  const childrenOf = (id: string) => (comments.data ?? []).filter((c) => c.parent_id === id);

  const renderComment = (c: CommentRow, nested = false) => (
    <div key={c.id} className={`surface-card p-4 ${nested ? "ml-6 mt-2" : ""}`}>
      {c.is_pinned && (
        <p className="mb-2 flex items-center gap-1 text-xs text-accent font-medium">
          <Pin className="size-3.5" /> Автор закрепил этот комментарий
        </p>
      )}
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
          {c.profiles?.display_name.slice(0, 1) ?? "?"}
        </span>
        {c.profiles ? (
          <Link
            to="/u/$username"
            params={{ username: c.profiles.username }}
            className="text-sm font-medium hover:text-accent"
          >
            {c.profiles.display_name}
          </Link>
        ) : (
          <span className="text-sm font-medium">Читатель</span>
        )}
        <span className="text-xs text-muted-foreground">
          {new Date(c.created_at).toLocaleDateString("ru-RU")}
        </span>
      </div>
      <p className="mt-2 text-sm whitespace-pre-line">{c.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <button className="inline-flex items-center gap-1 hover:text-accent" onClick={() => like(c.id)}>
          <Heart className="size-3.5" /> {c.comment_likes?.[0]?.count ?? 0}
        </button>
        <button
          className="inline-flex items-center gap-1 hover:text-accent"
          onClick={() => setReplyTo(c.id)}
        >
          <Reply className="size-3.5" /> Ответить
        </button>
        {user?.id === authorId && (
          <button
            className="inline-flex items-center gap-1 hover:text-accent"
            onClick={() => pin(c.id, c.is_pinned)}
          >
            <Pin className="size-3.5" /> {c.is_pinned ? "Открепить" : "Закрепить"}
          </button>
        )}
        {(user?.id === c.user_id || user?.id === authorId) && (
          <button
            className="inline-flex items-center gap-1 hover:text-destructive"
            onClick={() => remove(c.id)}
          >
            <Trash2 className="size-3.5" /> Удалить
          </button>
        )}
        <button
          className="inline-flex items-center gap-1 hover:text-destructive"
          onClick={() => setReportTarget(c.id)}
        >
          <Flag className="size-3.5" /> Пожаловаться
        </button>
      </div>
      {childrenOf(c.id).map((child) => renderComment(child, true))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="surface-card p-4">
        {replyTo && (
          <p className="mb-2 text-xs text-muted-foreground">
            Ответ на комментарий ·{" "}
            <button className="text-accent" onClick={() => setReplyTo(null)}>
              отменить
            </button>
          </p>
        )}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={user ? "Что думаешь об этой истории?" : "Войди, чтобы оставить комментарий"}
          maxLength={2000}
          rows={3}
        />
        <div className="mt-3 flex justify-end">
          <Button onClick={send} disabled={!body.trim()}>
            Отправить
          </Button>
        </div>
      </div>

      {roots.length === 0 && (
        <p className="text-sm text-muted-foreground">Пока нет комментариев. Будь первым.</p>
      )}
      {roots.map((c) => renderComment(c))}

      <Dialog open={!!reportTarget} onOpenChange={(o) => !o && setReportTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пожаловаться</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="reason"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {r}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={sendReport}>Отправить жалобу</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
