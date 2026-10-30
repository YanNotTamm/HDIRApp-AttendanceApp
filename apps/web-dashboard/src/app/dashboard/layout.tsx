'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, MapPin, LayoutDashboard, LogOut, CheckSquare, Calendar } from 'lucide-react';
import { authApi, isHrOrAdmin, roleName, type SessionUser } from '@hdir/core/src/api-client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    (async () => {
      const token = await authApi.getToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const stored = await authApi.getStoredUser();
      setUser(stored);
      // Peran diketahui dari profil login: hanya HR/admin yang boleh membuka dashboard.
      // Bila peran tidak tercatat di sesi (mis. token lama), jangan mengunci user:
      // backend tetap yang berwenang menolak endpoint HR (401/403).
      if (stored && roleName(stored) && !isHrOrAdmin(stored)) {
        setBlocked(true);
      }
      setChecking(false);
    })();
  }, [router]);

  const handleLogout = async () => {
    await authApi.logout();
    router.replace('/login');
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Memeriksa sesi...</div>;
  }

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
        <div className="glass-panel p-8 max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-800">Akses ditolak</h1>
          <p className="text-sm text-slate-500">
            Akun ini ({user?.email ?? 'tanpa email'}) memiliki peran &ldquo;{roleName(user) || '-'}&rdquo;,
            bukan HR/admin, sehingga tidak dapat membuka panel dashboard.
          </p>
          <button onClick={handleLogout} className="glass-button px-4 py-2">
            Keluar dan masuk dengan akun HR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-blue-600">HDIR Admin</h1>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors">
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Beranda</span>
          </Link>
          <Link href="/dashboard/employees" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors">
            <Users className="w-5 h-5" />
            <span className="font-medium">Karyawan</span>
          </Link>
          <Link href="/dashboard/offices" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors">
            <MapPin className="w-5 h-5" />
            <span className="font-medium">Lokasi Kantor</span>
          </Link>
          <Link href="/dashboard/approvals" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors">
            <CheckSquare className="w-5 h-5" />
            <span className="font-medium">Persetujuan</span>
          </Link>
          <Link href="/dashboard/leaves" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors">
            <Calendar className="w-5 h-5" />
            <span className="font-medium">Kuota Cuti</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Panel HR</h2>
          <div className="flex items-center gap-3">
            {user?.name && <span className="text-sm text-slate-500 hidden sm:block">{user.name}</span>}
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              {(user?.name?.[0] ?? 'H').toUpperCase()}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
