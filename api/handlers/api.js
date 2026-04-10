// 根據環境決定 API 網址
const BASE_URL = (typeof window !== 'undefined' && (window as any).ENV?.VITE_WORKER_URL) 
    || import.meta.env.VITE_WORKER_URL 
    || 'https://runbike-chiachiacoming.sky070680.workers.dev';

export const api = {
    getUser: () => {
        const userStr = localStorage.getItem('CHIACHIA_USER');
        if (!userStr) return null;
        try { return JSON.parse(userStr); } catch { return null; }
    },

    login: async (id: string, password?: string) => {
        const res = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            body: JSON.stringify({ id, password }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('CHIACHIA_USER', JSON.stringify(data.user));
            localStorage.setItem('CHIACHIA_TOKEN', data.token);
        }
        return data;
    },

    logout: () => {
        localStorage.removeItem('CHIACHIA_USER');
        localStorage.removeItem('CHIACHIA_TOKEN');
    },

    // App Initial Load
    fetchAppData: async () => {
        const [trainingTypes, races, people] = await Promise.all([
            fetch(`${BASE_URL}/api/training-types`).then(r => r.json()),
            fetch(`${BASE_URL}/api/race-series`).then(r => r.json()),
            fetch(`${BASE_URL}/api/people`).then(r => r.json())
        ]);
        const forecast = await fetch(`${BASE_URL}/api/overview/forecast`).then(r => r.json()).catch(() => []);
        const legends = await fetch(`${BASE_URL}/api/overview/legends`).then(r => r.json()).catch(() => []);
        return {
            records: [], // 由頁面自己載入
            trainingTypes, races, people, raceEvents: [], // 由頁面自己載入
            forecast, legends, teamInfo: { team_name: '嘉嘉來了', team_en_name: 'Chia Chia Coming' }
        };
    },

    // 🟢 訓練數據請求：支援限制「天數」、篩選人、篩選類型
    fetchTrainingRecords: async (limitDates = 10, offsetDates = 0, peopleId = '', typeId = '', startDate = '', endDate = '') => {
        const params = new URLSearchParams();
        params.append('limit_dates', String(limitDates));
        params.append('offset_dates', String(offsetDates));
        if (peopleId) params.append('people_id', String(peopleId));
        if (typeId) params.append('training_type_id', String(typeId));
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const res = await fetch(`${BASE_URL}/api/training-records?${params.toString()}`, { headers: { 'Cache-Control': 'no-cache' }});
        if (!res.ok) throw new Error('連線失敗');
        const data = await res.json();
        return data.map((r: any) => ({ ...r, item: 'training' }));
    },

    submitRecord: async (record: any, options?: RequestInit) => {
        const res = await fetch(`${BASE_URL}/api/training-records`, { method: 'POST', body: JSON.stringify(record), headers: { 'Content-Type': 'application/json' }, ...options });
        return res.json();
    },

    deleteTrainingRecord: async (id: string | number) => {
        const res = await fetch(`${BASE_URL}/api/training-records`, { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    // 🟢 賽事請求：支援過濾
    fetchRaceEventsPaginated: async (limit = 10, offset = 0, seriesId = '', startDate = '', endDate = '', status = '', cutoffDate = '', joinedUserId = '') => {
        const params = new URLSearchParams();
        params.append('limit', String(limit));
        params.append('offset', String(offset));
        if (seriesId) params.append('series_id', seriesId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (status) params.append('status', status);
        if (cutoffDate) params.append('cutoff_date', cutoffDate);
        if (joinedUserId) params.append('joined_user_id', String(joinedUserId));

        const res = await fetch(`${BASE_URL}/api/race-events?${params.toString()}`, { headers: { 'Cache-Control': 'no-cache' }});
        if (!res.ok) throw new Error('連線失敗');
        return res.json();
    },

    manageRaceEvent: async (action: 'create' | 'delete', data: any) => {
        const method = action === 'delete' ? 'DELETE' : 'POST';
        const res = await fetch(`${BASE_URL}/api/race-events${action === 'delete' ? `?id=${data.id}` : ''}`, { method, body: action === 'delete' ? null : JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    joinOrUpdateRace: async (event_id: any, people_id: any, value?: string, race_group?: string, note?: string, photo_url?: string, is_personal_honor?: boolean) => {
        const res = await fetch(`${BASE_URL}/api/race-records`, { method: 'POST', body: JSON.stringify({ event_id, people_id, value, race_group, note, photo_url, is_personal_honor }), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    exitRace: async (event_id: any, people_id: any) => {
        const res = await fetch(`${BASE_URL}/api/race-records`, { method: 'DELETE', body: JSON.stringify({ event_id, people_id }), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    setGlobalHonor: async (record_id: any, duration_minutes: number) => {
        const res = await fetch(`${BASE_URL}/api/race-records/global-honor`, { method: 'POST', body: JSON.stringify({ record_id, duration_minutes }), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    fetchWeeklyCourses: async (start?: string, end?: string) => {
        const params = new URLSearchParams();
        if (start) params.append('start', start);
        if (end) params.append('end', end);
        const res = await fetch(`${BASE_URL}/api/courses/weekly?${params.toString()}`);
        return res.json();
    },

    createClassSession: async (data: any) => {
        const res = await fetch(`${BASE_URL}/api/courses/sessions`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    updateSessionStatus: async (session_id: any, status: string) => {
        const res = await fetch(`${BASE_URL}/api/courses/session-status`, { method: 'POST', body: JSON.stringify({ session_id, status }), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    joinCourse: async (session_id: any, people_id: any) => {
        const res = await fetch(`${BASE_URL}/api/courses/join`, { method: 'POST', body: JSON.stringify({ session_id, people_id }), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    exitCourse: async (session_id: any, people_id: any, reason: string) => {
        const res = await fetch(`${BASE_URL}/api/courses/exit`, { method: 'POST', body: JSON.stringify({ session_id, people_id, reason }), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    deleteSession: async (id: any) => {
        const res = await fetch(`${BASE_URL}/api/courses/sessions?id=${id}`, { method: 'DELETE' });
        return res.json();
    },

    fetchWallets: async () => {
        const res = await fetch(`${BASE_URL}/api/tickets/wallets`);
        return res.json();
    },

    fetchFinancialHistory: async (people_id?: any, limit: number = 50, offset: number = 0) => {
        const params = new URLSearchParams();
        if (people_id) params.append('people_id', String(people_id));
        params.append('limit', String(limit));
        params.append('offset', String(offset));
        const res = await fetch(`${BASE_URL}/api/finance/history?${params.toString()}`);
        return res.json();
    },

    purchaseTickets: async (data: any) => {
        const res = await fetch(`${BASE_URL}/api/tickets/purchase`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    addTicketsManual: async (data: any) => {
        const res = await fetch(`${BASE_URL}/api/tickets/manual-add`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    fetchUnreadCount: async (user_id: any) => {
        const res = await fetch(`${BASE_URL}/api/notifications/unread-count?user_id=${user_id}`);
        return res.json();
    },

    fetchNotifications: async (user_id: any) => {
        const res = await fetch(`${BASE_URL}/api/notifications?user_id=${user_id}`);
        return res.json();
    },

    markNotificationRead: async (id: any, user_id: any) => {
        await fetch(`${BASE_URL}/api/notifications/read`, { method: 'POST', body: JSON.stringify({ id, user_id }), headers: { 'Content-Type': 'application/json' } });
    },

    markAllNotificationsRead: async (user_id: any) => {
        await fetch(`${BASE_URL}/api/notifications/read-all`, { method: 'POST', body: JSON.stringify({ user_id }), headers: { 'Content-Type': 'application/json' } });
    },

    fetchCourseSystemStatus: async () => {
        const res = await fetch(`${BASE_URL}/api/settings/course-system`);
        return res.json();
    },

    fetchTicketPricing: async () => {
        const res = await fetch(`${BASE_URL}/api/settings/ticket-pricing`);
        return res.json();
    },

    fetchPushTemplates: async () => {
        const res = await fetch(`${BASE_URL}/api/settings/push-templates`);
        return res.json();
    },

    savePushTemplates: async (data: any) => {
        await fetch(`${BASE_URL}/api/settings/push-templates`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
    },

    manageLookup: async (table: string, name: string, id?: any, is_default?: boolean, is_hidden?: boolean, extras?: any) => {
        const res = await fetch(`${BASE_URL}/api/lookup`, { method: 'POST', body: JSON.stringify({ table, id, name, is_default, is_hidden, ...extras }), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    createTrialRider: async (name: string) => {
        const res = await fetch(`${BASE_URL}/api/people/trial`, { method: 'POST', body: JSON.stringify({ name }), headers: { 'Content-Type': 'application/json' } });
        return res.json();
    },

    syncHistoricalData: async () => {
        console.log("[System] 偵測到網路恢復，執行背景同步...");
    }
};