# Sistem Filter Komentar CEMARA - Danger Box

## Deskripsi

Sistem filter komentar otomatis yang mendeteksi dan membatasi komentar dengan konten tidak pantas atau bahasa kasar. Komentar yang terindikasi akan masuk ke dalam **Danger Box** untuk direview oleh admin.

## Fitur Utama

### 1. **Client-Side Filtering** (app.js)
- Validasi real-time saat pengguna mengirim komentar
- Deteksi:
  - Huruf besar berlebihan (>70%)
  - Karakter berulang (!!!!, ????)
  - Kata-kata yang tidak pantas
  - Komentar terlalu pendek
- Jika terdeteksi, komentar ditolak dengan pesan alasan

### 2. **Server-Side Filtering** (Database Trigger)
- Validasi di level database menggunakan PostgreSQL function
- Automatic status assignment: `approved`, `pending`, atau `flagged`
- Kolom tambahan: `is_inappropriate`, `flagged_reason`

### 3. **Danger Box - Admin Panel**
- Tampilan terpisah untuk komentar terindikasi
- Fitur approve/reject dengan satu klik
- Approved: Komentar ditampilkan di halaman publik
- Reject: Komentar dihapus

### 4. **RLS Policies** (Row-Level Security)
- Admin hanya bisa lihat flagged comments
- Users hanya lihat approved comments
- Secure & isolated data access

## Instalasi

### Step 1: Jalankan Database Migration
```sql
-- Buka Supabase SQL Editor
-- Copy-paste seluruh isi file schema_v3_comment_filter.sql
-- Klik "Run" untuk mengeksekusi
```

File migration melakukan:
- Tambah 5 kolom baru ke tabel `comments`
- Create index untuk performa
- Create PostgreSQL function untuk content checking
- Setup database trigger
- Setup RLS policies

### Step 2: File yang Sudah Diupdate
- `app.js` - Tambah client-side content check
- `admin/admin.js` - Tambah danger box UI & actions
- `admin/index.html` - Tambah danger box section
- `shared.js` - Tambah utility function untuk filter

**Tidak perlu setup manual lagi!**

## Cara Kerja

### Flow Komentar Normal ✓
```
User ketik komentar → Client check ✓ → Submit ke DB → DB trigger check ✓ → status = 'approved' → Tampil di halaman
```

### Flow Komentar Terindikasi ⚠️
```
User ketik komentar → Client check ✗ → Toast warning → Tidak terkirim
```

### Flow Komentar Server Flagged 🚩
```
User ketik komentar → Client check ✓ → Submit ke DB → DB trigger check ✗ → status = 'flagged' → Masuk Danger Box
```

## Database Schema

### Kolom Baru di `comments` Table

| Kolom | Tipe | Default | Deskripsi |
|-------|------|---------|-----------|
| `status` | text | 'pending' | approved \| pending \| flagged |
| `is_inappropriate` | boolean | false | True jika konten tidak pantas |
| `flagged_reason` | text | NULL | Alasan mengapa flagged |
| `reviewed_at` | timestamptz | NULL | Kapan admin mereview |
| `reviewed_by` | uuid | NULL | User ID admin yang review |

## Kata-Kata Terlarang (Default)

### Indonesian
- bodoh, goblok, bangsat, brengsek, setan
- anjing, monyet, babi, kambing, tahi, tai
- omdo, nyebur, ngegas, ngancam, cebong, begundal
- dalang, puppet, cacat, gila, sakit, penyakit

### English
- bitch, fuck, damn, hell, ass, kontol

### Bisa Dikustomisasi
Edit array `badWords` di:
- `shared.js` - Client side
- `schema_v3_comment_filter.sql` - Server side

## Admin Panel - Danger Box

### Lokasi
Tab "Komentar Pembaca" → Scroll ke bawah → **Danger Box - Komentar Terindikasi**

### Kolom
1. **Nama** - Nama pengirim komentar
2. **Isi Komentar** - Preview teks komentar
3. **Alasan** - Mengapa terindikasi (tag merah)
4. **Waktu** - Kapan komentar dikirim
5. **Aksi** - Tombol Terima / Hapus

### Aksi Admin

#### 💚 Terima (Approve)
- Komentar dipindahkan dari Danger Box
- Status berubah menjadi `approved`
- Komentar tampil di halaman publik
- Dihitung di statistik komentar

#### 🗑️ Hapus
- Komentar dihapus permanen
- Tidak ada di Danger Box
- User tidak tahu di-reject

## Tips & Best Practices

### Untuk Admin
- ✅ Review Danger Box secara berkala
- ✅ Beberapa komentar mungkin false positive
- ✅ Jika komentar valid, langsung klik "Terima"
- ❌ Jangan hapus komentar tanpa review
- ❌ Jangan biarkan Danger Box bertumpuk

### Untuk Users
- ✅ Tulis komentar dengan sopan
- ✅ Hindari huruf besar berlebihan
- ✅ Hindari karakter berulang (!!!!, ????)
- ❌ Jangan gunakan bahasa kasar
- ❌ Jangan gunakan spam/gibberish

### Kustomisasi Lebih Lanjut

Jika ingin tambah kata terlarang:
```javascript
// Di shared.js - Tambah ke array badWords
const badWords = [
  // existing words...
  'kata_baru_yang_tidak_pantas'
];
```

Atau edit SQL function untuk logic yang lebih kompleks:
```sql
-- Di schema_v3_comment_filter.sql
-- Edit: CREATE OR REPLACE FUNCTION check_comment_content()
```

## Troubleshooting

### Komentar tidak masuk Danger Box
- Check: Migration sudah dijalankan?
- Check: Database trigger aktif di Supabase?

### Danger Box tidak muncul di admin panel
- Refresh halaman admin
- Clear browser cache
- Check: User adalah admin/super_admin/dev?

### False Positive Terlalu Banyak
- Naikkan threshold acceptance (edit badWords list)
- Atau reduce excessive caps check dari 70% → 80%

### Komentar hilang setelah approve
- Check status di database (biasanya sudah 'approved')
- Mungkin butuh page reload untuk lihat update

## API Reference

### `window.CEMARA.checkCommentContent(text)`

Check konten komentar secara client-side.

**Parameter:**
- `text` (string) - Isi komentar

**Returns:**
```javascript
{
  flagged: boolean,      // true = tidak pantas, false = ok
  reason: string         // Alasan jika flagged
}
```

**Contoh:**
```javascript
const result = window.CEMARA.checkCommentContent("Brengsek!");
console.log(result);
// { flagged: true, reason: "Komentar mengandung bahasa yang tidak pantas" }
```

## Database Functions

### `check_comment_content(comment_text TEXT)`
Server-side validation logic menggunakan PostgreSQL.

### `review_comment(comment_id UUID, new_status TEXT, reviewer_id UUID)`
Admin function untuk mereview komentar.

```sql
SELECT review_comment(
  'uuid-komentar-123',
  'approved',
  'uuid-admin-456'
);
```

## Security Notes

- ✅ RLS policies mencegah user lihat komentar terindikasi
- ✅ Admin-only function untuk review comments
- ✅ Audit trail: `reviewed_at` & `reviewed_by`
- ✅ Immutable flagged reason untuk audit

## Changelog

### v3.0 (Current)
- ✅ Initial danger box system
- ✅ Client-side filtering
- ✅ Server-side validation
- ✅ Admin review interface
- ✅ RLS policies

### Future (v3.1)
- ⏳ ML-based content detection
- ⏳ Customizable filter settings per admin
- ⏳ Statistics dashboard
- ⏳ Bulk actions untuk danger box
