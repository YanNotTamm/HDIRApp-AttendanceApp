import axios, { AxiosError } from 'axios';

/**
 * Kontrak API (dikoordinasikan dengan pekerja backend, commit audit 4b68103):
 * - POST /api/v1/auth/login mengembalikan access token (+ refresh token)
 *   dalam { success, data: { access_token, refresh_token, user } }
 *   (bentuk lama { token } tetap diterima sebagai fallback).
 * - Semua endpoint lain memakai header `Authorization: Bearer <token>`.
 * - Identitas user diambil backend dari token, BUKAN dari body/query userId
 *   yang dikirim frontend. Karena itu fungsi-fungsi di bawah ini TIDAK
 *   mengirim userId/approvedBy default (mis. 1) lagi.
 * - POST /api/v1/auth/refresh { refresh_token } (diterapkan pekerja
 *   backend di working copy ini) mengembalikan access+refresh token baru
 *   (rotasi). Pada 401, core mencoba refresh sekali lalu mengulang
 *   request asal; bila refresh gagal, token dihapus dan handler
 *   onUnauthorized dipanggil agar UI mengarahkan user ke layar login.
 * - Face verify/enroll di /api/v1/face kini NYATA: keduanya menerima
 *   foto selfie, deskriptor diekstrak di server, dan kecocokan dihitung
 *   dengan jarak euclidean (threshold 0.6). Pemanggil WAJIB membatalkan
 *   absen bila verify gagal / tidak cocok / belum enroll / model 503.
 */

const env = (
  (typeof process !== 'undefined' ? process.env : {}) ?? {}
) as Record<string, string | undefined>;
export const API_URL =
  env.EXPO_PUBLIC_API_URL || env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Token storage (dapat disuntikkan per platform)
// ---------------------------------------------------------------------------

export interface TokenStore {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
}

const TOKEN_KEY = 'hdir_token';
const USER_KEY = 'hdir_user';
const REFRESH_KEY = 'hdir_refresh_token';

const memoryStore = (() => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  } satisfies TokenStore;
})();

const webStore: TokenStore =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
    ? {
        getItem: (key: string) => window.localStorage.getItem(key),
        setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
        removeItem: (key: string) => window.localStorage.removeItem(key),
      }
    : memoryStore;

let tokenStore: TokenStore = webStore;
/** Cache di memori agar interceptor tidak selalu membaca storage async. */
let cachedToken: string | null | undefined;

export function configureTokenStore(store: TokenStore) {
  tokenStore = store;
  cachedToken = undefined;
}

export function getTokenStore(): TokenStore {
  return tokenStore;
}

export async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = await tokenStore.getItem(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function setToken(token: string | null) {
  cachedToken = token;
  try {
    if (token) await tokenStore.setItem(TOKEN_KEY, token);
    else await tokenStore.removeItem(TOKEN_KEY);
  } catch {
    /* storage gagal: token tetap ada di cache sesi ini saja */
  }
}

export interface SessionUser {
  id?: number;
  name?: string;
  email?: string;
  role?: string | { name?: string };
  employee_code?: string;
  [key: string]: unknown;
}

export function roleName(user: SessionUser | null | undefined): string {
  if (!user) return '';
  return typeof user.role === 'string' ? user.role : user.role?.name ?? '';
}

/** Peran dashboard web: HR/admin (atau turunan namanya, mis. "HR Manager"). */
export function isHrOrAdmin(user: SessionUser | null | undefined): boolean {
  const role = roleName(user).toLowerCase();
  if (!role) return false;
  return role.includes('hr') || role.includes('admin') || role.includes('super');
}

export async function getStoredUser(): Promise<SessionUser | null> {
  try {
    const raw = await tokenStore.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

async function setStoredUser(user: SessionUser | null) {
  try {
    if (user) await tokenStore.setItem(USER_KEY, JSON.stringify(user));
    else await tokenStore.removeItem(USER_KEY);
  } catch {
    /* abaikan: profil bisa dimuat ulang dari /auth/me */
  }
}

export async function clearSession() {
  cachedToken = null;
  try {
    await tokenStore.removeItem(TOKEN_KEY);
    await tokenStore.removeItem(USER_KEY);
    await tokenStore.removeItem(REFRESH_KEY);
  } catch {
    /* abaikan */
  }
}

// ---------------------------------------------------------------------------
// Interceptor: Authorization otomatis + penanganan 401
// ---------------------------------------------------------------------------

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = await tokenStore.getItem(REFRESH_KEY);
        if (!refreshToken) return null;
        // Pakai axios mentah (bukan apiClient) agar percobaan refresh tidak
        // memicu interceptor ini lagi.
        const res = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken }, { timeout: 10000 });
        const data = extractData<Record<string, unknown>>({ data: res.data }) ?? {};
        const token = (data.access_token ?? data.token) as string | undefined;
        if (!token) return null;
        await setToken(token);
        const nextRefresh = (data.refresh_token ?? data.refreshToken) as string | undefined;
        if (nextRefresh) {
          try {
            await tokenStore.setItem(REFRESH_KEY, nextRefresh);
          } catch {
            /* refresh opsional */
          }
        }
        const user = (data.user ?? null) as SessionUser | null;
        if (user) await setStoredUser(user);
        return token;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const config = error.config as (typeof error.config & { _retriedAfterRefresh?: boolean }) | undefined;
      const url = config?.url ?? '';
      // Jangan menghapus sesi saat login/refresh itu sendiri gagal
      // (401 di sana = kredensial / refresh token tidak valid).
      if (!url.includes('/auth/login') && !url.includes('/auth/refresh') && config && !config._retriedAfterRefresh) {
        const newToken = await tryRefresh();
        if (newToken) {
          config._retriedAfterRefresh = true;
          config.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(config);
        }
        await clearSession();
        unauthorizedHandler?.();
      }
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Helper bentuk respons & pesan error
// ---------------------------------------------------------------------------

/** Ambil payload `data` dari { success, data } maupun respons polos. */
export function extractData<T = unknown>(res: { data?: unknown }): T | null {
  const body = res?.data as { data?: unknown } | undefined;
  if (body && typeof body === 'object' && 'data' in body) return body.data as T;
  return (body ?? null) as T | null;
}

/** Ambil list dari { success, data: [...] } dengan fallback aman (tidak crash). */
export function extractList<T = unknown>(res: { data?: unknown }): T[] {
  const data = extractData<unknown>(res);
  return Array.isArray(data) ? (data as T[]) : [];
}

export function apiErrorMessage(err: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  if (axios.isAxiosError(err)) {
    const serverMsg = (err.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof serverMsg === 'string' && serverMsg) return serverMsg;
    if (err.response) return `Server menjawab ${err.response.status}. ${fallback}`;
    if (err.code === 'ECONNABORTED') return 'Server terlalu lama merespons. Periksa koneksi lalu coba lagi.';
    return 'Server tidak dapat dijangkau. Periksa koneksi / alamat API lalu coba lagi.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Pesan login yang jelas: kredensial salah vs server tidak terjangkau. */
export function loginErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 401) return 'Email atau password salah. Periksa kembali lalu coba lagi.';
    if (err.response?.status === 400) {
      return apiErrorMessage(err, 'Data login tidak valid.');
    }
    if (!err.response) return 'Server tidak dapat dijangkau. Pastikan backend berjalan dan alamat API benar, lalu coba lagi.';
    return apiErrorMessage(err, 'Login gagal.');
  }
  return apiErrorMessage(err, 'Login gagal.');
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export interface LoginResult {
  token: string;
  refreshToken?: string;
  user: SessionUser | null;
}

export const authApi = {
  /** Login nyata. Menyimpan token (+ user dari respons) ke token store. Password TIDAK disimpan. */
  login: async (email: string, password: string): Promise<LoginResult> => {
    const res = await apiClient.post('/auth/login', { email, password });
    const data = extractData<Record<string, unknown>>(res) ?? {};
    const token = (data.token ?? data.access_token ?? data.accessToken) as string | undefined;
    if (!token) {
      throw new Error('Server tidak mengembalikan token. Login tidak dapat dilanjutkan.');
    }
    const refreshToken = (data.refresh_token ?? data.refreshToken) as string | undefined;
    const user = (data.user ?? null) as SessionUser | null;
    await setToken(token);
    if (refreshToken) {
      try {
        await tokenStore.setItem(REFRESH_KEY, refreshToken);
      } catch {
        /* refresh opsional */
      }
    }
    await setStoredUser(user);
    return { token, refreshToken, user };
  },

  /** Refresh token (rotasi): tukar refresh token dengan access token baru. */
  refresh: async (): Promise<LoginResult | null> => {
    const token = await tryRefresh();
    if (!token) return null;
    return { token, user: await getStoredUser() };
  },

  /** Logout: kirim refresh token agar backend mencabutnya (abaikan bila
   *  gagal), lalu hapus token & profil dari storage. */
  logout: async (): Promise<void> => {
    try {
      let refreshToken: string | null = null;
      try {
        refreshToken = await tokenStore.getItem(REFRESH_KEY);
      } catch {
        /* abaikan */
      }
      await apiClient.post('/auth/logout', refreshToken ? { refresh_token: refreshToken } : {});
    } catch {
      /* logout lokal tetap dilakukan walau server tidak merespons */
    }
    await clearSession();
  },

  /** Profil nyata dari server (/auth/me dari token). */
  getMe: async (): Promise<SessionUser | null> => {
    const res = await apiClient.get('/auth/me');
    return extractData<SessionUser>(res);
  },

  getStoredUser,
  getToken,
  clearSession,
};

// Users API
export const usersApi = {
  getAll: () => apiClient.get('/users'),
  getById: (id: number) => apiClient.get(`/users/${id}`),
  create: (data: unknown) => apiClient.post('/users', data),
  update: (id: number, data: unknown) => apiClient.put(`/users/${id}`, data),
  delete: (id: number) => apiClient.delete(`/users/${id}`),
};

// Offices API
export const officesApi = {
  getAll: () => apiClient.get('/offices'),
  getById: (id: number) => apiClient.get(`/offices/${id}`),
  create: (data: unknown) => apiClient.post('/offices', data),
  update: (id: number, data: unknown) => apiClient.put(`/offices/${id}`, data),
  delete: (id: number) => apiClient.delete(`/offices/${id}`),
};

// Face AI API — REAL since this round: enroll/verify take a PHOTO
// (data-URI or raw base64 JPEG/PNG); the descriptor is extracted on the
// server and never accepted from the client. A mismatch / missing
// enrollment / model outage is an error response, never a success, and
// the caller must cancel attendance on any of them.
export const faceApi = {
  enroll: (selfiePhoto: string) => apiClient.post('/face/enroll', { selfiePhoto }),
  verify: (selfiePhoto: string) => apiClient.post('/face/verify', { selfiePhoto }),
  status: () => apiClient.get('/face/status'),
};

// Notifications (in-app inbox; no push delivery) and reports.
export const notificationsApi = {
  list: () => apiClient.get('/notifications'),
  markRead: (id: number) => apiClient.post(`/notifications/${id}/read`, {}),
  markAllRead: () => apiClient.post('/notifications/read-all', {}),
};

export const reportsApi = {
  attendance: (params: { from?: string; to?: string; userId?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.userId !== undefined) q.set('userId', String(params.userId));
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return apiClient.get(`/reports/attendance${suffix}`);
  },
};

// Leave API — getMyQuota tanpa argumen = kuota diri sendiri (dari token).
// Argumen userId hanya untuk HR/admin yang melihat kuota karyawan lain.
export const leaveApi = {
  listTypes: () => apiClient.get('/leave/types'),
  request: (data: unknown) => apiClient.post('/leave', data),
  getMyLeaves: (page = 1) => apiClient.get(`/leave?page=${page}`),
  getMyQuota: (userId?: number) => apiClient.get(`/leave/quota${userId ? `?userId=${userId}` : ''}`),
  getPending: () => apiClient.get('/leave/pending'),
  approve: (id: number) => apiClient.post(`/leave/${id}/approve`, {}),
  reject: (id: number) => apiClient.post(`/leave/${id}/reject`, {}),
  updateQuota: (id: number, quotaDays: number) => apiClient.put(`/leave/quota/${id}`, { quota_days: quotaDays }),
};

// Attendance API — checkIn/checkOut TANPA userId di body (dari token).
export interface CheckInPayload {
  latitude: number;
  longitude: number;
  selfiePhoto?: string;
  reason?: string;
}

export interface AttendanceRecord {
  id?: number;
  check_type?: string;
  timestamp?: string;
  latitude?: number;
  longitude?: number;
  distance_meters?: number;
  mode?: string;
  status?: string;
  reason?: string;
  face_verified?: boolean;
  face_match_score?: number | null;
  face_match_distance?: number | null;
}

export const attendanceApi = {
  checkIn: (data: CheckInPayload) => apiClient.post('/attendance/check-in', data),
  checkOut: (data: CheckInPayload) => apiClient.post('/attendance/check-out', data),
  getToday: () => apiClient.get('/attendance/today'),
  getTodaySummary: () => apiClient.get('/attendance/today-summary'),
  getHistory: (page = 1) => apiClient.get(`/attendance/history?page=${page}`),
  getPending: () => apiClient.get('/attendance/pending'),
  approve: (id: number) => apiClient.post(`/attendance/${id}/approve`, {}),
  reject: (id: number) => apiClient.post(`/attendance/${id}/reject`, {}),
};
