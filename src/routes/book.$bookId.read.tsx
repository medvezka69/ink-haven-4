import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  List,
  Maximize2,
  Minimize2,
  Settings2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchBook, fetchChapters } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Comments } from "@/components/Comments";

type Search = { chapter?: string | undefined };

export const Route = createFileRoute("/book/$bookId/read")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    chapter: typeof s["chapter"] === "string" ? s["chapter"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Чтение — Перо" },
      { name: "description", content: "Спокойный режим чтения: как настоящая электронная книга." },
      { property: "og:title", content: "Режим чтения — Перо" },
      { property: "og:description", content: "Читай книги с удобными настройками текста." },
    ],
  }),
  component: Reader,
});

const THEMES = {
  light: "bg-paper text-paper-foreground",
  sepia: "bg-sepia text-sepia-foreground",
  dark: "bg-[oklch(0.17_0.01_60)] text-[oklch(0.9_0.01_85)]",
} as const;

function Reader() {
  const { bookId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [fontSize, setFontSize] = useState(19);
  const [lineHeight, setLineHeight] = useState(1.85);
  const [width, setWidth] = useState(760);
  const [font, setFont] = useState<"serif" | "sans">("serif");
  const [theme, setTheme] = useState<keyof typeof THEMES>("light");
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const book = useQuery({ queryKey: ["book", bookId], queryFn: () => fetchBook(bookId) });
  const chapters = useQuery({
    queryKey: ["chapters", bookId],
    queryFn: () => fetchChapters(bookId, true),
  });

  const list = chapters.data ?? [];
  const currentId = search.chapter ?? list[0]?.id;
  const currentIndex = list.findIndex((c) => c.id === currentId);

  const chapter = useQuery({
    queryKey: ["chapter", currentId],
    enabled: !!currentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, title, content, position")
        .eq("id", currentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!search.chapter && list[0]) {
      navigate({ to: "/book/$bookId/read", params: { bookId }, search: { chapter: list[0].id }, replace: true });
    }
  }, [search.chapter, list, bookId, navigate]);

  useEffect(() => {
    const saved = localStorage.getItem("reader-settings");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.fontSize) setFontSize(s.fontSize);
        if (s.lineHeight) setLineHeight(s.lineHeight);
        if (s.width) setWidth(s.width);
        if (s.font) setFont(s.font);
        if (s.theme) setTheme(s.theme);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "reader-settings",
      JSON.stringify({ fontSize, lineHeight, width, font, theme }),
    );
  }, [fontSize, lineHeight, width, font, theme]);

  const measure = useCallback(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    const total = Math.max(1, Math.ceil(ct.scrollWidth / (vp.clientWidth + 48)));
    setPages(total);
  }, []);

  useLayoutEffect(() => {
    measure();
    const t = setTimeout(measure, 200);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [measure, chapter.data, fontSize, lineHeight, width, font]);

  useEffect(() => setPage(0), [currentId]);

  const goChapter = (idx: number) => {
    const next = list[idx];
    if (!next) return;
    navigate({ to: "/book/$bookId/read", params: { bookId }, search: { chapter: next.id } });
    setShowToc(false);
  };

  const turn = useCallback(
    (dir: 1 | -1) => {
      setPage((p) => {
        const next = p + dir;
        if (next < 0) {
          if (currentIndex > 0) goChapter(currentIndex - 1);
          return 0;
        }
        if (next >= pages) {
          if (currentIndex < list.length - 1) goChapter(currentIndex + 1);
          return p;
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, currentIndex, list.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") turn(1);
      if (e.key === "ArrowLeft") turn(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  useEffect(() => {
    if (!user || !currentId || list.length === 0) return;
    const percent = Math.round(
      ((currentIndex + (pages > 1 ? page / pages : 0)) / list.length) * 100,
    );
    const t = setTimeout(() => {
      supabase
        .from("reading_progress")
        .upsert(
          {
            user_id: user.id,
            book_id: bookId,
            chapter_id: currentId,
            percent: Math.min(100, Math.max(0, percent)),
            scroll_offset: page,
          },
          { onConflict: "user_id,book_id" },
        )
        .then(() => undefined);
    }, 900);
    return () => clearTimeout(t);
  }, [user, currentId, page, pages, currentIndex, list.length, bookId]);

  const fontFamily = font === "serif" ? "var(--font-serif)" : "var(--font-sans)";

  return (
    <div className={`min-h-screen ${THEMES[theme]}`}>
      <header className="sticky top-0 z-30 border-b border-border/40 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link to="/book/$bookId" params={{ bookId }} aria-label="Закрыть чтение">
            <Button variant="ghost" size="icon">
              <X className="size-4" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{book.data?.title}</p>
            <p className="truncate text-xs opacity-60">{chapter.data?.title}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowToc((v) => !v)} aria-label="Содержание">
            <List className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Настройки чтения"
          >
            <Settings2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Полноэкранный режим"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.();
                setFullscreen(true);
              } else {
                document.exitFullscreen?.();
                setFullscreen(false);
              }
            }}
          >
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      </header>

      {showSettings && (
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="surface-card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              Размер текста: {fontSize}px
              <input
                type="range"
                min={15}
                max={28}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>
            <label className="text-sm">
              Межстрочный интервал: {lineHeight}
              <input
                type="range"
                min={1.4}
                max={2.4}
                step={0.05}
                value={lineHeight}
                onChange={(e) => setLineHeight(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>
            <label className="text-sm">
              Ширина текста: {width}px
              <input
                type="range"
                min={480}
                max={1100}
                step={20}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>
            <div className="text-sm">
              Шрифт
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant={font === "serif" ? "default" : "outline"} onClick={() => setFont("serif")}>
                  Литературный
                </Button>
                <Button size="sm" variant={font === "sans" ? "default" : "outline"} onClick={() => setFont("sans")}>
                  Гротеск
                </Button>
              </div>
            </div>
            <div className="text-sm">
              Тема
              <div className="mt-2 flex gap-2">
                {(["light", "sepia", "dark"] as const).map((t) => (
                  <Button key={t} size="sm" variant={theme === t ? "default" : "outline"} onClick={() => setTheme(t)}>
                    {t === "light" ? "Светлая" : t === "sepia" ? "Сепия" : "Тёмная"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showToc && (
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="surface-card max-h-72 overflow-auto p-2">
            {list.map((c, i) => (
              <button
                key={c.id}
                onClick={() => goChapter(i)}
                className={`block w-full rounded-lg p-2 text-left text-sm hover:bg-muted ${
                  c.id === currentId ? "text-accent" : ""
                }`}
              >
                {i + 1}. {c.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-6xl px-4 py-6">
        <div
          className="relative mx-auto overflow-hidden rounded-2xl px-6 py-8 shadow-[var(--shadow-book)] lg:px-12"
          style={{ maxWidth: `${width * 1.6}px`, background: "inherit" }}
        >
          <div ref={viewportRef} className="relative h-[70vh] overflow-hidden">
            <div
              ref={contentRef}
              className="prose-book animate-page h-full"
              style={{
                columnWidth: `${Math.min(width, 620)}px`,
                columnGap: "48px",
                columnFill: "auto",
                height: "100%",
                fontSize: `${fontSize}px`,
                lineHeight,
                fontFamily,
                transform: `translateX(-${page * 100}%)`,
                transition: "transform 0.35s cubic-bezier(0.22,1,0.36,1)",
              }}
              dangerouslySetInnerHTML={{
                __html: `<h2 style="text-indent:0">${chapter.data?.title ?? ""}</h2>${chapter.data?.content ?? ""}`,
              }}
            />
          </div>

          <div className="mt-6 flex items-center justify-between text-xs opacity-70">
            <Button variant="ghost" size="sm" onClick={() => turn(-1)}>
              <ChevronLeft className="size-4" /> Назад
            </Button>
            <span>
              Страница {page + 1} из {pages} · глава {currentIndex + 1} из {list.length}
            </span>
            <Button variant="ghost" size="sm" onClick={() => turn(1)}>
              Далее <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <h2 className="font-display mb-4 text-lg font-semibold">Комментарии к главе</h2>
          {currentId && book.data?.author && (
            <Comments bookId={bookId} chapterId={currentId} authorId={book.data.author.id} />
          )}
        </div>
      </div>
    </div>
  );
}
