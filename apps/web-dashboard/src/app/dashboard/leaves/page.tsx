'use client';

import { useState, useEffect } from 'react';
import { User, Calendar, Edit, Save, X } from 'lucide-react';
import { usersApi, leaveApi, extractList } from '@hdir/core/src/api-client';

export default function LeavesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [quotas, setQuotas] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const res = await usersApi.getAll();
      setEmployees(extractList(res));
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

  const handleSelectUser = async (user: any) => {
    setSelectedUser(user);
    setLoading(true);
    try {
      const res = await leaveApi.getMyQuota(user.id);
      setQuotas(extractList(res));
    } catch (err) {
      console.error('Failed to load quotas:', err);
      setQuotas([]);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (quota: any) => {
    setEditingId(quota.id);
    setEditValue(quota.quota_days);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: number) => {
    try {
      await leaveApi.updateQuota(id, editValue);
      setEditingId(null);
      if (selectedUser) {
        handleSelectUser(selectedUser);
      }
    } catch (err) {
      alert('Gagal memperbarui kuota cuti');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Manajemen Kuota Cuti</h1>
        <p className="text-slate-500">Kelola dan sesuaikan sisa kuota cuti tahunan karyawan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kiri: Daftar Karyawan */}
        <div className="glass-panel p-4 h-[600px] flex flex-col">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-slate-500" /> Daftar Karyawan
          </h3>
          <div className="overflow-y-auto flex-1 space-y-2 pr-2">
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleSelectUser(emp)}
                className={`w-full text-left p-3 rounded-xl transition-colors flex items-center justify-between ${
                  selectedUser?.id === emp.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <div className="font-semibold text-sm">{emp.name}</div>
                  <div className="text-xs text-slate-500">{emp.email}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Kanan: Kuota Karyawan yang Dipilih */}
        <div className="col-span-2 glass-panel p-6">
          {selectedUser ? (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800">{selectedUser.name}</h2>
                <p className="text-sm text-slate-500">Jabatan/Peran: {selectedUser.role?.name}</p>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-500">Memuat kuota...</div>
              ) : quotas.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  Karyawan ini belum memiliki kuota cuti yang dikonfigurasi untuk tahun ini.
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-slate-500" /> Kuota Aktif (Tahun Ini)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quotas.map((q) => (
                      <div key={q.id} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 flex flex-col justify-between h-36">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Jenis Cuti</span>
                            <h4 className="font-bold text-slate-800">{q.leave_type?.name || 'Cuti Tahunan'}</h4>
                          </div>
                          {editingId === q.id ? (
                            <div className="flex gap-1">
                              <button onClick={cancelEdit} className="p-1 hover:bg-slate-200 rounded-md text-slate-500"><X className="w-4 h-4" /></button>
                              <button onClick={() => saveEdit(q.id)} className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md"><Save className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(q)} className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500"><Edit className="w-4 h-4" /></button>
                          )}
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-100/50 pt-3 mt-3">
                          <div>
                            <div className="text-xs text-slate-400">Terpakai</div>
                            <div className="font-bold text-slate-700 text-lg">{q.used_days} Hari</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400">Total Kuota</div>
                            {editingId === q.id ? (
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                className="w-16 text-right px-2 py-0.5 border border-slate-300 rounded text-sm font-bold text-slate-800"
                              />
                            ) : (
                              <div className="font-bold text-blue-600 text-lg">{q.quota_days} Hari</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 py-12">
              Silakan pilih karyawan di sebelah kiri untuk melihat dan mengelola kuota cuti.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
