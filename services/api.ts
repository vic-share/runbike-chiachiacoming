
import { DataRecord, LookupItem, TeamInfo, ClassSession, Enrollment, TicketWallet, CourseTemplate, LegendRecord, RaceEvent, PushTemplates, TicketPricing, FinancialRecord, FinancialReport } from '../types';
import { offlineService } from './offline';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const getWorkerUrl = () => {
    // Use user's worker URL
    return 'https://runbike-chiachiacoming.sky070680.workers.dev/api';
};

const WORKER_URL = getWorkerUrl();
const TEAM_ID = '1';

const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('CHIACHIA_TOKEN');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
};

// Helper to map DB columns to Frontend types
const mapPerson = (p: any): LookupItem => {
    if (!p) return p;
    
    let roles = [];
    try {
        if (Array.isArray(p.roles)) {
            roles = p.roles;
        } else if (typeof p.roles === 'string' && p.roles.trim() !== '') {
            roles = JSON.parse(p.roles);
        } else {
            roles = (p.role === 'admin' ? ['COACH', 'RIDER'] : ['RIDER']);
        }
    } catch (e) {
        roles = (p.role === 'admin' ? ['COACH', 'RIDER'] : ['RIDER']);
    }

    return {
        ...p,
        s_url: p.s_url || p.avatar_url,
        b_url: p.b_url || p.full_photo_url,
        myword: p.myword || p.bio || '',
        roles: roles
    };
};

const mapTrainingType = (t: any): LookupItem => ({
    ...t,
    name: t.name || t.type_name,
});

const mapRaceSeries = (s: any): LookupItem => ({
    ...s,
    name: s.name || s.series_name,
});

const safeFetchJson = async (path: string, options?: RequestInit) => {
  const url = `${WORKER_URL}${path}`;
  try {
    const res = await fetch(url, { 
        ...options, 
        headers: { ...getHeaders(), ...options?.headers },
        mode: 'cors'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || data.msg || `HTTP ${res.status}`);
    }
    return data;
  } catch (error: any) {
    console.error(`[API Error] ${path}:`, error);
    throw error;
  }
};

export const api = {
  login: async (id: string, password: string): Promise<{success: boolean, user?: LookupItem, msg?: string}> => {
      try {
          const res = await fetch(`${WORKER_URL}/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, password, team_id: TEAM_ID })
          });
          const data = await res.json();
          if (res.ok && data.success) {
              const user = mapPerson(data.user);
              localStorage.setItem('CHIACHIA_TOKEN', data.token);
              localStorage.setItem('CHIACHIA_USER', JSON.stringify(user));
              return { success: true, user: user };
          }
          return { success: false, msg: data.msg || '登入失敗' };
      } catch (e) {
          return { success: false, msg: '連線異常' };
      }
  },

  getUser: (): LookupItem | null => {
      const u = localStorage.getItem('CHIACHIA_USER');
      return u ? JSON.parse(u) : null;
  },

  logout: () => {
      localStorage.removeItem('CHIACHIA_TOKEN');
      localStorage.removeItem('CHIACHIA_USER');
  },

  fetchRaceEvents: async (): Promise<RaceEvent[]> => {
      try {
          const data = await safeFetchJson('/race-events');
          offlineService.save('race-events', data);
          return data;
      } catch (e) {
          const cached = await offlineService.get('race-events');
          if (cached) return cached;
          throw e;
      }
  },

  fetchAppData: async () => {
     const t = Date.now();
     try {
         const [records, events, types, series, people, legends, forecast] = await Promise.all([
             safeFetchJson(`/training-records?t=${t}`).catch(() => []),
             safeFetchJson(`/race-events?t=${t}`).catch(() => []),
             safeFetchJson(`/training-types?t=${t}`).catch(() => []),
             safeFetchJson(`/race-series?t=${t}`).catch(() => []),
             safeFetchJson(`/people?t=${t}`).catch(() => []),
             safeFetchJson(`/overview/legends?t=${t}`).catch(() => []),
             safeFetchJson(`/overview/forecast?t=${t}`).catch(() => [])
         ]);

         const mappedRecords = Array.isArray(records) ? records.map((r: any) => ({
             ...r,
             item: 'training',
             value: r.score || r.value,
         })) : [];

         const result = {
             records: mappedRecords,
             trainingTypes: Array.isArray(types) ? types.map(mapTrainingType) : [],
             races: Array.isArray(series) ? series.map(mapRaceSeries) : [],
             people: (Array.isArray(people) ? people : []).map(mapPerson),
             teamInfo: null,
             raceEvents: events,
             legends: Array.isArray(legends) ? legends : [],
             forecast: Array.isArray(forecast) ? forecast : []
         };

         offlineService.save('app-data', result);
         return result;
     } catch (e) {
         console.warn('Fetch app data failed, trying cache...', e);
         const cached = await offlineService.get('app-data');
         if (cached) return cached;
         throw e; // Or return empty structure
     }
  },

  manageRaceEvent: async (action: 'create' | 'delete', data: any) => {
      const url = action === 'delete' ? `/race-events?id=${data.id}` : `/race-events`;
      return await safeFetchJson(url, {
          method: action === 'create' ? 'POST' : 'DELETE',
          body: action === 'create' ? JSON.stringify(data) : undefined
      });
  },

  joinOrUpdateRace: async (eventId: string|number, peopleId: string|number, value?: string, raceGroup?: string, note?: string, photoUrl?: string, isPersonalHonor?: boolean) => {
      return await safeFetchJson('/race-records', {
          method: 'POST',
          body: JSON.stringify({ 
              event_id: eventId, 
              people_id: peopleId, 
              value: value || '', 
              race_group: raceGroup || '',
              note: note || '',
              photo_url: photoUrl,
              is_personal_honor: isPersonalHonor // New Field
          })
      });
  },

  exitRace: async (eventId: string|number, peopleId: string|number) => {
      return await safeFetchJson('/race-records', {
          method: 'DELETE',
          body: JSON.stringify({ event_id: eventId, people_id: peopleId })
      });
  },

  setGlobalHonor: async (recordId: string|number, durationMinutes: number) => {
      return await safeFetchJson('/race-records/global-honor', {
          method: 'POST',
          body: JSON.stringify({ record_id: recordId, duration_minutes: durationMinutes })
      });
  },

  fetchLegends: async () => await safeFetchJson('/overview/legends'),
  fetchForecast: async () => await safeFetchJson('/overview/forecast'),
  
  // Updated fetchWeeklyCourses to accept optional start and end dates
  fetchWeeklyCourses: async (start?: string, end?: string) => {
      const params = new URLSearchParams();
      if (start) params.append('start', start);
      if (end) params.append('end', end);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const key = `courses-${start || 'default'}-${end || 'default'}`;

      try {
          const data = await safeFetchJson(`/courses/weekly${qs}`);
          offlineService.save(key, data);
          return data;
      } catch (e) {
          const cached = await offlineService.get(key);
          if (cached) return cached;
          throw e;
      }
  },
  
  joinCourse: async (sessionId: string|number, peopleId: string|number) => {
      return await safeFetchJson('/courses/join', {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionId, people_id: peopleId })
      });
  },

  exitCourse: async (sessionId: string|number, peopleId: string|number, reason: string) => {
      return await safeFetchJson('/courses/exit', {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionId, people_id: peopleId, reason })
      });
  },

  // [NEW] Update Session Status
  updateSessionStatus: async (sessionId: string|number, status: 'CONFIRMED' | 'CANCELLED') => {
      return await safeFetchJson('/courses/session-status', {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionId, status })
      });
  },

  // [NEW] Delete Session
  deleteSession: async (sessionId: string|number) => {
      return await safeFetchJson(`/courses/sessions?id=${sessionId}`, {
          method: 'DELETE'
      });
  },

  authenticate: async (input: string) => {
      return await safeFetchJson('/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ code: input })
      });
  },

  generateOtp: async (force: boolean) => {
    return await safeFetchJson(`/admin/otp?force=${force}`, { method: 'POST' });
  },

  fetchWallets: async (): Promise<TicketWallet[]> => {
    try {
        const data = await safeFetchJson(`/tickets/wallets?t=${Date.now()}`);
        offlineService.save('wallets', data);
        return data;
    } catch (e) {
        const cached = await offlineService.get('wallets');
        if (cached) return cached;
        throw e;
    }
  },

  fetchCourseTemplates: async (): Promise<CourseTemplate[]> => {
    try {
        const data = await safeFetchJson(`/courses/templates?t=${Date.now()}`);
        offlineService.save('course-templates', data);
        return data;
    } catch (e) {
        const cached = await offlineService.get('course-templates');
        if (cached) return cached;
        throw e;
    }
  },

  manageLookup: async (table: string, name: string, id: any, is_default: boolean, is_hidden: boolean, extras: any) => {
    return await safeFetchJson('/lookup', {
      method: 'POST',
      body: JSON.stringify({ table, name, id, is_default, is_hidden, ...extras })
    });
  },

  createPerson: async (name: string, full_name: string, role: string, birthday: string, roles?: string[]) => {
    return await safeFetchJson('/people', {
      method: 'POST',
      body: JSON.stringify({ name, full_name, role, birthday, roles })
    });
  },

  // Updated: Accept price_paid for financial logging
  addTickets: async (people_id: any, type: string, amount: number, expiry_date?: string, note?: string, price_paid?: number) => {
    return await safeFetchJson('/tickets/add', {
      method: 'POST',
      body: JSON.stringify({ people_id, type, amount, expiry_date, note, price_paid })
    });
  },

  // [NEW] Update Ticket Batch
  updateTicketBatch: async (batch_id: any, amount: number, expiry_date: string) => {
    return await safeFetchJson('/tickets/batch', {
      method: 'PUT',
      body: JSON.stringify({ batch_id, amount, expiry_date })
    });
  },

  requestTicketPurchase: async (people_id: any, type: string, amount: number, last_5_digits: string, total_price: number) => {
    return await safeFetchJson('/tickets/purchase', {
      method: 'POST',
      body: JSON.stringify({ people_id, type, amount, last_5_digits, total_price })
    });
  },

  fetchTicketRequests: async () => {
      try {
          const data = await safeFetchJson(`/tickets/requests?t=${Date.now()}`);
          offlineService.save('ticket-requests', data);
          return data;
      } catch (e) {
          const cached = await offlineService.get('ticket-requests');
          if (cached) return cached;
          throw e;
      }
  },

  // Updated to accept reason and approved flag
  deleteTicketRequest: async (id: any, reason?: string, approved?: boolean) => {
      const params = new URLSearchParams();
      params.append('id', String(id));
      if (reason) params.append('reason', reason);
      if (approved) params.append('approved', 'true');
      return await safeFetchJson(`/tickets/requests?${params.toString()}`, { method: 'DELETE' });
  },

  saveTemplate: async (payload: any) => {
    return await safeFetchJson('/courses/templates', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  createClassSession: async (payload: any) => {
    return await safeFetchJson('/courses/sessions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  deleteTemplate: async (id: any) => {
    return await safeFetchJson(`/courses/templates?id=${id}`, { method: 'DELETE' });
  },

  manageTrainingType: async (action: 'create' | 'update' | 'delete', data: any) => {
    const url = action === 'delete' ? `/training-types?id=${data.id}` : `/training-types`;
    return await safeFetchJson(url, {
      method: action === 'delete' ? 'DELETE' : 'POST',
      body: action !== 'delete' ? JSON.stringify(data) : undefined
    });
  },

  manageRaceSeries: async (action: 'create' | 'update' | 'delete', data: any) => {
    const url = action === 'delete' ? `/race-series?id=${data.id}` : `/race-series`;
    return await safeFetchJson(url, {
      method: action === 'delete' ? 'DELETE' : 'POST',
      body: action !== 'delete' ? JSON.stringify(data) : undefined
    });
  },

  submitRecord: async (data: any, options?: RequestInit) => {
    return await safeFetchJson('/training-records', {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    });
  },

  manageTrainingRecord: async (action: 'update' | 'delete', data: any) => {
    return await safeFetchJson('/training-records', {
        method: action === 'update' ? 'PUT' : 'DELETE',
        body: JSON.stringify(data)
    });
  },

  fetchPushTemplates: async (): Promise<PushTemplates> => {
      return await safeFetchJson('/settings/push-templates');
  },

  savePushTemplates: async (data: PushTemplates) => {
      return await safeFetchJson('/settings/push-templates', {
          method: 'POST',
          body: JSON.stringify(data)
      });
  },

  fetchCourseSystemStatus: async (): Promise<{enabled: boolean}> => {
      try {
          const data = await safeFetchJson('/settings/course-system');
          offlineService.save('course-system-status', data);
          return data;
      } catch (e) {
          const cached = await offlineService.get('course-system-status');
          if (cached) return cached;
          throw e;
      }
  },

  toggleCourseSystem: async (enabled: boolean) => {
      return await safeFetchJson('/settings/course-system', {
          method: 'POST',
          body: JSON.stringify({ enabled })
      });
  },

  fetchTicketPricing: async (): Promise<TicketPricing> => {
      try {
          const data = await safeFetchJson('/settings/ticket-pricing');
          offlineService.save('ticket-pricing', data);
          return data;
      } catch (e) {
          const cached = await offlineService.get('ticket-pricing');
          if (cached) return cached;
          throw e;
      }
  },

  saveTicketPricing: async (data: TicketPricing) => {
      return await safeFetchJson('/settings/ticket-pricing', {
          method: 'POST',
          body: JSON.stringify(data)
      });
  },

  fetchFinancialReport: async (month?: string, year?: number): Promise<FinancialReport> => {
      let qs = `?t=${Date.now()}`;
      if (month) qs += `&month=${month}`;
      if (year) qs += `&year=${year}`;
      const key = `financial-report-${month || 'default'}-${year || 'default'}`;
      try {
          const data = await safeFetchJson(`/finance/report${qs}`);
          offlineService.save(key, data);
          return data;
      } catch (e) {
          const cached = await offlineService.get(key);
          if (cached) return cached;
          throw e;
      }
  },

  fetchFinancialHistory: async (peopleId?: string|number): Promise<FinancialRecord[]> => {
      const qs = peopleId ? `?people_id=${peopleId}&t=${Date.now()}` : `?t=${Date.now()}`;
      const key = `financial-history-${peopleId || 'all'}`;
      try {
          const data = await safeFetchJson(`/finance/history${qs}`);
          offlineService.save(key, data);
          return data;
      } catch (e) {
          const cached = await offlineService.get(key);
          if (cached) return cached;
          throw e;
      }
  },

  fetchUnreadCount: async (userId: string|number): Promise<{count: number}> => {
      return await safeFetchJson(`/notifications/unread-count?user_id=${userId}&t=${Date.now()}`);
  },

  fetchNotifications: async (userId: string|number): Promise<any[]> => {
      return await safeFetchJson(`/notifications?user_id=${userId}&t=${Date.now()}`);
  },

  markNotificationRead: async (id: number, userId: string|number) => {
      return await safeFetchJson('/notifications/read', {
          method: 'POST',
          body: JSON.stringify({ id, user_id: userId })
      });
  },

  markAllNotificationsRead: async (userId: string|number) => {
      return await safeFetchJson('/notifications/read-all', {
          method: 'POST',
          body: JSON.stringify({ user_id: userId })
      });
  },

  fetchBankAccount: async () => {
      try {
          const data = await safeFetchJson('/settings/bank-account');
          offlineService.save('bank-account', data);
          return data;
      } catch (e) {
          const cached = await offlineService.get('bank-account');
          if (cached) return cached;
          throw e;
      }
  },

  // [NEW] Manual Add Tickets (Admin)
  manualAddTickets: async (data: any) => {
      return await safeFetchJson('/tickets/manual-add', {
          method: 'POST',
          body: JSON.stringify(data)
      });
  },

  createTrialRider: async (name: string) => {
      return await safeFetchJson('/people/trial', {
          method: 'POST',
          body: JSON.stringify({ name })
      });
  },

  saveBankAccount: async (data: any) => {
      return await safeFetchJson('/settings/bank-account', {
          method: 'POST',
          body: JSON.stringify(data)
      });
  },

  // [NEW] Sync Historical Data (1 Year)
  syncHistoricalData: async () => {
      console.log('[Sync] Starting background sync for historical data...');
      const now = new Date();
      // Sync past 12 months of courses
      for (let i = 1; i <= 12; i++) {
          const d = subMonths(now, i);
          const start = format(startOfMonth(d), 'yyyy-MM-dd');
          const end = format(endOfMonth(d), 'yyyy-MM-dd');
          try {
              await api.fetchWeeklyCourses(start, end);
              // Small delay to avoid hammering the server
              await new Promise(r => setTimeout(r, 500));
          } catch (e) {
              console.warn(`[Sync] Failed to sync courses for ${start}`, e);
          }
      }

      // Sync financial history for current user if logged in
      const user = api.getUser();
      if (user && user.id) {
          try {
              await api.fetchFinancialHistory(user.id);
          } catch (e) {
              console.warn(`[Sync] Failed to sync financial history`, e);
          }
      }
      console.log('[Sync] Historical data sync completed');
  }
};
