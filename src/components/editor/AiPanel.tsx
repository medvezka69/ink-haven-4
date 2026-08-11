import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Sparkles, Check, X } from "lucide-react";
import { askWritingAssistant } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ACTIONS = [
  "Проверить текст",
  "Исправить ошибки",
  "Улучшить стиль",
  "Сделать эмоциональнее",
  "Сделать атмосфернее",
  "Добавить романтики",
  "Добавить напряжения",
  "Сократить",
  "Расширить",
  "Переписать",
  "Продолжить сцену",
  "Придумать диалог",
  "Придумать сюжет",
  "Придумать название",
  "Придумать персонажа",
];

export function AiPanel({
  bookId,
  getSelection,
  onApply,
  onClose,
}: {
  bookId: string;
  getSelection: () => string;
  onApply: (text: string) => void;
  onClose: () => void;
}) {
  const ask = useServerFn(askWritingAssistant);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [instruction, setInstruction] = useState("");

  const run = async (action: string) => {
    setLoading(true);
    setResult("");
    try {
      const res = await ask({
        data: {
          bookId,
          action,
          instruction: instruction.trim() || undefined,
          selection: getSelection().slice(0, 8000),
        },
      });
      setResult(res.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI не ответил");
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-card lg:w-96">
      <div className="flex items-center justify-between border-b border-border p-3">
        <p className="font-display flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-accent" /> AI-помощник
        </p>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть AI">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-3">
        <div className="flex flex-wrap gap-1.5">
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => run(a)}
              disabled={loading}
              className="rounded-full border border-border px-2.5 py-1 text-xs transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {a}
            </button>
          ))}
        </div>

        <div>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Например: «Сделай эту сцену более напряжённой, но не меняй события.»"
          />
          <Button
            className="mt-2 w-full"
            size="sm"
            disabled={loading || !instruction.trim()}
            onClick={() => run("Свободный запрос автора")}
          >
            {loading ? "Думаю…" : "Спросить AI"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          AI видит выделенный фрагмент и память книги. Оригинальный текст не меняется, пока ты не
          нажмёшь «Применить».
        </p>

        {loading && (
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        )}

        {result && (
          <div className="surface-card p-3">
            <p className="text-sm whitespace-pre-line">{result}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onApply(result)}>
                <Check className="mr-1 size-3.5" /> Применить
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(result);
                  toast.success("Скопировано");
                }}
              >
                <Copy className="mr-1 size-3.5" /> Скопировать
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setResult("")}>
                Отмена
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
