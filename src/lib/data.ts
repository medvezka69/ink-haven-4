import { supabase } from "@/integrations/supabase/client";

export type BookAuthor = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type BookRow = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  cover_url: string | null;
  genre: string;
  extra_genres: string[];
  tags: string[];
  age_rating: string;
  language: string;
  status: "draft" | "published" | "unlisted";
  views: number;
  word_goal: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  profiles?: BookAuthor | null;
  book_likes?: { count: number }[];
  book_ratings?: { value: number }[];
  chapters?: { count: number }[];
};

export type BookCardData = {
  id: string;
  title: string;
  description: string;
  cover_url: string | null;
  genre: string;
  status: string;
  views: number;
  likes: number;
  rating: number;
  chapters: number;
  author: BookAuthor | null;
  updated_at: string;
};

const BOOK_SELECT =
  "id, author_id, title, description, cover_url, genre, extra_genres, tags, age_rating, language, status, views, word_goal, created_at, updated_at, published_at, profiles:author_id (id, username, display_name, avatar_url), book_likes(count), book_ratings(value), chapters(count)";

export function toCard(row: BookRow): BookCardData {
  const ratings = row.book_ratings ?? [];
  const rating = ratings.length
    ? ratings.reduce((s, r) => s + r.value, 0) / ratings.length
    : 0;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    cover_url: row.cover_url,
    genre: row.genre,
    status: row.status,
    views: row.views,
    likes: row.book_likes?.[0]?.count ?? 0,
    rating: Math.round(rating * 10) / 10,
    chapters: row.chapters?.[0]?.count ?? 0,
    author: row.profiles ?? null,
    updated_at: row.updated_at,
  };
}

export type CatalogFilters = {
  q?: string;
  genre?: string;
  language?: string;
  sort?: "popular" | "new" | "rating";
  limit?: number;
  authorIds?: string[];
};

export async function fetchBooks(filters: CatalogFilters = {}): Promise<BookCardData[]> {
  let query = supabase.from("books").select(BOOK_SELECT).eq("status", "published");

  if (filters.q) {
    query = query.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
  }
  if (filters.genre) query = query.eq("genre", filters.genre);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.authorIds?.length) query = query.in("author_id", filters.authorIds);

  if (filters.sort === "new") query = query.order("published_at", { ascending: false });
  else query = query.order("views", { ascending: false });

  const { data, error } = await query.limit(filters.limit ?? 24);
  if (error) throw error;
  const cards = (data as unknown as BookRow[]).map(toCard);
  if (filters.sort === "rating") cards.sort((a, b) => b.rating - a.rating);
  if (!filters.sort || filters.sort === "popular") {
    cards.sort((a, b) => b.likes * 12 + b.views - (a.likes * 12 + a.views));
  }
  return cards;
}

export async function fetchBook(id: string): Promise<BookCardData & { raw: BookRow }> {
  const { data, error } = await supabase.from("books").select(BOOK_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Книга не найдена");
  const row = data as unknown as BookRow;
  return { ...toCard(row), raw: row };
}

export async function fetchChapters(bookId: string, onlyPublished = true) {
  let q = supabase
    .from("chapters")
    .select("id, title, position, is_published, word_count, updated_at")
    .eq("book_id", bookId)
    .order("position");
  if (onlyPublished) q = q.eq("is_published", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function searchAll(term: string) {
  const [books, people] = await Promise.all([
    supabase
      .from("books")
      .select(BOOK_SELECT)
      .eq("status", "published")
      .or(`title.ilike.%${term}%,genre.ilike.%${term}%,description.ilike.%${term}%`)
      .limit(6),
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .limit(6),
  ]);
  return {
    books: ((books.data ?? []) as unknown as BookRow[]).map(toCard),
    people: (people.data ?? []) as BookAuthor[],
  };
}

export async function notify(params: {
  userId: string;
  actorId: string;
  type: string;
  message: string;
  bookId?: string | null;
  chapterId?: string | null;
}) {
  if (params.userId === params.actorId) return;
  await supabase.from("notifications").insert({
    user_id: params.userId,
    actor_id: params.actorId,
    type: params.type,
    message: params.message,
    book_id: params.bookId ?? null,
    chapter_id: params.chapterId ?? null,
  });
}
