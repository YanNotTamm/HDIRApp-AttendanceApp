'use client';

import { useEffect, useState } from 'react';
import { Users, Building, Activity } from 'lucide-react';
import { usersApi, officesApi, attendanceApi, extractList, extractData, apiErrorMessage } from '@hdir/core/src/api-client';

export default function DashboardHome() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);
  const [officeCount, setOfficeCount] = useState<number | null>(null);
  const [presentCount, setPresentCount] = useState<number | null>(null);
  const [presentDetail, setPresentDetail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [usersRes, officesRes, summaryRes] = await Promise.all([
          usersApi.getAll(),
          officesApi.getAll(),
          attendanceApi.getTodaySummary().catch(() => null),
        ]);
        setEmployeeCount(extractList(usersRes).length);
        setOfficeCount(extractList(officesRes).length);
        const summary = summaryRes ? extractData<{ present_count?: number; total_employees?: number; by_status?: Record<string, number> }>(summaryRes) : null;
        if (summary) {
          setPresentCount(summary.present_count ?? null);
          const byStatus = summary.by_status ?? {};
          setPresentDetail(`Dari ${summary.total_employees ?? '-'} karyawan aktif · disetujui ${byStatus.approved ?? 0} · menunggu ${byStatus.pending ?? 0}`);
        }
      } catch (err) {
        setError(apiErrorMessage(err, 'Gagal memuat data dashboard.'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = (n: number | null) => (loading ? '…' : n === null ? '-' : String(n));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ringkasan Hari Ini</h1>
        <p className="text-slate-500">Pantau aktivitas karyawan Anda secara real-time.</p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-500">Total Karyawan</h3>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-5 h-5" /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800 mt-4">{value(employeeCount)}</p>
          <p className="text-xs text-slate-400 mt-1">Dari GET /users</p>
        </div>
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-500">Kantor Cabang</h3>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Building className="w-5 h-5" /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800 mt-4">{value(officeCount)}</p>
          <p className="text-xs text-slate-400 mt-1">Dari GET /offices</p>
        </div>
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-500">Hadir Hari Ini</h3>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Activity className="w-5 h-5" /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800 mt-4">{value(presentCount)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {presentDetail ?? 'Dari GET /attendance/today-summary (HR/admin)'}
          </p>
        </div>
      </div>
    </div>
  );
}
