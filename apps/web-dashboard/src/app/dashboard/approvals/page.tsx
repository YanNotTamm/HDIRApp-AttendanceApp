'use client';

import { useState, useEffect } from 'react';
import { Check, X, MapPin, Calendar, User, Clock } from 'lucide-react';
import { attendanceApi, leaveApi, extractList } from '@hdir/core/src/api-client';

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'leave'>('attendance');
  const [pendingAttendance, setPendingAttendance] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [attRes, leaveRes] = await Promise.all([
        attendanceApi.getPending(),
        leaveApi.getPending(),
      ]);
      setPendingAttendance(extractList(attRes));
      setPendingLeaves(extractList(leaveRes));
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAttendance = async (id: number) => {
    try {
      await attendanceApi.approve(id);
      loadData();
    } catch (err) {
      alert('Gagal menyetujui absensi');
    }
  };

  const handleRejectAttendance = async (id: number) => {
    try {
      await attendanceApi.reject(id);
      loadData();
    } catch (err) {
      alert('Gagal menolak absensi');
    }
  };

  const handleApproveLeave = async (id: number) => {
    try {
      await leaveApi.approve(id);
      loadData();
    } catch (err) {
      alert('Gagal menyetujui cuti');
    }
  };

  const handleRejectLeave = async (id: number) => {
    try {
      await leaveApi.reject(id);
      loadData();
    } catch (err) {
      alert('Gagal menolak cuti');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Approval Center</h1>
        <p className="text-slate-500">Persetujuan absensi jarak jauh dan cuti karyawan.</p>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'attendance' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Absen Jarak Jauh ({pendingAttendance.length})
        </button>
        <button
          onClick={() => setActiveTab('leave')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'leave' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Pengajuan Cuti ({pendingLeaves.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Memuat data...</div>
      ) : activeTab === 'attendance' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pendingAttendance.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-slate-400 glass-panel">
              Tidak ada pengajuan absen jarak jauh yang tertunda.
            </div>
          ) : (
            pendingAttendance.map((item) => (
              <div key={item.id} className="glass-panel p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                      {item.user?.name[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">{item.user?.name}</h4>
                      <p className="text-xs text-slate-500">Kode Karyawan: {item.user?.employee_code}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>{new Date(item.timestamp).toLocaleString('id-ID')} ({item.check_type === 'in' ? 'Masuk' : 'Keluar'})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>Jarak: {Math.round(item.distance_meters || 0)} meter di luar radius kantor</span>
                    </div>
                    <div className="p-3 bg-red-50/50 rounded-lg text-red-700 text-xs">
                      <strong>Alasan:</strong> {item.reason}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6 border-t border-slate-100 pt-4">
                  <button
                    onClick={() => handleRejectAttendance(item.id)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Tolak
                  </button>
                  <button
                    onClick={() => handleApproveAttendance(item.id)}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Setujui
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pendingLeaves.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-slate-400 glass-panel">
              Tidak ada pengajuan cuti yang tertunda.
            </div>
          ) : (
            pendingLeaves.map((item) => (
              <div key={item.id} className="glass-panel p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                      {item.user?.name[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">{item.user?.name}</h4>
                      <p className="text-xs text-slate-500">Cuti: {item.leave_type?.name || 'Tahunan'}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>Durasi: {item.total_days} Hari Kerja</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg text-slate-700 text-xs">
                      <strong>Alasan:</strong> {item.reason}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6 border-t border-slate-100 pt-4">
                  <button
                    onClick={() => handleRejectLeave(item.id)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Tolak
                  </button>
                  <button
                    onClick={() => handleApproveLeave(item.id)}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Setujui
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
