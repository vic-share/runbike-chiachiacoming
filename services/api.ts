
import { DataRecord, LookupItem, TeamInfo, ClassSession, Enrollment, TicketWallet, CourseTemplate, LegendRecord, RaceEvent, PushTemplates, TicketPricing, FinancialRecord, FinancialReport } from '../types';

const getWorkerUrl = () => {
    if (typeof window === 'undefined') return '';
    const host = window.location.hostname;
    
    // [Fix] Local development should use relative path (proxied by Vite)
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return ''; 
    }
    
    if (host.includes('pages.dev') || host.includes('chiachiacoming')) {
        return 'https://runbike-chiachiacoming.vic070680.workers.dev';
    }
    return 'https://runbile-api-for-aistudio.vic070680.workers.dev';
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
        roles = p.roles ? JSON.parse(p.roles) : (p.role === 'admin' ? ['COACH', 'RIDER'] : ['RIDER']);
    } catch (e) {
        roles = ['RIDER'];
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
          const res = await fetch(`${WORKER_URL}/api/login`, {
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
      return await safeFetchJson('/api/race-events');
  },

  fetchAppData: async () => {
     const t = Date.now();
     const [records, events, types, series, people, legends, forecast] = await Promise.all([
         safeFetchJson(`/api/training-records?t=${t}`).catch(() => []),
         safeFetchJson(`/api/race-events?t=${t}`).catch(() => []),
         safeFetchJson(`/api/training-types?t=${t}`).catch(() => []),
         safeFetchJson(`/api/race-series?t=${t}`).catch(() => []),
         safeFetchJson(`/api/people?t=${t}`).catch(() => []),
         safeFetchJson(`/api/overview/legends?t=${t}`).catch(() => []),
         safeFetchJson(`/api/overview/forecast?t=${t}`).catch(() => [])
     ]);

     const mappedRecords = Array.isArray(records) ? records.map((r: any) => ({
         ...r,
         item: 'training',
         value: r.score || r.value,
     })) : [];

     return {
         records: mappedRecords,
         trainingTypes: Array.isArray(types) ? types.map(mapTrainingType) : [],
         races: Array.isArray(series) ? series.map(mapRaceSeries) : [],
         people: (Array.isArray(people) ? people : []).map(mapPerson),
         teamInfo: null,
         raceEvents: events,
         legends: Array.isArray(legends) ? legends : [],
         forecast: Array.isArray(forecast) ? forecast : []
     };
  },

  manageRaceEvent: async (action: 'create' | 'delete', data: any) => {
      const url = action === 'delete' ? `/api/race-events?id=${data.id}` : `/api/race-events`;
      return await safeFetchJson(url, {
          method: action === 'create' ? 'POST' : 'DELETE',
          body: action === 'create' ? JSON.stringify(data) : undefined
      });
  },

  joinOrUpdateRace: async (eventId: string|number, peopleId: string|number, value?: string, raceGroup?: string, note?: string, photoUrl?: string, isPersonalHonor?: boolean) => {
      return await safeFetchJson('/api/race-records', {
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
      return await safeFetchJson('/api/race-records', {
          method: 'DELETE',
          body: JSON.stringify({ event_id: eventId, people_id: peopleId })
      });
  },

  setGlobalHonor: async (recordId: string|number, durationMinutes: number) => {
      return await safeFetchJson('/api/race-records/global-honor', {
          method: 'POST',
          body: JSON.stringify({ record_id: recordId, duration_minutes: durationMinutes })
      });
  },

  fetchLegends: async () => await safeFetchJson('/api/overview/legends'),
  fetchForecast: async () => await safeFetchJson('/api/overview/forecast'),
  
  // Updated fetchWeeklyCourses to accept optional start and end dates
  fetchWeeklyCourses: async (start?: string, end?: string) => {
      const params = new URLSearchParams();
      if (start) params.append('start', start);
      if (end) params.append('end', end);
      const qs = params.toString() ? `?${params.toString()}` : '';
      return await safeFetchJson(`/api/courses/weekly${qs}`);
  },
  
  joinCourse: async (sessionId: string|number, peopleId: string|number) => {
      return await safeFetchJson('/api/courses/join', {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionId, people_id: peopleId })
      });
  },

  exitCourse: async (sessionId: string|number, peopleId: string|number, reason: string) => {
      return await safeFetchJson('/api/courses/exit', {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionId, people_id: peopleId, reason })
      });
  },

  // [NEW] Update Session Status
  updateSessionStatus: async (sessionId: string|number, status: 'CONFIRMED' | 'CANCELLED') => {
      return await safeFetchJson('/api/courses/session-status', {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionId, status })
      });
  },

  // [NEW] Delete Session
  deleteSession: async (sessionId: string|number) => {
      return await safeFetchJson(`/api/courses/sessions?id=${sessionId}`, {
          method: 'DELETE'
      });
  },

  authenticate: async (input: string) => {
      return await safeFetchJson('/api/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ code: input })
      });
  },

  generateOtp: async (force: boolean) => {
    return await safeFetchJson(`/api/admin/otp?force=${force}`, { method: 'POST' });
  },

  fetchWallets: async (): Promise<TicketWallet[]> => {
    return await safeFetchJson(`/api/tickets/wallets?t=${Date.now()}`);
  },

  fetchCourseTemplates: async (): Promise<CourseTemplate[]> => {
    return await safeFetchJson(`/api/courses/templates?t=${Date.now()}`);
  },

  manageLookup: async (table: string, name: string, id: any, is_default: boolean, is_hidden: boolean, extras: any) => {
    return await safeFetchJson('/api/lookup', {
      method: 'POST',
      body: JSON.stringify({ table, name, id, is_default, is_hidden, ...extras })
    });
  },

  createPerson: async (name: string, full_name: string, role: string, birthday: string, roles?: string[]) => {
    return await safeFetchJson('/api/people', {
      method: 'POST',
      body: JSON.stringify({ name, full_name, role, birthday, roles })
    });
  },

  // Updated: Accept price_paid for financial logging
  addTickets: async (people_id: any, type: string, amount: number, expiry_date?: string, note?: string, price_paid?: number) => {
    return await safeFetchJson('/api/tickets/add', {
      method: 'POST',
      body: JSON.stringify({ people_id, type, amount, expiry_date, note, price_paid })
    });
  },

  // [NEW] Update Ticket Batch
  updateTicketBatch: async (batch_id: any, amount: number, expiry_date: string) => {
    return await safeFetchJson('/api/tickets/batch', {
      method: 'PUT',
      body: JSON.stringify({ batch_id, amount, expiry_date })
    });
  },

  requestTicketPurchase: async (people_id: any, type: string, amount: number, last_5_digits: string, total_price: number) => {
    return await safeFetchJson('/api/tickets/purchase', {
      method: 'POST',
      body: JSON.stringify({ people_id, type, amount, last_5_digits, total_price })
    });
  },

  fetchTicketRequests: async () => {
      return await safeFetchJson(`/api/tickets/requests?t=${Date.now()}`);
  },

  // Updated to accept reason
  deleteTicketRequest: async (id: any, reason?: string) => {
      const qs = reason ? `&reason=${encodeURIComponent(reason)}` : '';
      return await safeFetchJson(`/api/tickets/requests?id=${id}${qs}`, { method: 'DELETE' });
  },

  saveTemplate: async (payload: any) => {
    return await safeFetchJson('/api/courses/templates', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  createClassSession: async (payload: any) => {
    return await safeFetchJson('/api/courses/sessions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  deleteTemplate: async (id: any) => {
    return await safeFetchJson(`/api/courses/templates?id=${id}`, { method: 'DELETE' });
  },

  manageTrainingType: async (action: 'create' | 'update' | 'delete', data: any) => {
    const url = action === 'delete' ? `/api/training-types?id=${data.id}` : `/api/training-types`;
    return await safeFetchJson(url, {
      method: action === 'delete' ? 'DELETE' : 'POST',
      body: action !== 'delete' ? JSON.stringify(data) : undefined
    });
  },

  manageRaceSeries: async (action: 'create' | 'update' | 'delete', data: any) => {
    const url = action === 'delete' ? `/api/race-series?id=${data.id}` : `/api/race-series`;
    return await safeFetchJson(url, {
      method: action === 'delete' ? 'DELETE' : 'POST',
      body: action !== 'delete' ? JSON.stringify(data) : undefined
    });
  },

  submitRecord: async (data: any) => {
    return await safeFetchJson('/api/training-records', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  manageTrainingRecord: async (action: 'update' | 'delete', data: any) => {
    return await safeFetchJson('/api/training-records', {
        method: action === 'update' ? 'PUT' : 'DELETE',
        body: JSON.stringify(data)
    });
  },

  fetchPushTemplates: async (): Promise<PushTemplates> => {
      return await safeFetchJson('/api/settings/push-templates');
  },

  savePushTemplates: async (data: PushTemplates) => {
      return await safeFetchJson('/api/settings/push-templates', {
          method: 'POST',
          body: JSON.stringify(data)
      });
  },

  fetchCourseSystemStatus: async (): Promise<{enabled: boolean}> => {
      return await safeFetchJson('/api/settings/course-system');
  },

  toggleCourseSystem: async (enabled: boolean) => {
      return await safeFetchJson('/api/settings/course-system', {
          method: 'POST',
          body: JSON.stringify({ enabled })
      });
  },

  fetchTicketPricing: async (): Promise<TicketPricing> => {
      return await safeFetchJson('/api/settings/ticket-pricing');
  },

  saveTicketPricing: async (data: TicketPricing) => {
      return await safeFetchJson('/api/settings/ticket-pricing', {
          method: 'POST',
          body: JSON.stringify(data)
      });
  },

  fetchFinancialReport: async (month?: string): Promise<FinancialReport> => {
      const qs = month ? `?month=${month}&t=${Date.now()}` : `?t=${Date.now()}`;
      return await safeFetchJson(`/api/finance/report${qs}`);
  },

  fetchFinancialHistory: async (peopleId?: string|number): Promise<FinancialRecord[]> => {
      const qs = peopleId ? `?people_id=${peopleId}&t=${Date.now()}` : `?t=${Date.now()}`;
      return await safeFetchJson(`/api/finance/history${qs}`);
  },

  fetchUnreadCount: async (userId: string|number): Promise<{count: number}> => {
      return await safeFetchJson(`/api/notifications/unread-count?user_id=${userId}&t=${Date.now()}`);
  },

  fetchNotifications: async (userId: string|number): Promise<any[]> => {
      return await safeFetchJson(`/api/notifications?user_id=${userId}&t=${Date.now()}`);
  },

  markNotificationRead: async (id: number, userId: string|number) => {
      return await safeFetchJson('/api/notifications/read', {
          method: 'POST',
          body: JSON.stringify({ id, user_id: userId })
      });
  },

  markAllNotificationsRead: async (userId: string|number) => {
      return await safeFetchJson('/api/notifications/read-all', {
          method: 'POST',
          body: JSON.stringify({ user_id: userId })
      });
  }
};
