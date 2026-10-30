# HDIR App — Attendance App

Aplikasi absensi karyawan multi-platform dengan **GPS Geofencing** (server-side, rumus Haversine), foto selfie, mode absen jarak jauh (membutuhkan persetujuan HR), pengajuan & kuota cuti tahunan, serta dashboard manajemen HR berbasis web.

> **Status verifikasi wajah (jujur): verifikasi wajah kini NYATA, bukan simulasi.** `POST /api/v1/face/enroll` dan `POST /api/v1/face/verify` mengekstrak deskriptor 128-dim di server dengan face-api.js (ssdMobilenetv1 + faceLandmark68Net + faceRecognitionNet, backend CPU tfjs murni — tanpa binary native canvas) dan membandingkan dengan jarak euclidean, ambang 0.6. Check-in WAJIB lolos verifikasi ini sebelum record dibuat: tanpa wajah terdaftar, wajah tidak cocok, atau model tidak termuat, check-in ditolak dan tidak ada record. Diuji di VM pada 2026-10-30: foto yang sama berjarak 0.0 (cocok), orang berbeda berjarak ~0.90 (ditolak), foto tanpa wajah ditolak. Batasan yang tetap berlaku: TIDAK ada deteksi keaktifan (liveness) — foto cetak dari orang yang terdaftar akan cocok — dan verifikasi hanya memakai JPEG/PNG (bukan WebP). Detail lengkap di bawah, di bagian "Verifikasi wajah" dan "Batasan yang masih berlaku".

Proyek ini dibangun menggunakan arsitektur **Monorepo (Turborepo)** dengan komponen berikut:
- **`apps/api`**: Backend API (NestJS + Prisma + SQLite)
- **`apps/web-dashboard`**: Web Dashboard HR Admin (Next.js)
- **`apps/mobile-android`**: Aplikasi Karyawan Mobile (React Native / Expo)
- **`packages/core`**: API Client Shared Package (Axios)

---

## 🌟 Fitur Utama

1. **GPS Geofencing (server-side)**: Deteksi otomatis apakah karyawan berada di dalam radius kantor (*Normal*) atau di luar radius (*Jarak Jauh*) menggunakan jarak koordinat bumi (Haversine Formula). Koordinat wajib dan divalidasi ketat — absen tanpa lokasi tidak pernah lolos sebagai normal/approved.
2. **Absen Jarak Jauh (Remote)**: Memerlukan pengisian alasan penjelas (check-in maupun check-out) dan persetujuan manual oleh HR Admin. Hanya satu check-in per user per hari; check-out wajib setelah check-in.
3. **Manajemen Kuota Cuti**: Pengajuan cuti dari HP terintegrasi langsung dengan pemotongan saldo kuota tahunan di server saat disetujui — dalam satu transaksi Prisma, dengan guard status (double-approve ditolak), cek kecukupan ulang saat approve, dan pengembalian kuota bila cuti yang sudah di-approve kemudian ditolak.
4. **Dashboard HR (Web)**: Menu persetujuan absen & cuti (*Approval Center*), serta manajemen data karyawan/kantor. Bukan real-time: tidak ada WebSocket/polling; angka dashboard dihitung dari API (bukan hardcode), termasuk "Hadir Hari Ini" dari `GET /attendance/today-summary` (HR/admin).
5. **Keamanan**: Login dengan password bcrypt + JWT (access ~1 jam, refresh ~7 hari, refresh dirotasi dan DIHAPUS saat logout/rotasi; token kedaluwarsa dibersihkan tiap jam oleh `TokenCleanupService`), guard + RBAC (admin/hr/employee) dari token — bukan dari body request. `password_hash` dan `face_embedding` tidak pernah dikembalikan API. Rate limiting: 100 req/menit/IP untuk semua API, login diperketat 10/menit/IP (429 bila melebihi). Foto selfie TIDAK lagi diserve publik: hanya `GET /api/v1/photos/:filename` dengan token, untuk pemilik foto atau HR/admin.
6. **Verifikasi wajah (nyata)**: lihat banner di atas dan bagian "Verifikasi wajah".
7. **Notifikasi & AuditLog (nyata)**: pengajuan cuti / absen remote memberi notifikasi in-app ke HR/admin, dan keputusan memberi notifikasi ke karyawan (`GET /api/v1/notifications`, tandai dibaca per item/all). Setiap aksi penting (login, buat/ubah/nonaktifkan user, buat/ubah/hapus kantor, buat/setujui/tolak cuti, setujui/tolak absen remote, enroll wajah, bind device) menulis baris AuditLog yang bisa dibaca HR/admin di `GET /api/v1/audit-logs`. Notifikasi di sini adalah inbox in-app — TIDAK ada push notification (FCM/APNs).
8. **Laporan & export**: `GET /api/v1/reports/attendance?from=&to=&userId=` mengembalikan rekap harian per user (check-in/out, menit kerja, telat, lembur) dan `GET /api/v1/reports/attendance/export` mengembalikan CSV yang sama. Telat/lembur dihitung dari jam kerja `WORK_START_TIME`/`WORK_END_TIME` (default 08:00–17:00, satu nilai untuk semua — belum ada jadwal/shift per kantor atau per user).
9. **Device binding (nyata, tanpa enforcement absen)**: `POST /api/v1/device/bind` dan `GET /api/v1/device/is-bound` kini membaca/menulis tabel `Device` yang sesungguhnya. Yang BELUM: absen tidak menolak device yang belum di-bind — binding tercatat dan bisa dicek, tapi belum menjadi gerbang absen.
10. **Jenis cuti**: `GET /api/v1/leave/types` (semua user) dan `POST /api/v1/leave/types` (admin) — sebelumnya hanya ada baris seed dan mobile terpaksa hardcode `leave_type_id: 1`. Mobile saat ini masih default ke id 1 sampai ada pemilih jenis cuti di form.

---

## 🚀 Memulai Proyek (Getting Started)

### Prasyarat
- **Node.js** (v18 atau lebih baru)
- **Git**

### Langkah 1: Kloning & Instalasi
1. Kloning repositori:
   ```bash
   git clone https://github.com/YanNotTamm/HDIRApp-AttendanceApp.git
   cd HDIRApp-AttendanceApp
   ```
2. Instal seluruh dependensi di akar folder (*root* monorepo):
   ```bash
   npm install
   ```

### Langkah 2: Setup Database (SQLite) + Seed
Aplikasi ini sudah dikonfigurasi menggunakan SQLite agar mudah dijalankan secara lokal tanpa ribet menginstal server database tambahan. **Catatan:** database yang dipakai adalah SQLite (bukan MySQL seperti disebut di `instructions.md` lama); migrasi Prisma tersedia di `apps/api/prisma/migrations/`.
1. Masuk ke folder backend:
   ```bash
   cd apps/api
   ```
2. Buat file `.env` dari `.env.example` dan isi `JWT_SECRET` (server **menolak start** tanpa JWT_SECRET) serta `DATABASE_URL` (mis. `file:./dev.db`):
   ```bash
   cp .env.example .env
   # isi JWT_SECRET dengan hasil: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Generate Prisma Client, migrasi, dan seed:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npm run db:seed
   ```
   Catatan jaringan (terbukti di VM 2026-10-30): `prisma generate` kadang gagal `ECONNRESET` saat mengunduh engine dari `binaries.prisma.sh`. Bila itu terjadi dan Anda sudah punya engine di cache (`~/.cache/prisma/...`), layani engine itu lewat mirror lokal — contoh yang berhasil dipakai di sini: salin `libquery_engine.so.node` + `schema-engine` dari cache ke `node_modules/@prisma/engines/` dengan nama `libquery_engine-debian-openssl-3.0.x.so.node` / `schema-engine-debian-openssl-3.0.x`, buat versi `.gz` + file `.sha256`-nya, jalankan server HTTP lokal di folder mirror, lalu `PRISMA_ENGINES_MIRROR=http://127.0.0.1:8899 npx prisma generate`. Migrasi baru setelah audit: `20261030120000_device` (tabel `Device`).
4. Unduh weights verifikasi wajah (wajib untuk enroll/verify/check-in):
   ```bash
   bash apps/api/scripts/download-face-weights.sh
   # atau set FACE_WEIGHTS_DIR ke folder weights Anda (lihat .env.example)
   ```
   Isi folder: `ssd_mobilenetv1_*`, `face_landmark_68_*`, `face_recognition_*` (±12 MB, dari repo face-api.js). Tanpa weights yang valid, server tetap jalan tapi enroll/verify/check-in menjawab 503 — tidak pernah sukses palsu. Saat boot, log harus memuat `Model wajah dimuat dari ...`.
   Seed membuat roles (admin/hr/employee), 1 kantor contoh (Kantor Pusat, radius 100 m), 1 jenis cuti (Cuti Tahunan, kuota 12), dan 3 user contoh. **Kredensial seed HANYA untuk dev lokal — ganti/disable sebelum produksi:**
   - Admin: `admin@example.com` / `Admin123!`
   - HR: `hr@example.com` / `Hr123456!`
   - Karyawan: `employee@example.com` / `Employee123!`
4. Jangan pernah commit file `*.db` berisi data nyata (sudah di-`.gitignore`); foto selfie disimpan sebagai file di `apps/api/uploads/` (maks 2 MB, JPEG/PNG/WebP), bukan base64 mentah di database.

### Verifikasi wajah — cara kerja & apa yang sudah dibuktikan
- **Model**: face-api.js 0.22.2, `ssdMobilenetv1` (deteksi) + `faceLandmark68Net` (landmark) + `faceRecognitionNet` (deskriptor 128-dim). Weights di `apps/api/weights/` (unduh via `apps/api/scripts/download-face-weights.sh`).
- **Tanpa canvas native**: face-api menerima `Tensor3D` sebagai input, jadi decode gambar dilakukan dengan jpeg-js (JPEG) / pngjs (PNG) dan inferensi berjalan di backend CPU `@tensorflow/tfjs` murni. Ini yang membuat model bisa jalan di VM ini padahal instalasi `canvas` native selalu gagal. Konsekuensinya: latensi CPU — enroll satu foto ±9 detik di VM ini; foto di-downscale ke sisi maks 1280 px sebelum deteksi.
- **Ambang**: jarak euclidean ≤ 0.6 = cocok (konvensi face-api/dlib; lihat `apps/api/src/face/distance.ts`). `face_match_score` di record absen adalah jarak euclidean itu (semakin kecil semakin mirip), BUKAN skor kemiripan 0–1.
- **Alur**: enroll = kirim foto → server ekstrak deskriptor → simpan JSON-nya di `face_embedding` (tidak pernah dikembalikan API). Verify/check-in = kirim selfie → server ekstrak → bandingkan dengan yang tersimpan. Endpoint TIDAK PERNAH menerima deskriptor dari client, jadi kecocokan tidak bisa dipalsukan dari client. Check-in tanpa selfie ditolak; check-out memverifikasi bila selfie dikirim, tanpa selfie ia berjalan dengan GPS saja (asimetri ini disengaja dan didokumentasikan di `attendance.service.ts`).
- **Terbukti di VM 2026-10-30** (server lokal + foto uji, bukan klaim): enroll foto wajah berhasil; verify foto yang sama jarak 0.0; verify PNG dari foto yang sama cocok; verify orang berbeda jarak 0.8999 (ditolak); foto tanpa wajah ditolak (400); check-in tanpa enroll ditolak dan tidak membuat record; check-in dengan foto orang lain ditolak dan tidak membuat record; check-in dengan foto yang sama berhasil (`face_verified: true`, `face_match_score: 0`, mode normal). Total runtime check putaran ini: 56/56 lolos (termasuk regresi login/401/403, duplicate check-in, kuota cuti, notifikasi, audit, laporan/CSV, rate limit 429, rotasi refresh token). Unit test backend: 7 suite / 35 test lolos (termasuk jarak/ambang dan logika FaceService dengan extractor palsu — test model yang sesungguhnya adalah runtime check di atas, bukan unit test).
- **Yang masih harus diuji di mesin/device pengguna**: wajah dari kamera HP asli (pencahayaan, sudut, kualitas), performa CPU di server produksi (bila lambat, pertimbangkan `@tensorflow/tfjs-node` di server yang mendukungnya — di VM ini sengaja TIDAK dipakai agar tidak bergantung pada binary native), dan perilaku threshold 0.6 pada populasi karyawan yang sebenarnya (kasus orang berbeda yang berjarak 0.67 pernah terlihat pada foto grup — dekat ambang, tapi tetap ditolak).

### Batasan yang masih berlaku (jujur)
- **Tidak ada liveness detection**: foto (termasuk foto cetak/layar) dari orang yang terdaftar akan lolos verifikasi. Jangan klaim ini sebagai anti-spoofing.
- **Verifikasi wajah hanya JPEG/PNG**: WebP ditolak dengan pesan jelas (tidak ada decoder WebP pure-JS yang dibundel). Kamera mobile mengirim JPEG secara default, jadi alur normal tidak terpengaruh.
- **Satu wajah per foto (detectSingleFace)**: foto grup diverifikasi terhadap wajah paling menonjol, yang bisa saja bukan pengguna.
- **Device binding belum di-enforce di absen**: binding tercatat dan bisa dicek, tapi check-in dari device lain tidak ditolak.
- **Tidak ada jadwal/shift per kantor/per user**: laporan memakai satu jam kerja global dari env (`WORK_START_TIME`/`WORK_END_TIME`). Tidak ada model shift, tidak ada aturan lembur khusus, dan pengelompokan harian laporan memakai tanggal UTC (bisa bergeser satu hari untuk server di WIB pada jam larut).
- **Cuti hanya hitungan hari penuh**: kuota memakai bilangan bulat; cuti setengah hari belum didukung dan butuh perubahan schema kuota ke pecahan.
- **Tidak ada manajemen department/role lewat API**: role/department hanya dari seed/DB. Tidak ada lampiran (attachment) cuti: kolom `attachment_url` ada di schema tapi tidak ada endpoint upload-nya.
- **Notifikasi hanya inbox in-app**: tidak ada push (FCM/APNs). AuditLog ditulis secara best-effort: bila penulisannya gagal, operasi bisnis tetap jalan dan kegagalan hanya tercatat di log server.
- **Rate limiting in-memory per IP, single instance**: di balik reverse proxy, aktifkan trust proxy agar IP client yang dihitung benar; untuk multi-instance, ganti dengan store terpusat (mis. Redis). Foto selfie tidak punya signed URL: klien harus fetch `GET /api/v1/photos/:filename` dengan header Authorization (bukan `<img src>` polos).
- **Tidak ada endpoint 501 yang tersisa di backend** setelah putaran ini (semua stub sebelumnya — face, device bind, face-registration — kini nyata). Yang masih 503 (bukan sukses) hanyalah enroll/verify saat model wajah gagal dimuat.
- **Belum teruji di perangkat nyata**: GPS/kamera di lapangan dan seluruh alur mobile di HP Android/iOS asli; begitu pula `next build` dashboard dan `expo export` mobile (yang diverifikasi di sini: build + unit test backend dan runtime API lokal).

### Penyisiran backend putaran ini (status akhir tiap item)
| Item yang tadinya belum terimplementasi | Status akhir |
|---|---|
| Verifikasi wajah (face-api, tadinya 501) | SUDAH DIIMPLEMENTASIKAN (nyata, lihat di atas) |
| Device binding (tadinya 501, tanpa tabel) | SUDAH DIIMPLEMENTASIKAN (tabel `Device` + endpoint nyata; enforcement absen belum) |
| Legacy `POST /employee/face-registration` (tadinya 501) | SUDAH DIIMPLEMENTASIKAN (delegasi ke enroll wajah yang nyata) |
| Notification (model ada, tanpa penulis/endpoint) | SUDAH DIIMPLEMENTASIKAN (inbox in-app + endpoint baca) |
| AuditLog (model ada, tanpa penulis/endpoint) | SUDAH DIIMPLEMENTASIKAN (ditulis di semua aksi penting + endpoint HR/admin) |
| Laporan absen + export CSV (tidak ada) | SUDAH DIIMPLEMENTASIKAN (`/reports/attendance`, CSV) |
| Telat/lembur (tidak ada aturan) | SUDAH DIIMPLEMENTASIKAN sebagian (flag dari jam kerja env global; shift per kantor/user belum) |
| Rekap "Hadir Hari Ini" dashboard (tadinya "-") | SUDAH DIIMPLEMENTASIKAN (`/attendance/today-summary` HR/admin) |
| Rate limiting (tidak ada) | SUDAH DIIMPLEMENTASIKAN (throttler in-memory) |
| Foto selfie diserve publik (tanpa auth) | SUDAH DIIMPLEMENTASIKAN (endpoint terautentikasi pemilik/HR-admin; static `/uploads/` dimatikan) |
| Refresh token menumpuk (hanya revoke) | SUDAH DIIMPLEMENTASIKAN (hapus saat logout/rotasi + cleanup tiap jam) |
| Jenis cuti tanpa endpoint (hanya seed) | SUDAH DIIMPLEMENTASIKAN (list + buat; mobile masih default id 1) |
| Angka marketing palsu di landing page ("Within HQ Geofence (12m)", aktivitas "Yesterday") | SUDAH DIIMPLEMENTASIKAN (dihapus, diganti ajakan login; tombol landing kini mengarah ke /login) |
| Limit body JSON 100 KB (foto JPEG biasa ditolak 413 sebelum validasi) | SUDAH DIIMPLEMENTASIKAN (limit 4 MB, selaras dengan cap DTO ~3 jt karakter) |
| Cuti setengah hari | MASIH BATASAN (kuota integer; butuh perubahan schema) |
| Jadwal/shift per kantor/per user + aturan lembur khusus | MASIH BATASAN (hanya jam kerja global env) |
| Manajemen department/role via API | MASIH BATASAN (seed/DB saja) |
| Lampiran cuti (`attachment_url`) | MASIH BATASAN (kolom ada, endpoint upload tidak ada) |
| Push notification | MASIH BATASAN (hanya inbox in-app) |
| Liveness detection / anti-spoofing | MASIH BATASAN (foto orang terdaftar akan lolos) |
| Sidik jari fisik / payroll otomatis (ide "Peluang Pengembangan" di bawah) | MASIH BATASAN (belum pernah dijanjikan sebagai fitur; tetap ide, bukan klaim) |

---

## 💻 Cara Menjalankan Aplikasi Secara Lokal

Setiap komponen monorepo dapat dijalankan di terminal terpisah:

### 1. Jalankan Backend (NestJS API)
```bash
cd apps/api
npm run start:dev
```
*Server API akan berjalan di `http://localhost:3000/api/v1`.*

### 2. Jalankan Web Dashboard (Next.js HR Portal)
```bash
cd apps/web-dashboard
npm run dev
```
*Web dashboard admin dapat diakses di `http://localhost:3001` (atau port terdekat).*

### 3. Jalankan Aplikasi Mobile (React Native / Expo Karyawan)
```bash
cd apps/mobile-android
npx expo start -c
```
*Tekan tombol **`w`** di terminal Expo untuk membukanya di Web Browser, atau scan QR Code menggunakan aplikasi **Expo Go** di HP Anda.*

---

## 📜 Lisensi & Kontribusi (Open Source GNU GPL v3.0)

Aplikasi HDIR dirilis sebagai perangkat lunak **Open Source** di bawah lisensi **GNU General Public License v3.0**. 

### Hak dan Ketentuan Lisensi:
- **Kebebasan Mengembangkan**: Siapapun diperbolehkan untuk melakukan *fork*, mengubah kode sumber, menyesuaikan fitur, dan mengembangkan aplikasi ini lebih lanjut sesuai kebutuhan instansi atau personal.
- **Distribusi Terbuka**: Jika Anda mengubah atau mendistribusikan ulang aplikasi ini, Anda wajib merilis kode sumber hasil modifikasi tersebut di bawah lisensi yang sama (Copyleft).
- **Penggunaan Gratis**: Tidak ada biaya lisensi untuk menggunakan, memodifikasi, atau menyebarkan aplikasi ini.

### Peluang Pengembangan Lebih Lanjut:
Aplikasi ini sangat terbuka untuk dikembangkan lebih jauh, misalnya:
- Mengintegrasikan sistem absensi dengan mesin sidik jari fisik.
- Menambahkan modul slip gaji (*Payroll*) otomatis berdasarkan rekap absensi.
- Memperluas deteksi kecerdasan buatan (Face AI) dengan fitur deteksi keaktifan (*Liveness Detection*) untuk mencegah pemalsuan foto.

Kami sangat menyambut baik kontribusi berupa perbaikan *bug*, penambahan fitur, maupun dokumentasi. Silakan buat **Pull Request** atau buka **Issue** di repositori ini jika Anda menemukan kendala!

