# HDIR App — Attendance App

Aplikasi absensi karyawan multi-platform modern dengan **Face Recognition** dan **GPS Geofencing**. Dilengkapi dengan mode absen jarak jauh (membutuhkan persetujuan HR), pengajuan cuti, serta dashboard manajemen HR berbasis web.

Proyek ini dibangun menggunakan arsitektur **Monorepo (Turborepo)** dengan komponen berikut:
- **Web Dashboard**: Next.js (Admin/HR Panel)
- **Mobile Android**: React Native / Expo (Aplikasi Karyawan)
- **Backend API**: NestJS + Prisma ORM (MySQL)
- **PWA**: Aplikasi ringan berbasis web untuk platform iOS (Segera Hadir)

## 🌟 Fitur Utama

1. **Face Recognition**: Verifikasi wajah langsung saat absen.
2. **GPS Geofencing**: Deteksi otomatis apakah karyawan berada di dalam radius kantor (*Normal*) atau di luar radius (*Jarak Jauh*).
3. **Absen Jarak Jauh**: Memerlukan alasan dan persetujuan HR.
4. **Manajemen Cuti**: Pengajuan cuti terintegrasi dengan saldo kuota tahunan.
5. **Dashboard HR**: Pemantauan kehadiran *real-time*, persetujuan absen, dan manajemen data karyawan/kantor.

## 🚀 Memulai Proyek (Getting Started)

### Prasyarat
- **Node.js** (v18 atau lebih baru)
- **MySQL Server** (XAMPP, Docker, dll)
- **Git**

### Instalasi

1. Kloning repositori ini:
   ```bash
   git clone https://github.com/YanNotTamm/HDIRApp-AttendanceApp.git
   cd HDIRApp-AttendanceApp
   ```

2. Instal seluruh dependensi proyek:
   ```bash
   npm install
   ```

3. Jalankan aplikasi (Web Dashboard):
   ```bash
   cd apps/web-dashboard
   npm run dev
   ```
   Aplikasi web akan berjalan di `http://localhost:3000`.

## 📜 Lisensi
Proyek ini dilisensikan di bawah **GNU General Public License v3.0**. Lihat file `LICENSE` untuk informasi lebih detail.
