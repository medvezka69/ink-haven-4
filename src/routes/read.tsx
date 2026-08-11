import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { BookCard, BookCardSkeleton, EmptyState } from "@/components/BookCard";
import { GENRES, LANGUAGES } from "@/lib/constants";
import { fetchBooks } from "@/lib/data";

type Search = {
  q?: string | undefined;
  genre?: string | undefined;
  language?: string | undefined;
  sort?: "popular" | "new" | "rating" | undefined;
};

export const Route = createFileRoute("/read")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    genre: typeof search["genre"] === "string" ? search["genre"] : undefined,
    language: typeof search["language"] === "string" ? search["language"] : undefined,
    sort:
      search["sort"] === "new" || search["sort"] === "rating" || search["sort"] === "popular"
        ? search["sort"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Каталог книг — Перо" },
      {
        name: "description",
        content: "Читай книги независимых авторов: драма, фэнтези, детектив, поэзия и другое.",
      },
      { property: "og:title", content: "Каталог книг — Перо" },
      { property: "og:description", content: "Тысячи историй от независимых авторов." },
    ],
  }),
  component: ReadCatalog,
});

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ReadCatalog() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/read" });

  const update = (patch: Partial<Search>) =>
    navigate({ search: (prev: Search) => ({ ...prev, ...patch }) });

  const books = useQuery({
    queryKey: ["catalog", search],
    queryFn: () =>
      fetchBooks({
        q: search.q,
        genre: search.genre,
        language: search.language,
        sort: search.sort ?? "popular",
        limit: 48,
      }),
  });

  return (
    <AppShell>
      <div className="container-page py-8">
        <h1 className="font-display text-3xl font-bold">Читать</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {search.q ? `Результаты по запросу «${search.q}»` : "Открой для себя новую историю"}
        </p>

        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Chip active={!search.genre} onClick={() => update({ genre: undefined })}>
              Все жанры
            </Chip>
            {GENRES.map((g) => (
              <Chip
                key={g}
                active={search.genre === g}
                onClick={() => update({ genre: search.genre === g ? undefined : g })}
              >
                {g}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["popular", "new", "rating"] as const).map((s) => (
              <Chip
                key={s}
                active={(search.sort ?? "popular") === s}
                onClick={() => update({ sort: s })}
              >
                {s === "popular" ? "Популярные" : s === "new" ? "Новые" : "По рейтингу"}
              </Chip>
            ))}
            <select
              value={search.language ?? ""}
              onChange={(e) => update({ language: e.target.value || undefined })}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm"
              aria-label="Язык"
            >
              <option value="">Любой язык</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8">
          {books.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <BookCardSkeleton key={i} />
              ))}
            </div>
          ) : books.data?.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {books.data.map((b, i) => (
                <BookCard key={b.id} book={b} index={i} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Ничего не нашлось"
              text="Попробуй изменить фильтры или поискать по другому слову."
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
