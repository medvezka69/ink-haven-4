import { Link } from "@tanstack/react-router";
import { Eye, Heart, Star, BookOpen } from "lucide-react";
import { coverGradient, formatNumber } from "@/lib/constants";
import type { BookCardData } from "@/lib/data";

export function BookCover({
  title,
  coverUrl,
  seed,
  className = "",
}: {
  title: string;
  coverUrl?: string | null;
  seed: string;
  className?: string;
}) {
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={`Обложка книги «${title}»`}
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-end p-3 ${className}`}
      style={{ background: coverGradient(seed) }}
    >
      <span className="font-display text-sm leading-tight text-[oklch(0.98_0.01_85)] drop-shadow">
        {title}
      </span>
    </div>
  );
}

export function BookCard({ book, index = 0 }: { book: BookCardData; index?: number }) {
  return (
    <Link
      to="/book/$bookId"
      params={{ bookId: book.id }}
      className="group surface-card animate-rise flex gap-4 overflow-hidden p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] sm:block sm:p-0"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-md sm:aspect-[3/4] sm:w-full sm:rounded-none">
        <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]">
          <BookCover title={book.title} coverUrl={book.cover_url} seed={book.id} />
        </div>
      </div>
      <div className="min-w-0 sm:p-4">
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{book.genre}</p>
        <h3 className="font-display mt-1 line-clamp-2 text-base leading-snug font-semibold">
          {book.title}
        </h3>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {book.author?.display_name ?? "Автор"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" /> {formatNumber(book.views)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3.5" /> {formatNumber(book.likes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5" /> {book.rating || "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3.5" /> {book.chapters}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function BookCardSkeleton() {
  return (
    <div className="surface-card overflow-hidden">
      <div className="aspect-[3/4] w-full animate-pulse bg-muted" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="text-3xl">📖</span>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
