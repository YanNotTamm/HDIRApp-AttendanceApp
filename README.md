# HDIR App — Attendance App

Aplikasi absensi karyawan multi-platform dengan **Face Recognition** dan **GPS Geofencing**, dilengkapi mode absen jarak jauh (dengan approval HR), pengajuan cuti, dan dashboard HR berbasis web. Android (native), iOS (PWA), dan Web Dashboard terhubung ke satu backend & database yang sama sehingga data selalu sinkron secara real-time.

Repo: [github.com/YanNotTamm/HDIR-App---Attendance-App](https://github.com/YanNotTamm/HDIR-App---Attendance-App)

## Fitur Utama

- **Face Recognition** — verifikasi wajah saat absen (enrollment multi-pose, matching berbasis face embedding).
- **GPS Geofencing** — absen otomatis terdeteksi *Normal* (dalam radius kantor) atau *Jarak Jauh* (di luar radius).
- **Approval Absen Jarak Jauh** — HR bisa approve/reject langsung dari aplikasi native/PWA maupun web dashboard.
- **Pengajuan Cuti** — karyawan mengajukan cuti, tervalidasi otomatis terhadap sisa kuota.
- **Kuota Cuti Tahunan** — dikonfigurasi HR dari dashboard, termasuk override per karyawan.
- **Dashboard HR (Web)** — manajemen karyawan, kantor/cabang, radius geofence, approval center, laporan.
- **Multi-role** — Admin, HR, Karyawan (RBAC di seluruh platform).

## Arsitektur & Tech Stack

| Layer | Teknologi |
|---|---|
| Android Native | React Native |
| iOS | PWA (React, installable via Add to Home Screen) |
| Web Dashboard HR | Next.js + TailwindCSS |
| Backend API | Node.js (NestJS) |
| Database | MySQL |
| Auth | JWT (access + refresh token), RBAC |
| Face Recognition | face-api.js (TensorFlow.js) |
| Realtime/Notifikasi | Socket.io / FCM / Web Push |

Backend menjadi satu-satunya sumber kebenaran (single source of truth): perubahan konfigurasi di Web Dashboard (radius kantor, kuota cuti, data karyawan) langsung berlaku di aplikasi native dan PWA tanpa perlu rilis ulang.

## Struktur Repo

```
attendance-app/
├── apps/
│   ├── mobile-android/    # React Native app
│   ├── pwa/               # React PWA untuk iOS
│   ├── web-dashboard/     # Next.js HR dashboard
│   └── api/               # Backend NestJS + MySQL
├── packages/
│   ├── core/              # business logic & API client bersama
│   ├── ui/                # komponen UI bersama
│   └── config/            # eslint/tsconfig bersama
├── PLAN.md                # rencana proyek & arsitektur lengkap
├── SKILL.md               # konvensi & aturan teknis proyek
├── instructions.md        # panduan eksekusi bertahap
└── README.md
```

## Dokumentasi Proyek

- [`PLAN.md`](./PLAN.md) — ringkasan proyek, arsitektur sistem, skema database, alur kerja, dan roadmap.
- [`SKILL.md`](./SKILL.md) — stack teknologi wajib, konvensi kode, dan aturan bisnis yang tidak boleh dilanggar.
- [`instructions.md`](./instructions.md) — panduan eksekusi pengembangan per fase, dari setup hingga deployment.

## Memulai (Getting Started)

> Prasyarat: Node.js LTS, MySQL 8+, npm/pnpm, Android Studio (untuk build Android), akun Apple/Safari untuk uji PWA di iOS.

```bash
# clone repo
git clone https://github.com/YanNotTamm/HDIR-App---Attendance-App.git
cd HDIR-App---Attendance-App

# install dependencies (monorepo)
pnpm install

# copy environment variable
cp apps/api/.env.example apps/api/.env

# jalankan migrasi database
pnpm --filter api run migrate

# jalankan backend
pnpm --filter api run dev

# jalankan web dashboard
pnpm --filter web-dashboard run dev

# jalankan PWA
pnpm --filter pwa run dev

# jalankan aplikasi Android
pnpm --filter mobile-android run android
```

> Sesuaikan perintah di atas dengan package manager dan tooling aktual yang dipakai di masing-masing `apps/*` begitu implementasinya berjalan.

## Environment Variables

Contoh variabel yang dibutuhkan backend (`apps/api/.env`):

```
DATABASE_URL=mysql://user:password@localhost:3306/hdir_attendance
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
FACE_MATCH_THRESHOLD=0.6
DEFAULT_GEOFENCE_RADIUS_METERS=100
FCM_SERVER_KEY=
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
FILE_STORAGE_DRIVER=local
```

## Role & Akses

| Role | Akses |
|---|---|
| **Admin** | Kelola seluruh sistem, konfigurasi role, audit log |
| **HR** | Kelola karyawan, kantor/geofence, kuota cuti, approval absen jarak jauh & cuti, laporan |
| **Karyawan** | Absen (face + GPS), ajukan cuti, lihat riwayat & sisa kuota |

## Roadmap Singkat

- [ ] Fase 1 — Auth & fondasi backend
- [ ] Fase 2 — Manajemen karyawan & kantor
- [ ] Fase 3 — Face recognition (enrollment & verifikasi)
- [ ] Fase 4 — Geofencing & absen normal/jarak jauh
- [ ] Fase 5 — Approval absen jarak jauh
- [ ] Fase 6 — Modul cuti & kuota tahunan
- [ ] Fase 7 — Packaging Android & PWA iOS
- [ ] Fase 8 — Laporan, hardening, deployment

Detail lengkap tiap fase ada di [`instructions.md`](./instructions.md).

## Kontribusi

Proyek ini masih dalam tahap pengembangan awal. Ikuti konvensi di [`SKILL.md`](./SKILL.md) sebelum membuka Pull Request:

1. Fork repo & buat branch baru (`feature/nama-fitur`).
2. Pastikan TypeScript dipakai konsisten dan validasi input ada di setiap endpoint baru.
3. Sertakan deskripsi perubahan dan referensi fase/fitur terkait dari `instructions.md`.
4. Ajukan Pull Request ke branch `main`.

## Lisensi

Belum ditentukan — tambahkan berkas `LICENSE` sesuai kebutuhan organisasi sebelum rilis publik.
