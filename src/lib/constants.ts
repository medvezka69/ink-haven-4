export const GENRES = [
  "Романтика",
  "Драма",
  "Фэнтези",
  "Фантастика",
  "Триллер",
  "Детектив",
  "Приключения",
  "Ужасы",
  "Young Adult",
  "Комедия",
  "Поэзия",
  "Другое",
] as const;

export const GENRE_EMOJI: Record<string, string> = {
  Романтика: "💌",
  Драма: "🎭",
  Фэнтези: "🗝️",
  Фантастика: "🛰️",
  Триллер: "🌒",
  Детектив: "🔍",
  Приключения: "🧭",
  Ужасы: "🕯️",
  "Young Adult": "🌱",
  Комедия: "🎈",
  Поэзия: "🪶",
  Другое: "📔",
};

export const AGE_RATINGS = ["0+", "6+", "12+", "16+", "18+"] as const;
export const LANGUAGES = ["Русский", "English", "Қазақша", "Українська", "Другой"] as const;

export const SHELVES = [
  { key: "reading", label: "Читаю сейчас" },
  { key: "saved", label: "Сохранено" },
  { key: "finished", label: "Прочитано" },
  { key: "want", label: "Хочу прочитать" },
] as const;

export const REPORT_REASONS = [
  "Спам",
  "Оскорбления",
  "Плагиат",
  "Запрещённый контент",
  "Другое",
] as const;

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(html: string): number {
  const text = stripHtml(html);
  return text ? text.split(" ").length : 0;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

export function coverGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(150deg, oklch(0.5 0.09 ${hash}), oklch(0.32 0.05 ${(hash + 40) % 360}))`;
}
