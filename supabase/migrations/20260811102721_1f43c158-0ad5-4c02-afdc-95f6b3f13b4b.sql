
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TYPE public.book_status AS ENUM ('draft','published','unlisted');
CREATE TYPE public.shelf_kind AS ENUM ('reading','saved','finished','want');
CREATE TYPE public.memory_kind AS ENUM ('character','world','plot');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- BOOKS
CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Без названия',
  description text NOT NULL DEFAULT '',
  cover_url text,
  genre text NOT NULL DEFAULT 'Другое',
  extra_genres text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  age_rating text NOT NULL DEFAULT '12+',
  language text NOT NULL DEFAULT 'Русский',
  status public.book_status NOT NULL DEFAULT 'draft',
  views integer NOT NULL DEFAULT 0,
  word_goal integer NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
GRANT SELECT ON public.books TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "books_public_read" ON public.books FOR SELECT USING (status <> 'draft');
CREATE POLICY "books_owner_read" ON public.books FOR SELECT TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "books_owner_write" ON public.books FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "books_owner_update" ON public.books FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "books_owner_delete" ON public.books FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER books_updated BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CHAPTERS
CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Новая глава',
  content text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  word_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chapters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chapters_public_read" ON public.chapters FOR SELECT USING (
  is_published AND EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.status <> 'draft')
);
CREATE POLICY "chapters_owner_all" ON public.chapters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.author_id = auth.uid()));
CREATE TRIGGER chapters_updated BEFORE UPDATE ON public.chapters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CHAPTER VERSIONS
CREATE TABLE public.chapter_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chapter_versions TO authenticated;
GRANT ALL ON public.chapter_versions TO service_role;
ALTER TABLE public.chapter_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions_owner_all" ON public.chapter_versions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chapters c JOIN public.books b ON b.id=c.book_id WHERE c.id = chapter_id AND b.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chapters c JOIN public.books b ON b.id=c.book_id WHERE c.id = chapter_id AND b.author_id = auth.uid()));

-- LIKES
CREATE TABLE public.book_likes (
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);
GRANT SELECT ON public.book_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.book_likes TO authenticated;
GRANT ALL ON public.book_likes TO service_role;
ALTER TABLE public.book_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_read" ON public.book_likes FOR SELECT USING (true);
CREATE POLICY "likes_self_insert" ON public.book_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_self_delete" ON public.book_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RATINGS
CREATE TABLE public.book_ratings (
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);
GRANT SELECT ON public.book_ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_ratings TO authenticated;
GRANT ALL ON public.book_ratings TO service_role;
ALTER TABLE public.book_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_read" ON public.book_ratings FOR SELECT USING (true);
CREATE POLICY "ratings_self_write" ON public.book_ratings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- LIBRARY
CREATE TABLE public.library_items (
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  shelf public.shelf_kind NOT NULL DEFAULT 'saved',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT ALL ON public.library_items TO service_role;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_self" ON public.library_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- READING PROGRESS
CREATE TABLE public.reading_progress (
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  percent integer NOT NULL DEFAULT 0,
  scroll_offset integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_progress TO authenticated;
GRANT ALL ON public.reading_progress TO service_role;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_self" ON public.reading_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- FOLLOWS
CREATE TABLE public.follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT ON public.follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_read" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_self_insert" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_self_delete" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- COMMENTS
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  paragraph_anchor text,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_read" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_self_insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update" ON public.comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.author_id = auth.uid()))
  WITH CHECK (true);
CREATE POLICY "comments_delete" ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.author_id = auth.uid()));

CREATE TABLE public.comment_likes (
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);
GRANT SELECT ON public.comment_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.comment_likes TO authenticated;
GRANT ALL ON public.comment_likes TO service_role;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment_likes_read" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "comment_likes_self" ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_likes_self_del" ON public.comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid,
  type text NOT NULL,
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own_read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id OR auth.uid() = user_id);
CREATE POLICY "notif_own_update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_own_delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- BOOK MEMORY
CREATE TABLE public.book_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  kind public.memory_kind NOT NULL DEFAULT 'character',
  title text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_memory TO authenticated;
GRANT ALL ON public.book_memory TO service_role;
ALTER TABLE public.book_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory_owner_all" ON public.book_memory FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.author_id = auth.uid()));
CREATE TRIGGER memory_updated BEFORE UPDATE ON public.book_memory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REPORTS
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_read" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "reports_admin_update" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) WITH CHECK (true);

-- NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username',''), 'user_' || substr(NEW.id::text,1,8)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), 'Читатель'),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- VIEW COUNTER
CREATE OR REPLACE FUNCTION public.increment_book_views(_book_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.books SET views = views + 1 WHERE id = _book_id AND status <> 'draft';
$$;
GRANT EXECUTE ON FUNCTION public.increment_book_views(uuid) TO anon, authenticated;

-- DEMO DATA
INSERT INTO public.profiles (id, username, display_name, bio, avatar_url) VALUES
 ('11111111-1111-4111-8111-111111111111','polina','Полина Верес','Пишу тихие истории о людях, которые ищут дом.',null),
 ('22222222-2222-4222-8222-222222222222','arseniy','Арсений Кот','Фантаст. Люблю холодный космос и тёплые финалы.',null),
 ('33333333-3333-4333-8333-333333333333','marta','Марта Лин','Детективы, туман и старые города.',null),
 ('44444444-4444-4444-8444-444444444444','danil','Данил Ор','Поэзия и короткая проза.',null);

INSERT INTO public.books (id, author_id, title, description, genre, tags, status, views, published_at) VALUES
 ('aaaaaaa1-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Дом на улице Тишины','Женщина возвращается в город детства и находит дом, который помнит её лучше, чем она сама.','Драма','{"семья","память","город"}','published',1240, now() - interval '10 days'),
 ('aaaaaaa1-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Последняя станция «Вега»','Инженер остаётся один на орбитальной станции и начинает получать сообщения от самого себя.','Фантастика','{"космос","одиночество"}','published',3120, now() - interval '4 days'),
 ('aaaaaaa1-0000-4000-8000-000000000003','33333333-3333-4333-8333-333333333333','Тише, чем снег','В маленьком городе исчезает библиотекарь, а вместе с ним — одна очень старая книга.','Детектив','{"тайна","зима"}','published',870, now() - interval '2 days'),
 ('aaaaaaa1-0000-4000-8000-000000000004','44444444-4444-4444-8444-444444444444','Ноябрь и другие письма','Сборник коротких текстов о расставаниях, кофе и позднем свете.','Поэзия','{"чувства","сборник"}','published',430, now() - interval '1 day');

INSERT INTO public.chapters (book_id, title, content, position, is_published, word_count) VALUES
 ('aaaaaaa1-0000-4000-8000-000000000001','Глава 1. Возвращение','<p>Поезд остановился так тихо, будто извинялся. Аня вышла на перрон и сразу узнала запах: мокрая листва, железо и чей-то дым.</p><p>Улица Тишины начиналась сразу за вокзалом и заканчивалась домом, в котором она обещала себе никогда больше не жить.</p>',1,true,42),
 ('aaaaaaa1-0000-4000-8000-000000000001','Глава 2. Ключ','<p>Ключ подошёл с первого раза, и это обидело её больше всего. За двенадцать лет замок мог бы и передумать.</p>',2,true,24),
 ('aaaaaaa1-0000-4000-8000-000000000002','Глава 1. Тишина на орбите','<p>Связь с Землёй пропала во вторник. Кир записал это в журнал спокойным почерком, будто фиксировал погоду.</p><p>В среду он получил сообщение. Отправитель: Кир.</p>',1,true,31),
 ('aaaaaaa1-0000-4000-8000-000000000002','Глава 2. Второй голос','<p>«Не открывай отсек Д», — говорилось в письме. Кир перечитал его семнадцать раз и пошёл к отсеку Д.</p>',2,true,22),
 ('aaaaaaa1-0000-4000-8000-000000000003','Глава 1. Снег без следов','<p>Библиотека открылась в девять, как всегда. Не открылся только Пётр Ильич.</p>',1,true,14),
 ('aaaaaaa1-0000-4000-8000-000000000004','Ноябрь','<p>Ты пишешь мне о холоде так, будто он у тебя один. У меня он тоже есть — просто я зову его иначе.</p>',1,true,21);

INSERT INTO public.book_likes (user_id, book_id) VALUES
 ('22222222-2222-4222-8222-222222222222','aaaaaaa1-0000-4000-8000-000000000001'),
 ('33333333-3333-4333-8333-333333333333','aaaaaaa1-0000-4000-8000-000000000001'),
 ('11111111-1111-4111-8111-111111111111','aaaaaaa1-0000-4000-8000-000000000002'),
 ('44444444-4444-4444-8444-444444444444','aaaaaaa1-0000-4000-8000-000000000002'),
 ('11111111-1111-4111-8111-111111111111','aaaaaaa1-0000-4000-8000-000000000003');

INSERT INTO public.book_ratings (user_id, book_id, value) VALUES
 ('22222222-2222-4222-8222-222222222222','aaaaaaa1-0000-4000-8000-000000000001',5),
 ('33333333-3333-4333-8333-333333333333','aaaaaaa1-0000-4000-8000-000000000001',4),
 ('11111111-1111-4111-8111-111111111111','aaaaaaa1-0000-4000-8000-000000000002',5),
 ('11111111-1111-4111-8111-111111111111','aaaaaaa1-0000-4000-8000-000000000003',4);

INSERT INTO public.follows (follower_id, following_id) VALUES
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111'),
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111'),
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');

INSERT INTO public.comments (book_id, user_id, body, is_pinned) VALUES
 ('aaaaaaa1-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Первая глава — как будто зашёл в свой старый двор. Спасибо.',true),
 ('aaaaaaa1-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Отсек Д не открывай, Кир. Пожалуйста.',false);
