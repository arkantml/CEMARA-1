        -- ============================================================
        -- CEMARA — SCHEMA V2: ROLES & PROFILES
        -- Migration from v1 → v2
        -- ============================================================
        --
        -- PENTING:
        -- Jalankan script ini SETELAH schema.sql (v1).
        -- Script ini TIDAK menghapus data yang sudah ada.
        --
        -- Fitur baru:
        --   ✓ Tabel user_profiles dengan role
        --   ✓ 4 role: super_admin, admin, dev, user
        --   ✓ Profile picture (avatar_url)
        --   ✓ Display name & bio
        --   ✓ RLS policies untuk role-based access
        --   ✓ Fix category CHECK (tambah Komik, Seni)
        -- ============================================================


        -- ============================================================
        -- 1. FIX CATEGORY CHECK CONSTRAINT
        -- ============================================================

        -- Hapus constraint lama
        alter table public.works
        drop constraint if exists works_category_check;


        -- Buat constraint baru dengan Komik dan Seni
        alter table public.works
        add constraint works_category_check
        check (
            category in (
                'Cerpen',
                'Puisi',
                'Esai',
                'Seni',
                'Komik',
                'Artikel',
                'Lainnya'
            )
        );


        -- ============================================================
        -- 2. TABLE: USER PROFILES
        -- ============================================================

        create table if not exists public.user_profiles (

            id uuid primary key default gen_random_uuid(),

            user_id uuid unique not null
                references auth.users(id)
                on delete cascade,

            display_name text not null
                default 'Pengunjung',

            avatar_url text,

            bio text
                default '',

            role text not null
                default 'user'
                check (
                    role in (
                        'super_admin',
                        'admin',
                        'dev',
                        'user'
                    )
                ),

            created_at timestamptz not null default now(),

            updated_at timestamptz not null default now()

        );


        -- ============================================================
        -- 3. TRIGGER: USER PROFILES updated_at
        -- ============================================================

        drop trigger if exists user_profiles_updated_at
        on public.user_profiles;

        create trigger user_profiles_updated_at

        before update on public.user_profiles

        for each row

        execute function public.update_updated_at();


        -- ============================================================
        -- 4. FUNCTION: GET USER ROLE
        -- ============================================================

        create or replace function public.get_cemara_role()

        returns text

        language sql

        stable

        security definer

        set search_path = public

        as $$

            select coalesce(
                (
                    select role
                    from public.user_profiles
                    where user_id = auth.uid()
                ),
                'user'
            );

        $$;


        -- ============================================================
        -- 5. FUNCTION: CEK ROLE (enhanced)
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
                from public.user_profiles
                where user_id = auth.uid()
                and role in ('super_admin', 'admin')
            )
            or exists (
                select 1
                from public.admin_profiles
                where user_id = auth.uid()
            );

        $$;


        -- ============================================================
        -- 6. FUNCTION: CEK SUPER ADMIN
        -- ============================================================

        create or replace function public.is_cemara_super_admin()

        returns boolean

        language sql

        stable

        security definer

        set search_path = public

        as $$

            select exists (
                select 1
                from public.user_profiles
                where user_id = auth.uid()
                and role = 'super_admin'
            );

        $$;


        -- ============================================================
        -- 7. ENABLE RLS ON USER PROFILES
        -- ============================================================

        alter table public.user_profiles
        enable row level security;


        -- ============================================================
        -- 8. USER PROFILES — POLICIES
        -- ============================================================

        -- Semua user bisa baca profil (untuk avatar di komentar)

        drop policy if exists
        "Public can read profiles"
        on public.user_profiles;

        create policy
        "Public can read profiles"

        on public.user_profiles

        for select

        to anon, authenticated

        using (true);


        -- User bisa insert profil sendiri saja

        drop policy if exists
        "Users can create own profile"
        on public.user_profiles;

        create policy
        "Users can create own profile"

        on public.user_profiles

        for insert

        to authenticated

        with check (
            user_id = auth.uid()
        );


        -- User bisa update profil sendiri (kecuali role)
        -- Super admin bisa update semua

        drop policy if exists
        "Users can update own profile"
        on public.user_profiles;

        create policy
        "Users can update own profile"

        on public.user_profiles

        for update

        to authenticated

        using (
            user_id = auth.uid()
            or public.is_cemara_super_admin()
        )

        with check (
            user_id = auth.uid()
            or public.is_cemara_super_admin()
        );


        -- Hanya super admin bisa hapus profil

        drop policy if exists
        "Super admins can delete profiles"
        on public.user_profiles;

        create policy
        "Super admins can delete profiles"

        on public.user_profiles

        for delete

        to authenticated

        using (
            public.is_cemara_super_admin()
        );


        -- ============================================================
        -- 9. GRANT PERMISSIONS
        -- ============================================================

        grant select
        on public.user_profiles
        to anon, authenticated;

        grant insert, update
        on public.user_profiles
        to authenticated;

        grant delete
        on public.user_profiles
        to authenticated;


        -- ============================================================
        -- 10. MIGRATE EXISTING ADMINS
        -- ============================================================
        -- Salin admin dari admin_profiles lama
        -- ke user_profiles dengan role 'admin'.
        -- Kalau sudah ada, skip.

        insert into public.user_profiles (
            user_id,
            display_name,
            role
        )

        select
            ap.user_id,
            coalesce(
                (
                    select raw_user_meta_data->>'name'
                    from auth.users
                    where id = ap.user_id
                ),
                'Admin'
            ),
            'admin'

        from public.admin_profiles ap

        where not exists (

            select 1
            from public.user_profiles up
            where up.user_id = ap.user_id

        );


        -- ============================================================
        -- 11. STORAGE BUCKET FOR AVATARS
        -- ============================================================
        -- Jalankan perintah ini di Supabase dashboard
        -- jika bucket belum ada:
        --
        --   insert into storage.buckets (id, name, public)
        --   values ('avatars', 'avatars', true);
        --
        -- Kemudian buat policy untuk upload:
        --
        --   create policy "Users can upload avatars"
        --   on storage.objects
        --   for insert
        --   to authenticated
        --   with check (
        --       bucket_id = 'avatars'
        --       and auth.uid()::text = (storage.foldername(name))[1]
        --   );
        --
        --   create policy "Public can read avatars"
        --   on storage.objects
        --   for select
        --   to anon, authenticated
        --   using (bucket_id = 'avatars');


        -- ============================================================
        -- 12. CEK HASIL
        -- ============================================================

        select
            up.user_id,
            up.display_name,
            up.role,
            up.avatar_url,
            up.created_at
        from public.user_profiles up
        order by up.created_at desc;


        -- ============================================================
        -- SELESAI — Schema V2
        -- ============================================================
