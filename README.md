# CEMARA — Supabase Edition

CEMARA sekarang menggunakan **Supabase sebagai database sungguhan**. Netlify tetap dipakai untuk hosting frontend.

## Langkah pemasangan

### 1. Buat project Supabase
Buat satu project di Supabase.

### 2. Jalankan database
Buka **SQL Editor**, lalu jalankan seluruh isi `supabase_schema.sql`.

SQL tersebut membuat:
- `works` untuk karya
- `comments` untuk komentar global
- `admin_profiles` untuk daftar admin
- RLS/policies untuk keamanan
- 3 contoh karya

### 3. Buat akun admin
Di **Authentication → Users**, buat akun email/password untuk pengelola.

Copy UUID user tersebut, lalu di SQL Editor jalankan:

`insert into public.admin_profiles (user_id) values ('UUID-USER');`

### 4. Isi config.js
Masukkan Project URL dan **Publishable Key** dari Supabase. Jangan masukkan secret/service-role key.

### 5. Test lokal
Gunakan Live Server atau server lokal. Jangan mengandalkan `file://` bila browser memblokir request.

### 6. Deploy ke Netlify
Upload folder ini ke Netlify. Frontend statis tetap bisa menggunakan Supabase Data API.

## Perilaku komentar
- Semua pengunjung dapat membaca komentar.
- Pengunjung tanpa login dapat mengirim komentar.
- User yang login dapat mengedit/menghapus komentarnya sendiri.
- Admin dapat mengedit/menghapus semua komentar.

## Catatan keamanan
RLS wajib aktif. Frontend hanya memakai publishable key. **Jangan pernah menaruh secret/service-role key di `config.js` atau JavaScript browser.**

## Tahap berikutnya
Dashboard admin penuh dapat ditambahkan agar Duta Literasi bisa menambah/edit/hapus karya, upload cover, dan moderasi komentar langsung dari `/admin`, tanpa membuka Supabase Table Editor.
