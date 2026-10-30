import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MapPin, Camera as CameraIcon } from 'lucide-react-native';
import {
  attendanceApi,
  faceApi,
  extractData,
  apiErrorMessage,
  type AttendanceRecord,
} from '@hdir/core/src/api-client';

type Coords = { latitude: number; longitude: number; accuracy: number | null };

/**
 * Alur absen yang benar:
 * 1. GPS nyata dari device (expo-location). Tanpa GPS: error jelas, TIDAK
 *    ada lokasi kantor hardcode dan TIDAK ada inRadius palsu.
 * 2. Foto selfie dari kamera depan, bila kamera tersedia.
 * 3. Verifikasi wajah WAJIB dan NYATA di server: selfie dikirim ke
 *    POST /face/verify, dan absen DIBATALKAN bila server menyatakan
 *    wajah tidak cocok, belum ada wajah terdaftar, tidak ada wajah di
 *    foto, atau model server tidak tersedia (503). Tidak ada lagi jalur
 *    "absen tanpa verifikasi biometrik". Bila belum enroll, pengguna
 *    diarahkan ke tombol "Daftarkan / Perbarui Wajah" di layar ini.
 *    Server lalu MEMVERIFIKASI ULANG selfie yang sama saat check-in
 *    (gerbang otoritatif di backend); hasil verify di sini adalah
 *    umpan balik awal, bukan pengganti verifikasi server saat check-in.
 * 4. attendanceApi.checkIn / checkOut ke server. Absen HANYA dianggap
 *    berhasil bila respons server berhasil; mode (normal/remote) dan
 *    status (pending/approved) yang ditampilkan adalah dari respons
 *    server, bukan dari perhitungan lokal.
 * Catatan: backend menghitung mode/status dari kantor user dan
 * radius_meters-nya; frontend tidak lagi mengarang "di dalam radius".
 */
export default function AttendanceScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<{ record: AttendanceRecord | null; message: string; faceNote: string } | null>(null);
  const [faceNote, setFaceNote] = useState<string | null>(null);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);

  const cameraRef = useRef<CameraView>(null);

  const refreshToday = useCallback(async () => {
    try {
      const res = await attendanceApi.getToday();
      const data = extractData<{ clock_in?: string | null; clock_out?: string | null }>(res);
      setHasCheckedIn(Boolean(data?.clock_in));
      setHasCheckedOut(Boolean(data?.clock_out));
    } catch {
      /* status hari ini opsional; tombol tetap tersedia */
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLocationLoading(true);
      setLocationError(null);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Izin lokasi ditolak. Aktifkan izin lokasi aplikasi agar absen dapat membaca GPS nyata.');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? null,
        });
      } catch (err) {
        setLocationError(`Gagal membaca GPS: ${apiErrorMessage(err, 'GPS tidak tersedia di device ini.')}`);
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshToday();
    }, [refreshToday]),
  );

  if (!permission) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>Kami membutuhkan akses kamera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Izinkan Kamera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleAttendance = async (kind: 'in' | 'out') => {
    if (!coords) {
      Alert.alert('Lokasi belum tersedia', locationError ?? 'Tunggu GPS selesai membaca lokasi, atau periksa izin lokasi.');
      return;
    }
    if (!cameraRef.current) {
      Alert.alert('Kamera tidak tersedia', 'Kamera depan tidak dapat diakses di device ini.');
      return;
    }
    setBusy(true);
    setResult(null);
    setFaceNote(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      if (!photo || !photo.base64) throw new Error('Gagal mengambil foto selfie.');
      const selfieDataUri = `data:image/jpeg;base64,${photo.base64}`;

      // Verifikasi wajah WAJIB di server. Kegagalan apa pun = absen batal,
      // tanpa pengecualian dan tanpa jalur "tanpa verifikasi".
      let note: string | null = null;
      try {
        const verifyRes = await faceApi.verify(selfieDataUri);
        const data = extractData<{ match?: unknown; distance?: unknown }>(verifyRes);
        if (data?.match !== true) {
          Alert.alert('Wajah tidak terverifikasi', 'Server menyatakan wajah tidak cocok. Absen dibatalkan.');
          return;
        }
        const dist = typeof data?.distance === 'number' ? data.distance.toFixed(3) : '-';
        note = `Wajah cocok menurut server (jarak ${dist}, ambang 0.6).`;
      } catch (faceErr: unknown) {
        const serverMsg = apiErrorMessage(faceErr, '');
        if (/belum ada wajah terdaftar|enroll/i.test(serverMsg)) {
          Alert.alert(
            'Wajah belum terdaftar',
            'Akun ini belum memiliki wajah terdaftar. Gunakan tombol "Daftarkan / Perbarui Wajah" di bawah, lalu coba absen lagi. Absen dibatalkan.',
          );
          return;
        }
        Alert.alert('Verifikasi wajah gagal', `${serverMsg} Absen dibatalkan — tidak ada absen yang dicatat.`);
        return;
      }
      setFaceNote(note);

      const payload = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        selfiePhoto: selfieDataUri,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      };
      const res = kind === 'in' ? await attendanceApi.checkIn(payload) : await attendanceApi.checkOut(payload);
      const record = extractData<AttendanceRecord>(res);
      const message =
        (res.data as { message?: string })?.message ??
        (kind === 'in' ? 'Check-in berhasil.' : 'Check-out berhasil.');
      setResult({ record, message, faceNote: note ?? '' });
      await refreshToday();
    } catch (err) {
      Alert.alert(kind === 'in' ? 'Gagal Check-In' : 'Gagal Check-Out', apiErrorMessage(err, 'Absen tidak tercatat di server.'));
    } finally {
      setBusy(false);
    }
  };

  const handleEnrollFace = async () => {
    if (!cameraRef.current) {
      Alert.alert('Kamera tidak tersedia', 'Kamera depan tidak dapat diakses di device ini.');
      return;
    }
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      if (!photo || !photo.base64) throw new Error('Gagal mengambil foto selfie.');
      await faceApi.enroll(`data:image/jpeg;base64,${photo.base64}`);
      setFaceNote('Wajah berhasil didaftarkan di server. Anda kini dapat absen dengan verifikasi wajah.');
      Alert.alert('Wajah terdaftar', 'Wajah Anda berhasil didaftarkan. Silakan coba absen sekarang.');
    } catch (err) {
      Alert.alert('Gagal mendaftarkan wajah', apiErrorMessage(err, 'Pastikan wajah terlihat jelas menghadap kamera.'));
    } finally {
      setBusy(false);
    }
  };

  const record = result?.record;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing="front" ref={cameraRef}>
            <View style={styles.overlay}>
              <View style={styles.faceGuide} />
            </View>
          </CameraView>
        </View>

        <View style={styles.bottomPanel}>
          <View style={styles.locationCard}>
            <MapPin size={24} color="#3b82f6" />
            <View style={styles.locationInfo}>
              <Text style={styles.locationTitle}>Lokasi GPS Device</Text>
              {locationLoading ? (
                <Text style={styles.locationDesc}>Mencari sinyal GPS...</Text>
              ) : coords ? (
                <Text style={styles.locationDesc}>
                  {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                  {coords.accuracy !== null ? ` (±${Math.round(coords.accuracy)} m)` : ''}
                </Text>
              ) : (
                <Text style={[styles.locationDesc, { color: '#ef4444' }]}>{locationError ?? 'Lokasi tidak tersedia.'}</Text>
              )}
              <Text style={styles.locationDesc}>
                Mode & status ditentukan server dari kantor & radius Anda — bukan dari layar ini.
              </Text>
            </View>
            {locationLoading ? <ActivityIndicator color="#3b82f6" /> : null}
          </View>

          {faceNote ? <Text style={styles.note}>{faceNote}</Text> : null}

          {result ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>{result.message}</Text>
              <Text style={styles.resultLine}>Mode (dari server): {record?.mode ?? '-'}</Text>
              <Text style={styles.resultLine}>Status (dari server): {record?.status ?? '-'}</Text>
              <Text style={styles.resultLine}>
                Verifikasi wajah (dari server): {record?.face_verified ? `terverifikasi (jarak ${record?.face_match_distance ?? record?.face_match_score ?? '-'})` : 'tidak ada data'}
              </Text>
              <Text style={styles.resultLine}>
                Jarak dari kantor (dari server): {record?.distance_meters !== undefined ? `${Math.round(record.distance_meters)} meter` : '-'}
              </Text>
              {record?.timestamp ? <Text style={styles.resultLine}>Waktu (dari server): {new Date(record.timestamp).toLocaleString('id-ID')}</Text> : null}
              {result.faceNote ? <Text style={styles.resultLine}>{result.faceNote}</Text> : null}
            </View>
          ) : null}

          <Text style={styles.label}>Alasan (wajib bila Anda di luar radius kantor — server akan menolak remote tanpa alasan)</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Mis. dinas luar kota"
            placeholderTextColor="#94a3b8"
            value={reason}
            onChangeText={setReason}
            multiline
          />

          <TouchableOpacity
            style={[styles.clockButton, styles.enrollButton, (busy) && styles.clockButtonDisabled]}
            onPress={handleEnrollFace}
            disabled={busy}
          >
            <Text style={styles.clockButtonText}>Daftarkan / Perbarui Wajah</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Enroll sekali sebelum absen pertama; server mengekstrak wajah dari foto ini (bukan dari device).</Text>

          <TouchableOpacity
            style={[styles.clockButton, (!coords || locationLoading || busy || hasCheckedIn) && styles.clockButtonDisabled]}
            onPress={() => handleAttendance('in')}
            disabled={!coords || locationLoading || busy || hasCheckedIn}
          >
            <CameraIcon size={24} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.clockButtonText}>{hasCheckedIn ? 'Sudah Check-In Hari Ini' : 'Clock In Sekarang'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.clockButton, styles.outButton, (!coords || locationLoading || busy || !hasCheckedIn || hasCheckedOut) && styles.clockButtonDisabled]}
            onPress={() => handleAttendance('out')}
            disabled={!coords || locationLoading || busy || !hasCheckedIn || hasCheckedOut}
          >
            <CameraIcon size={24} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.clockButtonText}>{hasCheckedOut ? 'Sudah Check-Out Hari Ini' : 'Clock Out Sekarang'}</Text>
          </TouchableOpacity>
          {!hasCheckedIn ? (
            <Text style={styles.hint}>Tombol Check-Out aktif setelah Anda check-in hari ini.</Text>
          ) : null}
          {busy ? <ActivityIndicator color="#2563eb" style={{ marginTop: 12 }} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cameraContainer: {
    height: 420,
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 125,
    borderStyle: 'dashed',
  },
  bottomPanel: {
    backgroundColor: '#f8fafc',
    padding: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
  },
  locationDesc: {
    fontSize: 12,
    marginTop: 2,
    color: '#475569',
  },
  note: {
    fontSize: 13,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  resultCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 4,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#065f46',
  },
  resultLine: {
    fontSize: 13,
    color: '#334155',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  reasonInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    minHeight: 56,
    textAlignVertical: 'top',
    marginBottom: 16,
    color: '#0f172a',
  },
  clockButton: {
    backgroundColor: '#2563eb',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  outButton: {
    backgroundColor: '#db2777',
    shadowColor: '#db2777',
  },
  enrollButton: {
    backgroundColor: '#0f766e',
    shadowColor: '#0f766e',
  },
  clockButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  clockButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 24,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
