import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Calendar, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { attendanceApi, extractList, apiErrorMessage } from '@hdir/core/src/api-client';

export default function HistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Argumen getHistory adalah nomor HALAMAN (page), bukan userId:
  // identitas user diambil backend dari token. Halaman 1 = 20 data terbaru.
  const loadHistory = async (nextPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendanceApi.getHistory(nextPage);
      const items = extractList(res);
      setHistory(nextPage === 1 ? items : [...history, ...items]);
      setPage(nextPage);
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal memuat riwayat.'));
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.historyCard}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, item.check_type === 'in' ? styles.inBadge : styles.outBadge]}>
          <Text style={styles.badgeText}>{item.check_type === 'in' ? 'Masuk' : 'Keluar'}</Text>
        </View>
        <Text style={styles.statusText}>{item.status === 'approved' ? 'Disetujui' : 'Tertunda'}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Clock size={16} color="#64748b" style={{ marginRight: 8 }} />
          <Text style={styles.infoValue}>{new Date(item.timestamp).toLocaleString('id-ID')}</Text>
        </View>

        <View style={styles.infoRow}>
          <MapPin size={16} color="#64748b" style={{ marginRight: 8 }} />
          <Text style={styles.infoValue}>Mode: {item.mode === 'normal' ? 'Di Kantor' : 'Jarak Jauh'}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Riwayat Absensi</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Belum ada riwayat absensi.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <TouchableOpacity style={styles.loadMoreButton} onPress={() => loadHistory(page + 1)}>
              <Text style={styles.loadMoreText}>Muat halaman berikutnya</Text>
            </TouchableOpacity>
          }
        />
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
  listContent: {
    padding: 24,
    gap: 16,
  },
  loadMoreButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inBadge: {
    backgroundColor: '#dbeafe',
  },
  outBadge: {
    backgroundColor: '#fce7f3',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  cardBody: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 14,
    color: '#334155',
  },
});
