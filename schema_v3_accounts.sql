-- CEMARA v3: account activity, inbox, author links, and account blocking
-- Run after schema.sql and schema_v2_roles.sql.

alter table public.user_profiles
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text,
  add column if not exists custom_card_emoji text default '✦',
  add column if not exists custom_card_text text default '';

alter table public.works
  add column if not exists author_id uuid references public.user_profiles(user_id) on delete set null;

alter table public.comments
  add column if not exists tagged_user_ids uuid[] not null default '{}';

create table if not exists public.work_likes (
  work_id uuid not null references public.works(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (work_id, user_id)
);

create table if not exists public.saved_works (
  work_id uuid not null references public.works(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (work_id, user_id)
);

alter table public.work_likes enable row level security;
alter table public.saved_works enable row level security;

drop policy if exists "Users manage own likes" on public.work_likes;
create policy "Users manage own likes" on public.work_likes for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users manage own saved works" on public.saved_works;
create policy "Users manage own saved works" on public.saved_works for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace view public.work_engagement_stats as
select w.id as work_id,
       count(distinct l.user_id)::integer as like_count,
       count(distinct s.user_id)::integer as save_count
from public.works w
left join public.work_likes l on l.work_id = w.id
left join public.saved_works s on s.work_id = w.id
group by w.id;

grant select on public.work_engagement_stats to anon, authenticated;
grant select, insert, delete on public.work_likes, public.saved_works to authenticated;

create index if not exists works_author_id_idx on public.works(author_id);
create index if not exists works_author_name_idx on public.works(lower(author));

create table if not exists public.account_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('login', 'profile_updated', 'work_published', 'comment_added', 'account_blocked', 'account_unblocked')),
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.account_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  subject text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists account_activity_user_created_idx on public.account_activity(user_id, created_at desc);
create index if not exists account_inbox_user_created_idx on public.account_inbox(user_id, created_at desc);

create or replace function public.create_account_welcome_data()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.account_inbox(user_id, subject, message)
  values (new.user_id, 'Selamat datang di CEMARA', 'Profilmu sudah siap. Lengkapi biodata dan mulai ikut membaca karya siswa.');
  insert into public.account_activity(user_id, activity_type, summary)
  values (new.user_id, 'profile_updated', 'Profil akun dibuat.');
  return new;
end;
$$;

drop trigger if exists user_profile_welcome_data on public.user_profiles;
create trigger user_profile_welcome_data after insert on public.user_profiles
for each row execute function public.create_account_welcome_data();

create or replace function public.cemara_sync_user_profiles()
returns integer language plpgsql security definer set search_path = public, auth
as $$
declare created_count integer;
begin
  if not exists (
    select 1 from public.user_profiles
    where user_id = auth.uid() and role in ('super_admin', 'dev', 'admin')
  ) then
    raise exception 'Hanya pengelola yang dapat menyinkronkan akun';
  end if;

  insert into public.user_profiles (user_id, display_name, role)
  select u.id,
         coalesce(nullif(u.raw_user_meta_data->>'name', ''), nullif(u.raw_user_meta_data->>'full_name', ''), nullif(split_part(u.email, '@', 1), ''), 'Pengunjung'),
         'user'
  from auth.users u
  where not exists (select 1 from public.user_profiles p where p.user_id = u.id);

  get diagnostics created_count = row_count;
  return created_count;
end;
$$;

grant execute on function public.cemara_sync_user_profiles() to authenticated;

alter table public.account_activity enable row level security;
alter table public.account_inbox enable row level security;

 drop policy if exists "Users read own activity" on public.account_activity;
create policy "Users read own activity" on public.account_activity for select to authenticated using (user_id = auth.uid());

drop policy if exists "Managers read account activity" on public.account_activity;
create policy "Managers read account activity" on public.account_activity for select to authenticated using (
  exists (select 1 from public.user_profiles where user_id = auth.uid() and role in ('super_admin', 'dev', 'admin'))
);

 drop policy if exists "Users add own activity" on public.account_activity;
create policy "Users add own activity" on public.account_activity for insert to authenticated with check (user_id = auth.uid());

 drop policy if exists "Users read own inbox" on public.account_inbox;
create policy "Users read own inbox" on public.account_inbox for select to authenticated using (user_id = auth.uid());

 drop policy if exists "Users mark own inbox read" on public.account_inbox;
create policy "Users mark own inbox read" on public.account_inbox for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.cemara_can_manage_target(target_user_id uuid)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare actor_role text;
declare target_role text;
begin
  select role into actor_role from public.user_profiles where user_id = auth.uid();
  select role into target_role from public.user_profiles where user_id = target_user_id;
  if target_user_id = auth.uid() or target_role is null then return false; end if;
  return (actor_role = 'super_admin' and target_role in ('user', 'admin'))
      or (actor_role = 'dev' and target_role in ('user', 'admin'));
end;
$$;

create or replace function public.cemara_set_blocked(target_user_id uuid, should_block boolean, reason text default null)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if not public.cemara_can_manage_target(target_user_id) then
    raise exception 'Akun ini tidak dapat dikelola oleh role Anda';
  end if;
  update public.user_profiles
  set blocked_at = case when should_block then now() else null end,
      blocked_reason = case when should_block then nullif(trim(reason), '') else null end,
      updated_at = now()
  where user_id = target_user_id;
  insert into public.account_activity(user_id, activity_type, summary, metadata)
  values (target_user_id, case when should_block then 'account_blocked' else 'account_unblocked' end,
          case when should_block then 'Akun diblokir oleh pengelola.' else 'Blokir akun dicabut oleh pengelola.' end,
          jsonb_build_object('actor_id', auth.uid()));
  return true;
end;
$$;

grant execute on function public.cemara_can_manage_target(uuid) to authenticated;
grant execute on function public.cemara_set_blocked(uuid, boolean, text) to authenticated;

create or replace function public.cemara_set_role(target_user_id uuid, new_role text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare actor_role text;
begin
  select role into actor_role from public.user_profiles where user_id = auth.uid();
  if actor_role not in ('super_admin', 'dev') or target_user_id = auth.uid() then
    raise exception 'Anda tidak dapat mengubah role akun ini';
  end if;
  if new_role not in ('user', 'admin', 'dev', 'super_admin') then
    raise exception 'Role tidak valid';
  end if;
  update public.user_profiles
  set role = new_role, updated_at = now()
  where user_id = target_user_id;
  if not found then raise exception 'Profil akun tidak ditemukan'; end if;
  insert into public.account_activity(user_id, activity_type, summary, metadata)
  values (target_user_id, 'profile_updated', 'Role akun diubah oleh pengelola.',
          jsonb_build_object('actor_id', auth.uid(), 'new_role', new_role));
  return true;
end;
$$;

grant execute on function public.cemara_set_role(uuid, text) to authenticated;
grant select, insert on public.account_activity to authenticated;
grant select, update on public.account_inbox to authenticated;
grant select, update on public.user_profiles to authenticated;
grant select, insert, update on public.works to authenticated;

create or replace view public.author_work_stats as
select author as display_name, count(*)::integer as published_works
from public.works
where nullif(trim(author), '') is not null
group by author
order by published_works desc, display_name asc;

grant select on public.author_work_stats to anon, authenticated;

-- Link legacy works to profiles when the stored author name matches exactly.
update public.works w
set author_id = p.user_id
from public.user_profiles p
where w.author_id is null
  and lower(trim(w.author)) = lower(trim(p.display_name));

-- Optional trigger for new work rows when author text matches a profile.
create or replace function public.link_work_author()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.author_id is null then
    select user_id into new.author_id
    from public.user_profiles
    where lower(trim(display_name)) = lower(trim(new.author))
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists works_link_author on public.works;
create trigger works_link_author before insert or update of author on public.works
for each row execute function public.link_work_author();

create or replace function public.record_work_author_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.author_id is not null then
    insert into public.account_activity(user_id, activity_type, summary, metadata)
    values (new.author_id, 'work_published', 'Akun ditautkan sebagai penulis karya.', jsonb_build_object('work_id', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists work_author_activity on public.works;
create trigger work_author_activity after insert on public.works
for each row execute function public.record_work_author_activity();

create or replace function public.record_comment_tag_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare tagged_id uuid;
begin
  if new.tagged_user_ids is not null then
    foreach tagged_id in array new.tagged_user_ids loop
      insert into public.account_activity(user_id, activity_type, summary, metadata)
      values (tagged_id, 'comment_added', 'Akun ditandai dalam komentar.', jsonb_build_object('work_id', new.work_id, 'comment_id', new.id));
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists comment_tag_activity on public.comments;
create trigger comment_tag_activity after insert on public.comments
for each row execute function public.record_comment_tag_activity();
