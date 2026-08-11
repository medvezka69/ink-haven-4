import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  Underline,
  Sparkles,
  Plus,
  Save,
  Download,
  Quote,
  Heading2,
  AlignLeft,
  AlignCenter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiPanel } from "@/components/editor/AiPanel";
import { exportPdf, exportTxt, exportHtmlDoc } from "@/lib/export";
import { countWords } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/write/$bookId")({
  head: () => ({
    meta: [
      { title: "Редактор книги — Перо" },
      { name: "description", content: "Профессиональный редактор глав с AI-помощником и автосохранением." },
      { property: "og:title", content: "Редактор книги — Перо" },
      { property: "og:description", content: "Пиши, форматируй и публикуй главы." },
    ],
  }),
  component: Editor,
});

function Editor() {
  const { bookId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [words, setWords] = useState(0);
  const [showAi, setShowAi] = useState(false);

  const book = useQuery({
    queryKey: ["edit-book", bookId],
    queryFn: async () => {
      const { data } = await supabase
        .from("books")
        .select("id, title, status, author_id")
        .eq("id", bookId)
        .maybeSingle();
      return data;
    },
  });

  const chapters = useQuery({
    queryKey: ["edit-chapters", bookId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, title, position, is_published")
        .eq("book_id", bookId)
        .order("position");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!currentId && chapters.data?.[0]) setCurrentId(chapters.data[0].id);
  }, [chapters.data, currentId]);

  useEffect(() => {
    if (!currentId) return;
    let active = true;
    supabase
      .from("chapters")
      .select("title, content")
      .eq("id", currentId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setTitle(data.title);
        if (editorRef.current) editorRef.current.innerHTML = data.content || "<p></p>";
        setWords(countWords(data.content || ""));
        setDirty(false);
      });
    return () => {
      active = false;
    };
  }, [currentId]);

  const save = async (silent = true) => {
    if (!currentId || !editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const { error } = await supabase
      .from("chapters")
      .update({ title, content, word_count: countWords(content) })
      .eq("id", currentId);
    if (error) {
      toast.error("Не удалось сохранить");
      return;
    }
    await supabase.from("chapter_versions").insert({ chapter_id: currentId, content });
    setDirty(false);
    setSavedAt(new Date().toLocaleTimeString("ru-RU"));
    qc.invalidateQueries({ queryKey: ["edit-chapters", bookId] });
    if (!silent) toast.success("Сохранено");
  };

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => save(), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, title]);

  const cmd = (name: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    setDirty(true);
  };

  const addChapter = async () => {
    const pos = (chapters.data?.length ?? 0) + 1;
    const { data } = await supabase
      .from("chapters")
      .insert({ book_id: bookId, title: `Глава ${pos}`, content: "<p></p>", position: pos })
      .select("id")
      .single();
    qc.invalidateQueries({ queryKey: ["edit-chapters", bookId] });
    if (data) setCurrentId(data.id);
  };

  const togglePublish = async () => {
    if (!currentId) return;
    const ch = chapters.data?.find((c) => c.id === currentId);
    await supabase
      .from("chapters")
      .update({ is_published: !ch?.is_published })
      .eq("id", currentId);
    if (book.data?.status === "draft") {
      await supabase.from("books").update({ status: "published", published_at: new Date().toISOString() }).eq("id", bookId);
    }
    qc.invalidateQueries({ queryKey: ["edit-chapters", bookId] });
    qc.invalidateQueries({ queryKey: ["edit-book", bookId] });
    toast.success(ch?.is_published ? "Глава снята с публикации" : "Глава опубликована");
  };

  const doExport = async (kind: "pdf" | "txt" | "doc") => {
    const { data } = await supabase
      .from("chapters")
      .select("title, content")
      .eq("book_id", bookId)
      .order("position");
    const list = data ?? [];
    const name = book.data?.title ?? "Книга";
    if (kind === "pdf") exportPdf(name, list);
    else if (kind === "txt") exportTxt(name, list);
    else exportHtmlDoc(name, list, "doc");
  };

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [draggedChapterIndex, setDraggedChapterIndex] = useState<number | null>(null);

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    for (const file of files) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imgUrl = event.target?.result as string;
          if (editorRef.current && imgUrl) {
            editorRef.current.focus();
            document.execCommand(
              "insertHTML",
              false,
              `<img src="${imgUrl}" alt="${file.name}" class="my-4 max-w-full rounded-md shadow-sm" />`,
            );
            setDirty(true);
            setWords(countWords(editorRef.current.innerHTML));
            toast.success(`Изображение «${file.name}» вставлено`);
          }
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (editorRef.current && text) {
            const formatted = text
              .split(/\r?\n\r?\n/)
              .map((p) => `<p>${p.trim().replace(/\r?\n/g, "<br/>")}</p>`)
              .join("");
            editorRef.current.focus();
            document.execCommand("insertHTML", false, formatted);
            setDirty(true);
            setWords(countWords(editorRef.current.innerHTML));
            toast.success(`Текст из «${file.name}» вставлен`);
          }
        };
        reader.readAsText(file);
      }
    }
  };

  const handleChapterDrop = async (targetIndex: number) => {
    if (draggedChapterIndex === null || draggedChapterIndex === targetIndex) return;
    const list = [...(chapters.data ?? [])];
    const [moved] = list.splice(draggedChapterIndex, 1);
    list.splice(targetIndex, 0, moved);

    setDraggedChapterIndex(null);

    // Update positions in DB
    const updates = list.map((c, i) =>
      supabase.from("chapters").update({ position: i + 1 }).eq("id", c.id),
    );
    await Promise.all(updates);
    qc.invalidateQueries({ queryKey: ["edit-chapters", bookId] });
    toast.success("Порядок глав обновлён");
  };

  if (book.data && user && book.data.author_id !== user.id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Это не твоя книга.</p>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-screen flex-col bg-background"
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files")) setIsDraggingFile(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDraggingFile(false);
      }}
      onDrop={handleFileDrop}
    >
      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-4 border-dashed border-accent bg-background/90 backdrop-blur-sm">
          <div className="text-center">
            <Download className="mx-auto size-12 text-accent animate-bounce" />
            <p className="font-display mt-3 text-xl font-bold">Перетащите файл сюда</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Текстовый файл (TXT, MD, DOCX) или изображение вставится прямо в главу
            </p>
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <Link to="/write" className="font-display font-semibold hover:text-accent">
          ← {book.data?.title}
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{words} слов</span>
          <span>{dirty ? "Сохраняю…" : savedAt ? `Сохранено в ${savedAt}` : "Всё сохранено"}</span>
          <Button size="sm" variant="outline" onClick={() => save(false)}>
            <Save className="mr-1 size-3.5" /> Сохранить
          </Button>
          <Button size="sm" variant="outline" onClick={togglePublish}>
            Опубликовать главу
          </Button>
          <Button size="sm" variant="outline" onClick={() => doExport("pdf")}>
            <Download className="mr-1 size-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => doExport("doc")}>
            DOC
          </Button>
          <Button size="sm" variant="outline" onClick={() => doExport("txt")}>
            TXT
          </Button>
          <Button size="sm" onClick={() => setShowAi((v) => !v)}>
            <Sparkles className="mr-1 size-3.5" /> AI
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 overflow-auto border-r border-border p-3 md:block">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Главы</p>
            <Button size="icon" variant="ghost" onClick={addChapter} aria-label="Добавить главу">
              <Plus className="size-4" />
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Перетащите мышью для сортировки</p>
          <div className="mt-2 space-y-1">
            {(chapters.data ?? []).map((c, index) => (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  setDraggedChapterIndex(index);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation();
                  handleChapterDrop(index);
                }}
                className="group relative flex items-center"
              >
                <button
                  onClick={() => setCurrentId(c.id)}
                  className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm cursor-grab active:cursor-grabbing hover:bg-muted ${
                    c.id === currentId ? "bg-muted text-accent font-medium" : ""
                  } ${draggedChapterIndex === index ? "opacity-40" : ""}`}
                >
                  <span className="mr-1.5 opacity-40 group-hover:opacity-100">⋮⋮</span>
                  {c.title} {c.is_published ? "" : "·"}
                </button>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-1.5">
            {[
              { icon: Bold, cmd: "bold", label: "Жирный" },
              { icon: Italic, cmd: "italic", label: "Курсив" },
              { icon: Underline, cmd: "underline", label: "Подчёркнутый" },
              { icon: Quote, cmd: "formatBlock", value: "blockquote", label: "Цитата" },
              { icon: Heading2, cmd: "formatBlock", value: "h2", label: "Заголовок" },
              { icon: AlignLeft, cmd: "justifyLeft", label: "По левому краю" },
              { icon: AlignCenter, cmd: "justifyCenter", label: "По центру" },
            ].map(({ icon: Icon, cmd: c, value, label }) => (
              <Button
                key={label}
                size="icon"
                variant="ghost"
                aria-label={label}
                title={label}
                onClick={() => cmd(c, value)}
              >
                <Icon className="size-4" />
              </Button>
            ))}
          </div>

          <div className="flex-1 overflow-auto px-4 py-6">
            <div className="mx-auto max-w-3xl">
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                className="font-display mb-4 border-0 px-0 text-2xl font-bold shadow-none focus-visible:ring-0"
                placeholder="Название главы"
              />
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Текст главы"
                onInput={() => {
                  setDirty(true);
                  setWords(countWords(editorRef.current?.innerHTML ?? ""));
                }}
                className="prose-book min-h-[60vh] outline-none"
              />
            </div>
          </div>
        </main>

        {showAi && (
          <AiPanel
            bookId={bookId}
            getSelection={() => window.getSelection()?.toString() ?? ""}
            onApply={(text) => {
              cmd("insertText", text);
              toast.success("Текст вставлен");
            }}
            onClose={() => setShowAi(false)}
          />
        )}
      </div>
    </div>
  );
}
