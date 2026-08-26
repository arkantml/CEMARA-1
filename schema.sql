-- ============================================================
-- CEMARA — SUPABASE DATABASE
-- FULL SCHEMA
-- ============================================================
-- Cocok dengan:
--   app.js
--   reader.js
--   index.html
--   reader.html
--
-- Mendukung:
--   ✓ Karya tulisan
--   ✓ Karya komik/gambar
--   ✓ image_urls sebagai TEXT[]
--   ✓ Komentar
--   ✓ Admin
--   ✓ Row Level Security
-- ============================================================


-- ============================================================
-- 1. EXTENSION
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- 2. TABLE: WORKS
-- ============================================================

create table if not exists public.works (

    id uuid primary key default gen_random_uuid(),

    title text not null,

    author text not null,

    category text not null
        check (
            category in (
                'Cerpen',
                'Puisi',
                'Esai',
                'Seni',
                'Artikel',
                'Lainnya'
            )
        ),

    description text not null default '',

    content text not null default '',

    cover text default 'cover-1',

    cover_symbol text default '✦',

    -- ========================================================
    -- PENTING:
    -- image_urls HARUS TEXT[]
    -- BUKAN JSONB
    -- ========================================================

    image_urls text[] not null default '{}',

    published_at timestamptz not null default now(),

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);


-- ============================================================
-- 3. JIKA works SUDAH ADA
--    Pastikan kolom image_urls tersedia
-- ============================================================

alter table public.works
add column if not exists image_urls text[];


-- Isi NULL menjadi array kosong
update public.works
set image_urls = '{}'
where image_urls is null;


-- Jadikan default array kosong
alter table public.works
alter column image_urls
set default '{}';


-- ============================================================
-- 4. TABLE: COMMENTS
-- ============================================================

create table if not exists public.comments (

    id uuid primary key default gen_random_uuid(),

    work_id uuid not null
        references public.works(id)
        on delete cascade,

    user_id uuid
        references auth.users(id)
        on delete set null,

    name text not null
        check (char_length(name) between 1 and 40),

    content text not null
        check (char_length(content) between 1 and 500),

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);


-- ============================================================
-- 5. TABLE: ADMIN PROFILES
-- ============================================================

create table if not exists public.admin_profiles (

    user_id uuid primary key
        references auth.users(id)
        on delete cascade,

    created_at timestamptz not null default now()

);


-- ============================================================
-- 6. FUNCTION: CEK ADMIN
-- ============================================================

create or replace function public.is_cemara_admin()

returns boolean

language sql

stable

security definer

set search_path = public

as $$

    select exists (

        select 1

        from public.admin_profiles

        where user_id = auth.uid()

    );

$$;


-- ============================================================
-- 7. FUNCTION: UPDATE updated_at
-- ============================================================

create or replace function public.update_updated_at()

returns trigger

language plpgsql

as $$

begin

    new.updated_at = now();

    return new;

end;

$$;


-- ============================================================
-- 8. TRIGGER WORKS
-- ============================================================

drop trigger if exists works_updated_at
on public.works;

create trigger works_updated_at

before update on public.works

for each row

execute function public.update_updated_at();


-- ============================================================
-- 9. TRIGGER COMMENTS
-- ============================================================

drop trigger if exists comments_updated_at
on public.comments;

create trigger comments_updated_at

before update on public.comments

for each row

execute function public.update_updated_at();


-- ============================================================
-- 10. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.works
enable row level security;

alter table public.comments
enable row level security;

alter table public.admin_profiles
enable row level security;


-- ============================================================
-- 11. WORKS — HAPUS POLICY LAMA
-- ============================================================

drop policy if exists
"Public can read works"
on public.works;

drop policy if exists
"Admins can insert works"
on public.works;

drop policy if exists
"Admins can update works"
on public.works;

drop policy if exists
"Admins can delete works"
on public.works;


-- ============================================================
-- 12. WORKS — PUBLIC READ
-- ============================================================

create policy
"Public can read works"

on public.works

for select

to anon, authenticated

using (true);


-- ============================================================
-- 13. WORKS — ADMIN INSERT
-- ============================================================

create policy
"Admins can insert works"

on public.works

for insert

to authenticated

with check (
    public.is_cemara_admin()
);


-- ============================================================
-- 14. WORKS — ADMIN UPDATE
-- ============================================================

create policy
"Admins can update works"

on public.works

for update

to authenticated

using (
    public.is_cemara_admin()
)

with check (
    public.is_cemara_admin()
);


-- ============================================================
-- 15. WORKS — ADMIN DELETE
-- ============================================================

create policy
"Admins can delete works"

on public.works

for delete

to authenticated

using (
    public.is_cemara_admin()
);


-- ============================================================
-- 16. COMMENTS — HAPUS POLICY LAMA
-- ============================================================

drop policy if exists
"Public can read comments"
on public.comments;

drop policy if exists
"Anyone can post comments"
on public.comments;

drop policy if exists
"Owners or admins can edit comments"
on public.comments;

drop policy if exists
"Owners or admins can delete comments"
on public.comments;


-- ============================================================
-- 17. COMMENTS — SEMUA ORANG BISA BACA
-- ============================================================

create policy
"Public can read comments"

on public.comments

for select

to anon, authenticated

using (true);


-- ============================================================
-- 18. COMMENTS — SEMUA ORANG BISA KIRIM
-- ============================================================

create policy
"Anyone can post comments"

on public.comments

for insert

to anon, authenticated

with check (true);


-- ============================================================
-- 19. COMMENTS — PEMILIK / ADMIN BISA EDIT
-- ============================================================

create policy
"Owners or admins can edit comments"

on public.comments

for update

to authenticated

using (
    user_id = auth.uid()
    or public.is_cemara_admin()
)

with check (
    user_id = auth.uid()
    or public.is_cemara_admin()
);


-- ============================================================
-- 20. COMMENTS — PEMILIK / ADMIN BISA HAPUS
-- ============================================================

create policy
"Owners or admins can delete comments"

on public.comments

for delete

to authenticated

using (
    user_id = auth.uid()
    or public.is_cemara_admin()
);


-- ============================================================
-- 21. ADMIN PROFILES — HAPUS POLICY LAMA
-- ============================================================

drop policy if exists
"Admins can read own admin profile"
on public.admin_profiles;


-- ============================================================
-- 22. ADMIN PROFILES — ADMIN BISA BACA DIRINYA SENDIRI
-- ============================================================

create policy
"Admins can read own admin profile"

on public.admin_profiles

for select

to authenticated

using (
    user_id = auth.uid()
);


-- ============================================================
-- 23. GRANT PERMISSIONS
-- ============================================================

grant select
on public.works
to anon, authenticated;

grant insert, update, delete
on public.works
to authenticated;


grant select, insert
on public.comments
to anon, authenticated;

grant update, delete
on public.comments
to authenticated;


grant select
on public.admin_profiles
to authenticated;


-- ============================================================
-- 24. SAMPLE WORKS
-- ============================================================
-- Hanya dimasukkan kalau works masih kosong.
--
-- image_urls menggunakan TEXT[]
-- BUKAN JSONB.
--
-- Jadi TIDAK akan muncul error:
-- "column image_urls is of type text[] but expression is jsonb"
-- ============================================================

insert into public.works (

    title,
    author,
    category,
    description,
    content,
    cover,
    cover_symbol,
    image_urls

)

select *

from (

    values

    (
        'Di Ujung Senja',

        'Alya Ramadhani',

        'Cerpen',

        'Sebuah cerita tentang pertemuan, pilihan kecil, dan keberanian untuk memulai kembali.',

        E'Senja turun perlahan di balik gedung sekolah.\n\nAda hal-hal yang tidak perlu dijelaskan terlalu panjang. Kadang sebuah perpisahan hanya meminta kita untuk menerima, lalu melanjutkan perjalanan dengan hati yang lebih lapang.\n\nMungkin besok akan berbeda. Tetapi untuk hari ini, aku memilih percaya bahwa setiap akhir selalu menyisakan sebuah jalan baru.',

        'cover-1',

        '✦',

        '{}'::text[]

    ),

    (

        'Hujan di Halaman Sekolah',

        'Fauzan Akbar',

        'Puisi',

        'Puisi reflektif tentang hujan, kenangan sekolah, dan hal-hal sederhana yang lama tinggal di ingatan.',

        E'Hujan datang tanpa mengetuk. Membasahi halaman yang kemarin penuh suara langkah dan tawa.\n\nDi antara rintiknya, ada kenangan yang tumbuh diam-diam: bangku kelas, buku yang terbuka, dan percakapan yang tidak pernah selesai.\n\nBarangkali begitulah sekolah tinggal di dalam kita—bukan sebagai gedung, melainkan sebagai cerita yang terus pulang.',

        'cover-2',

        '☂',

        '{}'::text[]

    ),

    (

        'Membaca untuk Menemukan',

        'Nadia Putri',

        'Esai',

        'Esai singkat tentang kebiasaan membaca sebagai cara mengenali diri dan memahami dunia.',

        E'Membaca bukan hanya kegiatan memindahkan kata dari halaman ke pikiran. Membaca adalah latihan untuk melihat dunia dari jendela yang berbeda.\n\nSatu buku dapat membawa kita ke tempat yang belum pernah kita datangi. Satu paragraf dapat membuat kita mempertanyakan sesuatu yang selama ini kita anggap biasa.\n\nKarena itu, membaca bukan sekadar tentang berapa banyak halaman yang selesai. Ia tentang berapa banyak cara baru untuk memahami kehidupan yang kita temukan.',

        'cover-3',

        '◌',

        '{}'::text[]

    )

) as sample_data(

    title,
    author,
    category,
    description,
    content,
    cover,
    cover_symbol,
    image_urls

)

where not exists (

    select 1
    from public.works

);


-- ============================================================
-- 25. CEK HASIL
-- ============================================================

select

    id,

    title,

    author,

    category,

    array_length(image_urls, 1) as jumlah_gambar,

    created_at

from public.works

order by created_at desc;


-- ============================================================
-- SELESAI
-- ============================================================
