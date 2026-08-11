
ALTER TABLE public.books ADD CONSTRAINT books_author_fk FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.book_likes ADD CONSTRAINT likes_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.book_ratings ADD CONSTRAINT ratings_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.library_items ADD CONSTRAINT library_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reading_progress ADD CONSTRAINT progress_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.follows ADD CONSTRAINT follows_follower_fk FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.follows ADD CONSTRAINT follows_following_fk FOREIGN KEY (following_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notif_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notif_actor_fk FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.comment_likes ADD CONSTRAINT comment_likes_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
