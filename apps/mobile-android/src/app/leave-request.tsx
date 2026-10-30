import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar as CalendarIcon, ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { leaveApi, extractList, apiErrorMessage } from '@hdir/core/src/api-client';

export default function LeaveRequestScreen() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<any[]>([]);
  const [quotaLoading, setQuotaLoading] = useState(true);

  useEffect(() => {
    loadQuota();
  }, []);

  const loadQuota = async () => {
    try {
      // Tanpa userId: kuota diri sendiri, identitas dari token.
      const res = await leaveApi.getMyQuota();
      setQuota(extractList(res));
    } catch (err) {
      console.error(err);
    } finally {
      setQuotaLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate || !reason) {
      Alert.alert('Gagal', 'Semua field wajib diisi');
      return;
    }

    setLoading(true);
    try {
      // Tanpa userId: identitas dari token.
      await leaveApi.request({
        start_date: startDate,
        end_date: endDate,
        reason,
        leave_type_id: 1, // Annual leave default
      });

      Alert.alert('Sukses', 'Pengajuan cuti berhasil diajukan!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      const msg = apiErrorMessage(err, 'Gagal mengajukan cuti');
      Alert.alert('Gagal', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengajuan Cuti</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Sisa Kuota Cuti Card */}
        <View style={styles.quotaCard}>
          <Text style={styles.quotaTitle}>Sisa Kuota Cuti Anda</Text>
          {quotaLoading ? (
            <ActivityIndicator color="#2563eb" />
          ) : quota.length === 0 ? (
            <Text style={styles.quotaValue}>Kuota belum tersedia</Text>
          ) : (
            quota.map((q) => (
              <View key={q.id} style={styles.quotaItem}>
                <Text style={styles.quotaLabel}>{q.leave_type?.name || 'Tahunan'}</Text>
                <Text style={styles.quotaValue}>{q.quota_days - q.used_days} Hari Tersisa</Text>
              </View>
            ))
          )}
        </View>

        {/* Form Pengajuan */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tanggal Mulai (YYYY-MM-DD)</Text>
            <View style={styles.inputContainer}>
              <CalendarIcon size={20} color="#94a3b8" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                placeholder="Contoh: 2026-07-10"
                placeholderTextColor="#94a3b8"
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tanggal Selesai (YYYY-MM-DD)</Text>
            <View style={styles.inputContainer}>
              <CalendarIcon size={20} color="#94a3b8" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                placeholder="Contoh: 2026-07-12"
                placeholderTextColor="#94a3b8"
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Alasan Cuti</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Jelaskan alasan cuti Anda..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              value={reason}
              onChangeText={setReason}
            />
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Ajukan Sekarang</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  scrollContent: {
    padding: 24,
  },
  quotaCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  quotaTitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 12,
  },
  quotaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  quotaLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
  },
  quotaValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
  },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    height: 120,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
