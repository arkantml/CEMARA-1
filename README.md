# CEMARA — Supabase Edition

CEMARA adalah platform literasi digital untuk membaca dan menampilkan karya seperti cerpen, puisi, esai, artikel, seni, dan karya lainnya.

Versi ini menggunakan **Supabase sebagai database sungguhan**, sementara **Netlify digunakan sebagai hosting frontend**.

---

## ✦ Fitur CEMARA

- 📚 Menampilkan daftar karya
- 🔎 Pencarian karya
- 🏷️ Filter berdasarkan kategori
- 📖 Reader khusus untuk membaca karya
- 📝 Mendukung karya berbasis tulisan
- 🖼️ Mendukung karya berbasis gambar/komik
- 🔍 Zoom gambar pada reader
- 🖱️ Drag gambar ketika sedang diperbesar
- ⌨️ Navigasi halaman menggunakan keyboard
- 🌙 Dark mode pada reader
- 💬 Sistem komentar
- 👤 Komentar dapat dikirim tanpa login
- 🛡️ Sistem admin berbasis Supabase Auth
- 🔐 Row Level Security (RLS)

---

# ⚙️ Struktur Database

CEMARA menggunakan tiga tabel utama:

### `works`

Menyimpan data karya.

Kolom utama:

- `id`
- `title`
- `author`
- `category`
- `description`
- `content`
- `cover`
- `cover_symbol`
- `published_at`
- `created_at`
- `updated_at`

### `comments`

Menyimpan komentar pembaca.

Kolom utama:

- `id`
- `work_id`
- `user_id`
- `name`
- `content`
- `created_at`
- `updated_at`

### `admin_profiles`

Menyimpan daftar pengguna yang memiliki hak akses administrator.

Kolom:

- `user_id`
- `created_at`

---

# 🚀 Langkah Pemasangan

## 1. Buat Project Supabase

Buat satu project baru di Supabase.

Setelah project selesai dibuat, buka dashboard project tersebut.

---

## 2. Jalankan Database

Buka:

**Supabase → SQL Editor**

Kemudian jalankan seluruh isi file:

```text
schema.sql
