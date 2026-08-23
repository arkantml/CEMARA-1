-- CEMARA — Supabase database setup
-- Jalankan SELURUH file ini di Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  category text not null check (category in ('Cerpen','Puisi','Esai','Seni','Artikel','Lainnya')),
  description text not null,
  content text not null,
  cover text default 'cover-1',
  cover_symbol text default '✦',
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 40),
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_cemara_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admin_profiles where user_id = auth.uid());
$$;

alter table public.works enable row level security;
alter table public.comments enable row level security;
alter table public.admin_profiles enable row level security;

-- Works: public read, admin write.
drop policy if exists "Public can read works" on public.works;
create policy "Public can read works" on public.works for select to anon, authenticated using (true);
drop policy if exists "Admins can insert works" on public.works;
create policy "Admins can insert works" on public.works for insert to authenticated with check (public.is_cemara_admin());
drop policy if exists "Admins can update works" on public.works;
create policy "Admins can update works" on public.works for update to authenticated using (public.is_cemara_admin()) with check (public.is_cemara_admin());
drop policy if exists "Admins can delete works" on public.works;
create policy "Admins can delete works" on public.works for delete to authenticated using (public.is_cemara_admin());

-- Comments: everyone reads; anyone posts; signed-in owner or admin edits/deletes.
drop policy if exists "Public can read comments" on public.comments;
create policy "Public can read comments" on public.comments for select to anon, authenticated using (true);
drop policy if exists "Anyone can post comments" on public.comments;
create policy "Anyone can post comments" on public.comments for insert to anon, authenticated with check (true);
drop policy if exists "Owners or admins can edit comments" on public.comments;
create policy "Owners or admins can edit comments" on public.comments for update to authenticated using (user_id = auth.uid() or public.is_cemara_admin()) with check (user_id = auth.uid() or public.is_cemara_admin());
drop policy if exists "Owners or admins can delete comments" on public.comments;
create policy "Owners or admins can delete comments" on public.comments for delete to authenticated using (user_id = auth.uid() or public.is_cemara_admin());

-- Admin profiles: only the signed-in admin can read their own row.
drop policy if exists "Admins can read own admin profile" on public.admin_profiles;
create policy "Admins can read own admin profile" on public.admin_profiles for select to authenticated using (user_id = auth.uid());

grant select on public.works to anon, authenticated;
grant insert, update, delete on public.works to authenticated;
grant select, insert on public.comments to anon, authenticated;
grant update, delete on public.comments to authenticated;
grant select on public.admin_profiles to authenticated;

-- Sample content (only inserts if the table is empty).
insert into public.works (title,author,category,description,content,cover,cover_symbol)
select * from (values
('Di Ujung Senja','Alya Ramadhani','Cerpen','Sebuah cerita tentang pertemuan, pilihan kecil, dan keberanian untuk memulai kembali.','Senja turun perlahan di balik gedung sekolah.\n\nAda hal-hal yang tidak perlu dijelaskan terlalu panjang. Kadang sebuah perpisahan hanya meminta kita untuk menerima, lalu melanjutkan perjalanan dengan hati yang lebih lapang.\n\nMungkin besok akan berbeda. Tetapi untuk hari ini, aku memilih percaya bahwa setiap akhir selalu menyisakan sebuah jalan baru.','cover-1','✦'),
('Hujan di Halaman Sekolah','Fauzan Akbar','Puisi','Puisi reflektif tentang hujan, kenangan sekolah, dan hal-hal sederhana yang lama tinggal di ingatan.','Hujan datang tanpa mengetuk. Membasahi halaman yang kemarin penuh suara langkah dan tawa.\n\nDi antara rintiknya, ada kenangan yang tumbuh diam-diam: bangku kelas, buku yang terbuka, dan percakapan yang tidak pernah selesai.\n\nBarangkali begitulah sekolah tinggal di dalam kita—bukan sebagai gedung, melainkan sebagai cerita yang terus pulang.','cover-2','☂'),
('Membaca untuk Menemukan','Nadia Putri','Esai','Esai singkat tentang kebiasaan membaca sebagai cara mengenali diri dan memahami dunia.','Membaca bukan hanya kegiatan memindahkan kata dari halaman ke pikiran. Membaca adalah latihan untuk melihat dunia dari jendela yang berbeda.\n\nSatu buku dapat membawa kita ke tempat yang belum pernah kita datangi. Satu paragraf dapat membuat kita mempertanyakan sesuatu yang selama ini kita anggap biasa.\n\nKarena itu, membaca bukan sekadar tentang berapa banyak halaman yang selesai. Ia tentang berapa banyak cara baru untuk memahami kehidupan yang kita temukan.','cover-3','◌')
) v(title,author,category,description,content,cover,cover_symbol)
where not exists (select 1 from public.works);
