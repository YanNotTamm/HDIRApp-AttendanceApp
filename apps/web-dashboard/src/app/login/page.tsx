'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ChevronRight } from 'lucide-react';
import { authApi, loginErrorMessage } from '@hdir/core/src/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bila sudah login, jangan biarkan halaman login dipakai sebagai jalan pintas.
  useEffect(() => {
    authApi.getToken().then((token) => {
      if (token) router.replace('/dashboard');
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      await authApi.login(email.trim(), password);
      // Password tidak disimpan di mana pun; hanya token (+ profil) yang disimpan.
      router.push('/dashboard');
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/20 blur-[100px]" />

      <div className="w-full max-w-md p-8 glass-panel z-10 relative">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">HDIR Portal</h1>
          <p className="text-slate-500 mt-2">Masuk ke Panel Manajemen HR</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email HR</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input w-full pl-10 py-3"
                placeholder="admin@hdir.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input w-full pl-10 py-3"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="glass-button w-full py-3 flex items-center justify-center gap-2 group"
          >
            {loading ? 'Memverifikasi...' : 'Masuk Sekarang'}
            {!loading && <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>
      </div>
    </div>
  );
}
