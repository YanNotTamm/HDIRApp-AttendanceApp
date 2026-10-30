'use client';

import { useState, useEffect } from 'react';
import { Plus, MapPin, Edit, Trash, X, Save } from 'lucide-react';
import { officesApi, extractList, apiErrorMessage } from '@hdir/core/src/api-client';

type Office = {
  id: number;
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
};

export default function OfficesPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Office | null>(null);
  const [form, setForm] = useState({ name: '', address: '', latitude: '', longitude: '', radius_meters: '100' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await officesApi.getAll();
      setOffices(extractList<Office>(res));
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal memuat lokasi kantor.'));
      setOffices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm({ name: '', address: '', latitude: '', longitude: '', radius_meters: '100' });
    setEditing(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (office: Office) => {
    setForm({
      name: office.name ?? '',
      address: office.address ?? '',
      latitude: office.latitude !== undefined ? String(office.latitude) : '',
      longitude: office.longitude !== undefined ? String(office.longitude) : '',
      radius_meters: office.radius_meters !== undefined ? String(office.radius_meters) : '100',
    });
    setEditing(office);
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const latitude = parseFloat(form.latitude);
    const longitude = parseFloat(form.longitude);
    const radius_meters = parseInt(form.radius_meters, 10);
    if (!form.name.trim() || Number.isNaN(latitude) || Number.isNaN(longitude) || Number.isNaN(radius_meters)) {
      setFormError('Nama, latitude, longitude, dan radius (meter) wajib diisi dengan angka yang valid.');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), address: form.address.trim(), latitude, longitude, radius_meters };
      if (editing) await officesApi.update(editing.id, payload);
      else await officesApi.create(payload);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Gagal menyimpan lokasi kantor.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (office: Office) => {
    if (!window.confirm(`Hapus lokasi "${office.name ?? office.id}"? Tindakan ini permanen di backend.`)) return;
    try {
      await officesApi.delete(office.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menghapus lokasi kantor.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lokasi Kantor (Geofence)</h1>
          <p className="text-slate-500">Atur titik koordinat dan radius presensi (Geofencing).</p>
        </div>
        <button onClick={openAdd} className="glass-button px-4 py-2 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tambah Lokasi
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800">{editing ? 'Ubah Lokasi' : 'Tambah Lokasi'}</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama kantor" className="glass-input px-3 py-2 text-sm" required />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Alamat" className="glass-input px-3 py-2 text-sm" />
            <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="Latitude, mis. -6.2088" className="glass-input px-3 py-2 text-sm" required />
            <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="Longitude, mis. 106.8456" className="glass-input px-3 py-2 text-sm" required />
            <input type="number" value={form.radius_meters} onChange={(e) => setForm({ ...form, radius_meters: e.target.value })} placeholder="Radius (meter)" className="glass-input px-3 py-2 text-sm" required />
          </div>
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <button type="submit" disabled={saving} className="glass-button px-4 py-2 flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Memuat data...</div>
      ) : offices.length === 0 ? (
        <div className="py-12 text-center text-slate-400 glass-panel">Belum ada lokasi kantor.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {offices.map((office) => (
            <div key={office.id} className="glass-panel p-6 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{office.name ?? '-'}</h3>
                    <p className="text-sm text-emerald-600 font-medium">
                      Radius: {office.radius_meters !== undefined ? `${office.radius_meters} meter` : '-'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(office)} title="Ubah" className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(office)} title="Hapus" className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"><Trash className="w-4 h-4" /></button>
                </div>
              </div>
              {office.address && <p className="text-sm text-slate-500 mb-2">{office.address}</p>}
              <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between text-sm text-slate-500">
                <span>Lat: {office.latitude ?? '-'}</span>
                <span>Lng: {office.longitude ?? '-'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
