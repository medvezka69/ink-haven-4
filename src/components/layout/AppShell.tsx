import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  Home,
  Library,
  Moon,
  PenLine,
  Search,
  Sun,
  User,
  Users,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { searchAll } from "@/lib/data";
import { BookCover } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/read", label: "Читать", icon: BookOpen },
  { to: "/write", label: "Писать", icon: PenLine },
  { to: "/community", label: "Сообщество", icon: Users },
  { to: "/library", label: "Моя библиотека", icon: Library },
] as const;

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved ? saved === "dark" : false;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Переключить тему"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("theme", next ? "dark" : "light");
      }}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function GlobalSearch() {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchAll>> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      searchAll(term.trim())
        .then((r) => {
          setResults(r);
          setOpen(true);
        })
        .catch(() => setResults(null));
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => results && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && term.trim()) {
            setOpen(false);
            navigate({ to: "/read", search: { q: term.trim() } });
          }
        }}
        placeholder="Книги, авторы, жанры…"
        aria-label="Глобальный поиск"
        className="h-10 w-full rounded-full border border-border bg-card pr-3 pl-9 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      {open && results && (
        <div className="surface-card absolute top-12 right-0 left-0 z-50 max-h-96 overflow-auto p-2">
          {results.books.length === 0 && results.people.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">Ничего не найдено</p>
          )}
          {results.books.map((b) => (
            <Link
              key={b.id}
              to="/book/$bookId"
              params={{ bookId: b.id }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
            >
              <div className="h-12 w-9 overflow-hidden rounded">
                <BookCover title={b.title} coverUrl={b.cover_url} seed={b.id} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{b.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {b.author?.display_name} · {b.genre}
                </p>
              </div>
            </Link>
          ))}
          {results.people.map((p) => (
            <Link
              key={p.id}
              to="/u/$username"
              params={{ username: p.username }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                {p.display_name.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationsBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { count: c } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (active) setCount(c ?? 0);
    };
    load();
    const channel = supabase
      .channel("notif-bell")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <Link to="/notifications" className="relative" aria-label="Уведомления">
      <Button variant="ghost" size="icon">
        <Bell className="size-4" />
      </Button>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const profile = useProfile(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center gap-4">
          <Link to="/" className="font-display shrink-0 text-lg font-bold tracking-tight">
            Перо<span className="text-accent">.</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  pathname === item.to
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <div className="hidden sm:block">
              <GlobalSearch />
            </div>
            <ThemeToggle />
            {user ? (
              <>
                <NotificationsBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold"
                      aria-label="Профиль"
                    >
                      {profile?.display_name?.slice(0, 1) ?? <User className="size-4" />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {profile && (
                      <DropdownMenuItem asChild>
                        <Link to="/u/$username" params={{ username: profile.username }}>
                          Мой профиль
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link to="/write">Писательская студия</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/library">Моя библиотека</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/admin">Модерация</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="mr-2 size-4" /> Выйти
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">Войти</Link>
              </Button>
            )}
          </div>
        </div>
        <div className="container-page pb-3 sm:hidden">
          <GlobalSearch />
        </div>
      </header>

      <main className="flex-1 pb-20 lg:pb-0">{children}</main>

      <footer className="hidden border-t border-border py-10 lg:block">
        <div className="container-page flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-display">Перо — твоё литературное пространство</span>
          <span>Все основные функции бесплатны</span>
        </div>
      </footer>

      <nav className="fixed right-0 bottom-0 left-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                pathname === item.to ? "text-accent" : "text-muted-foreground"
              }`}
            >
              <item.icon className="size-5" />
              {item.label === "Моя библиотека" ? "Библиотека" : item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
