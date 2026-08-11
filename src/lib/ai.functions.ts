import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  bookId: z.string().uuid(),
  action: z.string().min(1).max(80),
  instruction: z.string().max(2000).optional(),
  selection: z.string().max(8000).default(""),
});

export const askWritingAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: book } = await supabase
      .from("books")
      .select("id, title, description, genre, author_id")
      .eq("id", data.bookId)
      .maybeSingle();

    if (!book || book.author_id !== userId) {
      throw new Error("Нет доступа к этой книге");
    }

    const { data: memory } = await supabase
      .from("book_memory")
      .select("kind, title, details")
      .eq("book_id", data.bookId)
      .limit(40);

    const memoryText = (memory ?? [])
      .map(
        (m) =>
          `[${m.kind === "character" ? "Персонаж" : m.kind === "world" ? "Мир" : "Сюжет"}] ${m.title}: ${m.details}`,
      )
      .join("\n");

    const system = [
      "Ты — литературный редактор и соавтор, помогающий русскоязычному писателю.",
      "Отвечай кратко и по делу, возвращай готовый текст без предисловий.",
      "Никогда не переписывай события, если об этом не просили.",
      "Если фрагмент противоречит памяти книги — начни ответ со строки, начинающейся на «⚠️ Возможное противоречие:», и объясни его в одном предложении, затем дай вариант текста.",
      `Книга: «${book.title}». Жанр: ${book.genre}. Описание: ${book.description || "—"}.`,
      memoryText ? `Память книги:\n${memoryText}` : "Память книги пока пустая.",
    ].join("\n");

    const userPrompt = [
      `Задача: ${data.action}.`,
      data.instruction ? `Уточнение автора: ${data.instruction}` : "",
      data.selection ? `Фрагмент текста:\n"""\n${data.selection}\n"""` : "Фрагмент не выделен.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI недоступен: отсутствует ключ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Слишком много запросов к AI. Попробуй чуть позже.");
    if (res.status === 402) throw new Error("Закончились кредиты AI.");
    if (!res.ok) throw new Error("AI не ответил. Попробуй ещё раз.");

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { text: json.choices?.[0]?.message?.content ?? "" };
  });
