'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash, X, Save } from 'lucide-react';
import { usersApi, extractList, apiErrorMessage, roleName } from '@hdir/core/src/api-client';

type Employee = {
  id: number;
  name?: string;
  email?: string;
  role?: string | { name?: string };
  status?: string;
  employee_code?: string;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.getAll();
      setEmployees(extractList<Employee>(res));
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal memuat karyawan.'));
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm({ name: '', email: '', password: '' });
    setEditing(null);
    setFormError(null);
    setShowAdd(true);
  };

  const openEdit = (emp: Employee) => {
    setForm({ name: emp.name ?? '', email: emp.email ?? '', password: '' });
    setEditing(emp);
    setFormError(null);
    setShowAdd(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Nama dan email wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await usersApi.update(editing.id, { name: form.name.trim(), email: form.email.trim() });
      } else {
        await usersApi.create({ name: form.name.trim(), email: form.email.trim(), password: form.password || undefined });
      }
      setShowAdd(false);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Gagal menyimpan karyawan.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp: Employee) => {
    if (!window.confirm(`Nonaktifkan karyawan "${emp.name ?? emp.email ?? emp.id}"? (Backend menandai status inactive, bukan menghapus permanen.)`)) return;
    try {
      await usersApi.delete(emp.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menonaktifkan karyawan.'));
    }
  };

  const filtered = employees.filter((emp) =>
    `${emp.name ?? ''} ${emp.email ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Karyawan</h1>
          <p className="text-slate-500">Kelola data karyawan dan hak akses.</p>
        </div>
        <button onClick={openAdd} className="glass-button px-4 py-2 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tambah Karyawan
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {showAdd && (
        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800">{editing ? 'Ubah Karyawan' : 'Tambah Karyawan'}</h2>
            <button type="button" onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama lengkap" className="glass-input px-3 py-2 text-sm" required />
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="glass-input px-3 py-2 text-sm" required />
            {!editing && (
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password awal (opsional)" className="glass-input px-3 py-2 text-sm" />
            )}
          </div>
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <button type="submit" disabled={saving} className="glass-button px-4 py-2 flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau email..." className="glass-input w-full pl-9 py-2 text-sm" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-4">Nama</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Peran</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Belum ada karyawan.</td></tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{emp.name ?? '-'}</td>
                    <td className="px-6 py-4">{emp.email ?? '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">{roleName(emp) || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium">{emp.status ?? '-'}</span>
                    </td>
                    <td className="px-6 py-4 flex justify-end gap-2">
                      <button onClick={() => openEdit(emp)} title="Ubah" className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(emp)} title="Nonaktifkan" className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"><Trash className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
