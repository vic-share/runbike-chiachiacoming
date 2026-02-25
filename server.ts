
import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import cors from 'cors';
import bodyParser from 'body-parser';
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;
const TEAM_ID = 1;

// --- Database Setup ---
const db = new Database(process.env.RUNBIKE_DB_FILENAME || 'local.db');

function initDB() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS People (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            name TEXT,
            full_name TEXT,
            role TEXT,
            roles TEXT,
            birthday TEXT,
            avatar_url TEXT,
            full_photo_url TEXT,
            bio TEXT,
            is_retired INTEGER DEFAULT 0,
            password TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS RaceEvents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            name TEXT,
            date TEXT,
            location TEXT,
            series_id INTEGER,
            public_url TEXT
        );
        CREATE TABLE IF NOT EXISTS RaceSeries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            series_name TEXT
        );
        CREATE TABLE IF NOT EXISTS RaceRecords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            event_id INTEGER,
            people_id INTEGER,
            score TEXT,
            ranking TEXT,
            note TEXT,
            personal_url TEXT,
            is_personal_honor INTEGER DEFAULT 0,
            global_honor_expires_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS TrainingRecords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            people_id INTEGER,
            training_type_id INTEGER,
            date TEXT,
            score TEXT,
            note TEXT
        );
        CREATE TABLE IF NOT EXISTS TrainingTypes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            type_name TEXT,
            is_default INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS ClassSessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            template_id INTEGER,
            date TEXT,
            start_time TEXT,
            end_time TEXT,
            name TEXT,
            location TEXT,
            max_students INTEGER,
            ticket_type TEXT,
            status TEXT,
            price INTEGER,
            category TEXT
        );
        CREATE TABLE IF NOT EXISTS Enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            people_id INTEGER,
            status TEXT,
            note TEXT
        );
        CREATE TABLE IF NOT EXISTS CourseTemplates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            name TEXT,
            day_of_week INTEGER,
            start_time TEXT,
            end_time TEXT,
            location TEXT,
            price INTEGER,
            max_students INTEGER,
            ticket_type TEXT,
            default_student_ids TEXT,
            is_auto_scheduled INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS PushSubscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint TEXT,
            p256dh TEXT,
            auth TEXT,
            people_id INTEGER
        );
        CREATE TABLE IF NOT EXISTS TicketBatches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            people_id INTEGER,
            ticket_type TEXT,
            initial_amount INTEGER,
            remaining_amount INTEGER,
            expiry_date TEXT
        );
        CREATE TABLE IF NOT EXISTS TicketRequests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            people_id INTEGER,
            type TEXT,
            amount INTEGER,
            last_5_digits TEXT,
            total_price INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS FinancialRecords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            people_id INTEGER,
            transaction_type TEXT,
            amount_cash INTEGER DEFAULT 0,
            amount_ticket INTEGER DEFAULT 0,
            ticket_type TEXT,
            note TEXT,
            related_session_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS SystemNotifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER DEFAULT 1,
            user_id INTEGER,
            title TEXT,
            action_link TEXT,
            is_read BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

initDB();

// --- KV Store Setup ---
const KV_FILE = process.env.RUNBIKE_KV_FILENAME || 'kv.json';
const KV = {
    async get(key, options = {}) {
        try {
            if (!fs.existsSync(KV_FILE)) return null;
            const data = JSON.parse(fs.readFileSync(KV_FILE, 'utf8'));
            return data[key] || null;
        } catch (e) {
            return null;
        }
    },
    async put(key, value, options = {}) {
        try {
            let data = {};
            if (fs.existsSync(KV_FILE)) {
                data = JSON.parse(fs.readFileSync(KV_FILE, 'utf8'));
            }
            data[key] = value; // value is already stringified JSON usually
            fs.writeFileSync(KV_FILE, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('KV Put Error:', e);
        }
    }
};

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());

// --- Helper Functions ---
async function sendPushToRole(role, title, body, url = "/") {
    // Mock implementation or real if keys exist
    // For now, just log it as we might not have VAPID keys
    console.log(`[PUSH] To ${role}: ${title} - ${body}`);
    return 0;
}

async function sendPushToUser(peopleId, title, body, url = "/") {
    console.log(`[PUSH] To User ${peopleId}: ${title} - ${body}`);
    return 0;
}

async function sendPushToParticipants(entityId, type, title, body, url = "/") {
    console.log(`[PUSH] To Participants of ${type} ${entityId}: ${title} - ${body}`);
}

async function createNotification(userId, title, actionLink) {
    try {
        db.prepare(`INSERT INTO SystemNotifications (team_id, user_id, title, action_link) VALUES (?, ?, ?, ?)`).run(TEAM_ID, userId, title, actionLink);
    } catch (e) { console.error("Create Notification Error:", e); }
}

async function createNotificationForRole(role, title, actionLink) {
    try {
        const query = role === 'all' ? `SELECT id FROM People WHERE team_id = ?` : `SELECT id FROM People WHERE team_id = ? AND roles LIKE ?`;
        const params = role === 'all' ? [TEAM_ID] : [TEAM_ID, `%"${role}"%`];
        const results = db.prepare(query).all(...params);
        
        const stmt = db.prepare(`INSERT INTO SystemNotifications (team_id, user_id, title, action_link) VALUES (?, ?, ?, ?)`);
        const transaction = db.transaction((notifications) => {
            for (const n of notifications) stmt.run(TEAM_ID, n.id, title, actionLink);
        });
        transaction(results);
    } catch (e) { console.error("Create Role Notification Error:", e); }
}

async function logFinance({ peopleId, type, amountCash = 0, amountTicket = 0, ticketType = null, note = '', sessionId = null }) {
    try {
        db.prepare(`INSERT INTO FinancialRecords (team_id, people_id, transaction_type, amount_cash, amount_ticket, ticket_type, note, related_session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(TEAM_ID, peopleId, type, amountCash || 0, amountTicket || 0, ticketType || null, note || '', sessionId || null);
    } catch (e) { console.error("Log Finance Error:", e); }
}

async function enrollDefaultStudents(sessionId, templateId) {
    if (!templateId) return;
    try {
        const tpl = db.prepare("SELECT default_student_ids FROM CourseTemplates WHERE id = ?").get(templateId);
        if (tpl && tpl.default_student_ids) {
            const ids = JSON.parse(tpl.default_student_ids);
            if (Array.isArray(ids) && ids.length > 0) {
                const stmt = db.prepare("INSERT OR IGNORE INTO Enrollments (session_id, people_id, status) VALUES (?, ?, 'ENROLLED')");
                const transaction = db.transaction((studentIds) => {
                    for (const pid of studentIds) stmt.run(sessionId, pid);
                });
                transaction(ids);
                console.log(`[AutoEnroll] Enrolled ${ids.length} students for session ${sessionId}`);
            }
        }
    } catch (e) {
        console.error("Auto Enroll Error:", e);
    }
}

async function deductTickets(peopleId, type, amount, allowOverdraft = false, sessionName = "") {
    if (amount <= 0) return { success: true, overdraft: false };
    const batches = db.prepare(`SELECT id, remaining_amount, expiry_date FROM TicketBatches WHERE people_id = ? AND ticket_type = ? AND remaining_amount > 0 AND expiry_date >= DATE('now') ORDER BY expiry_date ASC`).all(peopleId, type);
    
    let toDeduct = amount;
    const transaction = db.transaction(() => {
        for (const batch of batches) {
            if (toDeduct <= 0) break;
            const taking = Math.min(batch.remaining_amount, toDeduct);
            db.prepare("UPDATE TicketBatches SET remaining_amount = remaining_amount - ? WHERE id = ?").run(taking, batch.id);
            toDeduct -= taking;
        }
        
        let isOverdraft = false;
        if (toDeduct > 0) {
            if (!allowOverdraft) throw new Error(`票卷餘額不足 (缺少 ${toDeduct} 張)`);
            db.prepare(`INSERT INTO TicketBatches (team_id, people_id, ticket_type, initial_amount, remaining_amount, expiry_date) VALUES (?, ?, ?, 0, ?, '2099-12-31')`).run(TEAM_ID, peopleId, type, -toDeduct);
            isOverdraft = true;
        }
        return isOverdraft;
    });

    const isOverdraft = transaction();
    await logFinance({ peopleId, type: 'SPEND', amountTicket: -amount, ticketType: type, note: `課程扣票: ${sessionName}` });
    await createNotification(peopleId, `扣票通知: ${sessionName} (${amount}張)`, '/?page=settings&target=rider_history');
    return { success: true, overdraft: isOverdraft };
}

async function refundTickets(peopleId, type, amount, reason = "") {
    if (amount <= 0) return;
    const expiry = new Date(); expiry.setDate(expiry.getDate() + 90);
    const expiryStr = expiry.toISOString().split('T')[0];
    db.prepare(`INSERT INTO TicketBatches (team_id, people_id, ticket_type, initial_amount, remaining_amount, expiry_date) VALUES (?, ?, ?, ?, ?, ?)`).run(TEAM_ID, peopleId, type, amount, amount, expiryStr);
    await logFinance({ peopleId, type: 'REFUND', amountTicket: amount, ticketType: type, note: `課程退票: ${reason}` });
    await createNotification(peopleId, `退票通知: ${reason} (${amount}張)`, '/?page=settings&target=rider_history');
}

// --- API Routes ---

app.get('/api/env.js', (req, res) => {
    const script = `window.ENV = window.ENV || {}; window.ENV.VITE_SUPABASE_URL = "${process.env.VITE_SUPABASE_URL || ''}"; window.ENV.VITE_SUPABASE_ANON_KEY = "${process.env.VITE_SUPABASE_ANON_KEY || ''}"; window.ENV.VAPID_PUBLIC_KEY = "${process.env.VAPID_PUBLIC_KEY || ''}";`;
    res.setHeader('Content-Type', 'application/javascript');
    res.send(script);
});

app.post('/api/lookup', async (req, res) => {
    try {
        const { table, id, name, is_hidden, ...extras } = req.body;
        if (table === 'people') {
            let query = "UPDATE People SET name = ?, is_retired = ?";
            const params = [name, is_hidden ? 1 : 0];

            if (extras.full_name !== undefined) { query += ", full_name = ?"; params.push(extras.full_name); }
            if (extras.birthday !== undefined) { query += ", birthday = ?"; params.push(extras.birthday); }
            if (extras.roles !== undefined) { query += ", roles = ?"; params.push(JSON.stringify(extras.roles)); }
            if (extras.bio !== undefined || extras.myword !== undefined) { query += ", bio = ?"; params.push(extras.bio || extras.myword); }
            if (extras.s_url !== undefined) { query += ", avatar_url = ?"; params.push(extras.s_url); }
            if (extras.b_url !== undefined) { query += ", full_photo_url = ?"; params.push(extras.b_url); }
            
            if (extras.password) {
                const hash = crypto.createHash('sha256').update(String(extras.password).trim()).digest('hex');
                query += ", password = ?";
                params.push(hash);
            }

            query += " WHERE id = ? AND team_id = ?";
            params.push(id, TEAM_ID);

            db.prepare(query).run(...params);
            res.json({ success: true });
        } else {
            res.json({ success: false, msg: "Unknown table" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/people', (req, res) => {
    const results = db.prepare(`SELECT id, team_id, name, role, roles, birthday, avatar_url as s_url, full_photo_url as b_url, bio as myword, is_retired as is_hidden, full_name FROM People WHERE team_id = ${TEAM_ID}`).all();
    res.json(results);
});

app.post('/api/people', (req, res) => {
    const { name, full_name, role, birthday, roles } = req.body;
    const result = db.prepare("INSERT INTO People (team_id, name, full_name, role, birthday, roles, password) VALUES (?, ?, ?, ?, ?, ?, ?)").run(TEAM_ID, name, full_name, role || 'parent', birthday || null, JSON.stringify(roles || ['RIDER']), '123456');
    res.json({ success: true, id: result.lastInsertRowid });
});

app.get('/api/notifications/unread-count', (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.json({ count: 0 });
    const result = db.prepare("SELECT COUNT(*) as count FROM SystemNotifications WHERE user_id = ? AND is_read = 0 AND team_id = ?").get(userId, TEAM_ID);
    res.json(result || { count: 0 });
});

app.get('/api/notifications', (req, res) => {
    const userId = req.query.user_id;
    const results = db.prepare(`SELECT id, team_id, user_id, title, action_link, is_read, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at FROM SystemNotifications WHERE user_id = ? AND team_id = ? ORDER BY created_at DESC LIMIT 30`).all(userId, TEAM_ID);
    res.json(results);
});

app.post('/api/notifications/read', (req, res) => {
    const { id, user_id } = req.body;
    db.prepare("UPDATE SystemNotifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(id, user_id);
    res.json({ success: true });
});

app.post('/api/notifications/read-all', (req, res) => {
    const { user_id } = req.body;
    db.prepare("UPDATE SystemNotifications SET is_read = 1 WHERE user_id = ? AND team_id = ?").run(user_id, TEAM_ID);
    res.json({ success: true });
});

app.get('/api/overview/legends', (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const results = db.prepare(`
        SELECT P.name, P.avatar_url, RR.score as best_score, RE.name as type_name, RE.date, RR.ranking
        FROM RaceRecords RR
        JOIN People P ON RR.people_id = P.id
        JOIN RaceEvents RE ON RR.event_id = RE.id
        WHERE RR.team_id = ${TEAM_ID} AND RR.global_honor_expires_at > ?
        ORDER BY RR.global_honor_expires_at DESC
    `).all(now);
    res.json(results);
});

app.get('/api/overview/forecast', (req, res) => {
    const results = db.prepare(`
        SELECT id, name, date, location, series_id
        FROM RaceEvents
        WHERE team_id = ${TEAM_ID} AND date >= date('now')
        ORDER BY date ASC
        LIMIT 10
    `).all();
    res.json(results);
});

app.get('/api/settings/course-system', async (req, res) => {
    const status = await KV.get("COURSE_SYSTEM_STATUS");
    res.json(status || { enabled: true });
});

app.post('/api/settings/course-system', async (req, res) => {
    await KV.put("COURSE_SYSTEM_STATUS", JSON.stringify(req.body));
    res.json({ success: true });
});

app.get('/api/settings/ticket-pricing', async (req, res) => {
    const pricing = await KV.get("TICKET_PRICING");
    const defaults = { regular_price: 400, racing_price: 700, group_practice_price: 150, special_tiers: [] };
    res.json(pricing || defaults);
});

app.post('/api/settings/ticket-pricing', async (req, res) => {
    await KV.put("TICKET_PRICING", JSON.stringify(req.body));
    res.json({ success: true });
});

app.get('/api/settings/push-templates', async (req, res) => {
    const templates = await KV.get("PUSH_TEMPLATES");
    res.json(templates || {});
});

app.post('/api/settings/push-templates', async (req, res) => {
    await KV.put("PUSH_TEMPLATES", JSON.stringify(req.body));
    res.json({ success: true });
});

app.get('/api/settings/bank-account', async (req, res) => {
    const account = await KV.get("BANK_ACCOUNT");
    res.json(account || { bank_code: '', account_number: '' });
});

app.post('/api/settings/bank-account', async (req, res) => {
    await KV.put("BANK_ACCOUNT", JSON.stringify(req.body));
    res.json({ success: true });
});

app.get('/api/finance/report', (req, res) => {
    const range = String(req.query.month || ''); // Reusing 'month' param for range string to keep API simple or use a new param
    let whereClause = `WHERE team_id = ${TEAM_ID}`;
    const params = [];
    
    // Range logic: 1W, 1M, 3M, ALL, CUSTOM. Default to 1M if not specified or if it looks like a month string
    let startDate = '';
    let endDate = '';
    
    if (range === '1W') {
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else if (range === '1M') {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else if (range === '3M') {
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else if (range && range.startsWith('CUSTOM:')) {
        const parts = range.split(':');
        if (parts.length === 3) {
            startDate = parts[1];
            endDate = parts[2];
        }
    } else if (range && range.match(/^\d{4}-\d{2}$/)) {
        // Specific month
        whereClause += ` AND strftime('%Y-%m', created_at) = ?`;
        params.push(range);
    } else if (range === 'ALL') {
        // No date filter
    } else {
        // Default 1M
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    if (startDate) {
        whereClause += ` AND date(created_at) >= ?`;
        params.push(startDate);
    }
    
    if (endDate) {
        whereClause += ` AND date(created_at) <= ?`;
        params.push(endDate);
    }

    const revenue = db.prepare(`SELECT SUM(amount_cash) as total FROM FinancialRecords ${whereClause} AND transaction_type = 'DEPOSIT'`).get(...params);
    const sold = db.prepare(`SELECT SUM(amount_ticket) as total FROM FinancialRecords ${whereClause} AND transaction_type = 'DEPOSIT'`).get(...params);
    const used = db.prepare(`SELECT SUM(ABS(amount_ticket)) as total FROM FinancialRecords ${whereClause} AND transaction_type = 'SPEND'`).get(...params);

    // Daily Stats for Chart
    const daily = db.prepare(`SELECT date(created_at) as date, SUM(amount_cash) as amount, SUM(amount_ticket) as tickets FROM FinancialRecords ${whereClause} AND transaction_type = 'DEPOSIT' GROUP BY date(created_at) ORDER BY date ASC`).all(...params);

    // Monthly Stats for the last year (Fixed range: last 12 months)
    // Use Taiwan time (+8) for consistent reporting
    const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const months = [];
    let y = now.getUTCFullYear();
    let m = now.getUTCMonth() + 1; // 1-12
    
    for (let i = 0; i < 12; i++) {
        months.unshift(`${y}-${String(m).padStart(2, '0')}`);
        m--;
        if (m === 0) {
            m = 12;
            y--;
        }
    }
    
    const oneYearAgo = months[0] + '-01';
    
    const monthlyData = db.prepare(`
        SELECT strftime('%Y-%m', datetime(created_at, '+8 hours')) as month, 
               SUM(amount_cash) as revenue, 
               SUM(amount_ticket) as sold 
        FROM FinancialRecords 
        WHERE team_id = ${TEAM_ID} 
          AND transaction_type = 'DEPOSIT' 
          AND date(datetime(created_at, '+8 hours')) >= ?
        GROUP BY strftime('%Y-%m', datetime(created_at, '+8 hours'))
    `).all(oneYearAgo);

    const monthlyMap = new Map(monthlyData.map((m: any) => [m.month, m]));
    const monthly = months.map(m => monthlyMap.get(m) || { month: m, revenue: 0, sold: 0 });

    res.json({
        total_revenue: revenue?.total || 0,
        tickets_sold: sold?.total || 0,
        tickets_used: used?.total || 0,
        daily_stats: daily,
        monthly_stats: monthly
    });
});

app.get('/api/finance/history', (req, res) => {
    const pid = req.query.people_id;
    let query = `SELECT * FROM FinancialRecords WHERE team_id = ${TEAM_ID}`;
    const params = [];
    if (pid) {
        query += ` AND people_id = ?`;
        params.push(pid);
    }
    query += ` ORDER BY created_at DESC LIMIT 100`;
    const results = db.prepare(query).all(...params);
    res.json(results);
});

app.post('/api/login', async (req, res) => {
    const { id, password } = req.body;
    const person = db.prepare(`SELECT id, team_id, name, role, roles, password, birthday, avatar_url as s_url, full_photo_url as b_url, bio as myword, is_retired as is_hidden, full_name, created_at FROM People WHERE id = ? AND team_id = ?`).get(id, TEAM_ID) as any;
    if (!person) return res.json({ success: false, msg: "查無此人" });
    
    const inputHash = crypto.createHash('sha256').update(String(password || '').trim()).digest('hex');
    const storedPass = person.password ? String(person.password) : null;
    
    if (!storedPass || inputHash !== storedPass) {
         return res.json({ success: false, msg: "密碼錯誤" });
    }
    
    const token = 'mock-token-' + Date.now();
    await KV.put(`SESSION_${token}`, JSON.stringify(person));
    res.json({ success: true, user: person, token });
});

app.get('/api/race-events', (req, res) => {
    const events = db.prepare(`SELECT id, team_id, series_id, date, name, location, public_url as url FROM RaceEvents WHERE team_id = ${TEAM_ID} ORDER BY date DESC`).all();
    const participants = db.prepare(`SELECT RR.id, RR.people_id, RR.event_id, RR.ranking as race_group, RR.score as value, RR.personal_url as photo_url, RR.note, RR.global_honor_expires_at, COALESCE(RR.is_personal_honor, 0) as is_personal_honor, P.name, P.avatar_url as s_url FROM RaceRecords RR JOIN People P ON RR.people_id = P.id WHERE P.team_id = ${TEAM_ID}`).all();
    const results = events.map(e => ({ ...e, participants: participants.filter(p => p.event_id === e.id) }));
    res.json(results);
});

app.post('/api/race-events', async (req, res) => {
    const { id, name, date, location, series_id, url: eventUrl } = req.body;
    if (id) {
        db.prepare("UPDATE RaceEvents SET name = ?, date = ?, location = ?, series_id = ?, public_url = ? WHERE id = ? AND team_id = ?").run(name, date, location || '', series_id || null, eventUrl || null, id, TEAM_ID);
    } else {
        db.prepare("INSERT INTO RaceEvents (team_id, name, date, location, series_id, public_url) VALUES (?, ?, ?, ?, ?, ?)").run(TEAM_ID, name, date, location || '', series_id || null, eventUrl || null);
        // Push notification logic...
    }
    res.json({ success: true });
});

app.get('/api/race-series', (req, res) => {
    const results = db.prepare(`SELECT * FROM RaceSeries WHERE team_id = ${TEAM_ID}`).all();
    res.json(results);
});

app.post('/api/race-series', (req, res) => {
    const { id, series_name } = req.body;
    if (id) db.prepare("UPDATE RaceSeries SET series_name = ? WHERE id = ? AND team_id = ?").run(series_name, id, TEAM_ID);
    else db.prepare("INSERT INTO RaceSeries (team_id, series_name) VALUES (?, ?)").run(TEAM_ID, series_name);
    res.json({ success: true });
});

app.delete('/api/race-series', (req, res) => {
    const id = req.query.id;
    db.prepare("DELETE FROM RaceSeries WHERE id = ? AND team_id = ?").run(id, TEAM_ID);
    res.json({ success: true });
});

app.post('/api/race-records', (req, res) => {
    const { event_id, people_id, value, race_group, note, photo_url, is_personal_honor } = req.body;
    const safe_value = value || '';
    const safe_race_group = race_group || '';
    const safe_note = note || '';
    const safe_photo_url = (typeof photo_url !== 'undefined') ? photo_url : null;
    
    const existing = db.prepare("SELECT * FROM RaceRecords WHERE event_id = ? AND people_id = ?").get(event_id, people_id);
    let safe_is_personal_honor = 0;
    if (typeof is_personal_honor !== 'undefined') {
        safe_is_personal_honor = is_personal_honor ? 1 : 0;
    } else if (existing) {
        safe_is_personal_honor = existing.is_personal_honor;
    }

    if (existing) {
        db.prepare("UPDATE RaceRecords SET score = ?, ranking = ?, note = ?, personal_url = ?, is_personal_honor = ? WHERE event_id = ? AND people_id = ?")
            .run(safe_value, safe_race_group, safe_note, safe_photo_url || existing.personal_url, safe_is_personal_honor, event_id, people_id);
    } else {
        db.prepare("INSERT INTO RaceRecords (team_id, event_id, people_id, score, ranking, note, personal_url, is_personal_honor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .run(TEAM_ID, event_id, people_id, safe_value, safe_race_group, safe_note, safe_photo_url, safe_is_personal_honor);
    }
    res.json({ success: true });
});

app.delete('/api/race-records', (req, res) => {
    const { event_id, people_id } = req.body;
    db.prepare("DELETE FROM RaceRecords WHERE event_id = ? AND people_id = ?").run(event_id, people_id);
    res.json({ success: true });
});

app.get('/api/training-records', (req, res) => {
    const results = db.prepare(`SELECT R.id, R.date, R.people_id, R.training_type_id, R.score as value, R.note, T.type_name as name, P.name as person_name FROM TrainingRecords R JOIN TrainingTypes T ON R.training_type_id = T.id JOIN People P ON R.people_id = P.id WHERE R.team_id = ${TEAM_ID} ORDER BY R.date DESC, R.id DESC LIMIT 300`).all();
    res.json(results);
});

app.post('/api/training-records', (req, res) => {
    const { people_id, training_type_id, date, value, score, note } = req.body;
    db.prepare("INSERT INTO TrainingRecords (team_id, people_id, training_type_id, date, score, note) VALUES (?, ?, ?, ?, ?, ?)").run(TEAM_ID, people_id, training_type_id, date, value || score, note || '');
    res.json({ success: true });
});

app.put('/api/training-records', (req, res) => {
    const { id, score, date, training_type_id, note } = req.body;
    db.prepare("UPDATE TrainingRecords SET score = ?, date = ?, training_type_id = ?, note = ? WHERE id = ? AND team_id = ?").run(score, date, training_type_id, note || '', id, TEAM_ID);
    res.json({ success: true });
});

app.delete('/api/training-records', (req, res) => {
    const { id } = req.body;
    db.prepare("DELETE FROM TrainingRecords WHERE id = ? AND team_id = ?").run(id, TEAM_ID);
    res.json({ success: true });
});

app.get('/api/training-types', (req, res) => {
    const results = db.prepare(`SELECT * FROM TrainingTypes WHERE team_id = ${TEAM_ID}`).all();
    res.json(results);
});

app.post('/api/training-types', (req, res) => {
    const { id, type_name, is_default } = req.body;
    if (id) db.prepare("UPDATE TrainingTypes SET type_name = ?, is_default = ? WHERE id = ? AND team_id = ?").run(type_name, is_default?1:0, id, TEAM_ID);
    else db.prepare("INSERT INTO TrainingTypes (team_id, type_name, is_default) VALUES (?, ?, ?)").run(TEAM_ID, type_name, is_default?1:0);
    res.json({ success: true });
});

app.delete('/api/training-types', (req, res) => {
    const id = req.query.id;
    db.prepare("DELETE FROM TrainingTypes WHERE id = ? AND team_id = ?").run(id, TEAM_ID);
    res.json({ success: true });
});

app.get('/api/courses/weekly', (req, res) => {
    const start = req.query.start;
    const end = req.query.end;
    
    let query = `SELECT * FROM ClassSessions WHERE team_id = ${TEAM_ID}`;
    const params = [];
    
    if (start) {
        query += ` AND date >= ?`;
        params.push(start);
    } else {
        query += ` AND date >= date('now', '-3 days')`;
    }
    
    if (end) {
        query += ` AND date <= ?`;
        params.push(end);
    }
    
    query += ` ORDER BY date ASC, start_time ASC`;

    const sessions = db.prepare(query).all(...params);
    const enhanced = sessions.map(s => {
        const count = db.prepare("SELECT COUNT(*) as c FROM Enrollments E JOIN People P ON E.people_id = P.id WHERE E.session_id = ? AND E.status != 'CANCELLED' AND P.team_id = ?").get(s.id, TEAM_ID);
        const students = db.prepare(`SELECT E.people_id as id, P.name, P.avatar_url as s_url, E.status, E.note FROM Enrollments E JOIN People P ON E.people_id = P.id WHERE E.session_id = ? AND P.team_id = ?`).all(s.id, TEAM_ID);
        return { ...s, enrolled_count: count.c, students, capacity: s.max_students || 20, category: s.template_id ? (s.category || 'ROUTINE') : 'SPECIAL', ticket_type: s.ticket_type || 'REGULAR', price: s.price || 0 };
    });
    res.json(enhanced);
});

app.post('/api/courses/sessions', async (req, res) => {
    const { id, date, start_time, end_time, name, location, capacity, max_students, category, ticket_type, template_id, price } = req.body;
    const finalCategory = category || (template_id ? 'ROUTINE' : 'SPECIAL');
    
    if (!id) { 
        const result = db.prepare(`INSERT INTO ClassSessions (team_id, template_id, date, start_time, end_time, name, location, max_students, ticket_type, status, category, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`).run(TEAM_ID, template_id || null, date, start_time, end_time, name, location || '', max_students || capacity || 20, ticket_type || 'NONE', finalCategory, price || 0);
        await enrollDefaultStudents(result.lastInsertRowid, template_id);
        res.json({ success: true, id: result.lastInsertRowid });
    } else {
        db.prepare(`UPDATE ClassSessions SET date=?, start_time=?, end_time=?, name=?, location=?, max_students=?, ticket_type=?, price=?, category=? WHERE id=? AND team_id=?`).run(date, start_time, end_time, name, location || '', max_students || capacity || 20, ticket_type || 'NONE', price || 0, finalCategory, id, TEAM_ID);
        res.json({ success: true, id });
    }
});

app.delete('/api/courses/sessions', (req, res) => {
    const id = req.query.id;
    db.prepare("DELETE FROM ClassSessions WHERE id = ?").run(id);
    db.prepare("DELETE FROM Enrollments WHERE session_id = ?").run(id);
    res.json({ success: true });
});

app.post('/api/courses/session-status', async (req, res) => {
    const { session_id, status } = req.body;
    const session = db.prepare("SELECT status, ticket_type, name, date FROM ClassSessions WHERE id = ? AND team_id = ?").get(session_id, TEAM_ID);
    if (!session) return res.json({ success: false });

    db.prepare("UPDATE ClassSessions SET status = ? WHERE id = ? AND team_id = ?").run(status, session_id, TEAM_ID);
    
    const enrollments = db.prepare(`SELECT people_id FROM Enrollments WHERE session_id = ? AND status = 'ENROLLED'`).all(session_id);
    if (session.ticket_type && session.ticket_type !== 'NONE') {
        if (status === 'CONFIRMED' && session.status !== 'CONFIRMED') {
            for (const p of enrollments) await deductTickets(p.people_id, session.ticket_type, 1, true, session.name);
        } else if (status === 'CANCELLED' && session.status === 'CONFIRMED') {
            for (const p of enrollments) await refundTickets(p.people_id, session.ticket_type, 1, '課程取消');
        }
    }
    res.json({ success: true });
});

app.post('/api/courses/join', async (req, res) => {
    const { session_id, people_id } = req.body;
    const existing = db.prepare("SELECT * FROM Enrollments WHERE session_id = ? AND people_id = ?").get(session_id, people_id);
    if (existing) db.prepare("UPDATE Enrollments SET status = 'ENROLLED' WHERE id = ?").run(existing.id);
    else db.prepare("INSERT INTO Enrollments (session_id, people_id, status) VALUES (?, ?, 'ENROLLED')").run(session_id, people_id);
    res.json({ success: true });
});

app.post('/api/courses/exit', (req, res) => {
    const { session_id, people_id, reason } = req.body;
    db.prepare("UPDATE Enrollments SET status = 'CANCELLED', note = ? WHERE session_id = ? AND people_id = ?").run(reason, session_id, people_id);
    res.json({ success: true });
});

app.get('/api/courses/templates', (req, res) => {
    const results = db.prepare(`SELECT * FROM CourseTemplates WHERE team_id = ${TEAM_ID}`).all();
    res.json(results);
});

app.post('/api/courses/templates', (req, res) => {
    const body = req.body;
    if (body.id) {
        db.prepare(`UPDATE CourseTemplates SET name=?, day_of_week=?, start_time=?, end_time=?, location=?, price=?, max_students=?, ticket_type=?, default_student_ids=?, is_auto_scheduled=? WHERE id=?`).run(body.name, body.day_of_week, body.start_time, body.end_time, body.location, body.price, body.max_students, body.ticket_type, JSON.stringify(body.default_student_ids), body.is_auto_scheduled ? 1 : 0, body.id);
    } else {
        db.prepare(`INSERT INTO CourseTemplates (team_id,name,day_of_week,start_time,end_time,location,price,max_students,ticket_type,default_student_ids,is_auto_scheduled) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(TEAM_ID, body.name, body.day_of_week, body.start_time, body.end_time, body.location, body.price, body.max_students, body.ticket_type, JSON.stringify(body.default_student_ids), body.is_auto_scheduled ? 1 : 0);
    }
    res.json({ success: true });
});

app.delete('/api/courses/templates', (req, res) => {
    db.prepare(`DELETE FROM CourseTemplates WHERE id=?`).run(req.query.id);
    res.json({ success: true });
});

app.get('/api/tickets/wallets', (req, res) => {
    const batches = db.prepare(`SELECT B.id as batch_id, P.id as people_id, P.name as person_name, B.ticket_type, B.remaining_amount, B.expiry_date FROM People P JOIN TicketBatches B ON P.id = B.people_id WHERE P.team_id = ${TEAM_ID} AND (B.remaining_amount != 0) AND (B.expiry_date >= DATE('now') OR B.remaining_amount < 0) ORDER BY P.id, B.expiry_date ASC`).all();
    const grouped = {};
    batches.forEach(b => {
        if (!grouped[b.people_id]) grouped[b.people_id] = { people_id: b.people_id, person_name: b.person_name, regular_balance: 0, racing_balance: 0, batches: [] };
        const g = grouped[b.people_id];
        g.batches.push({ id: b.batch_id, type: b.ticket_type, amount: b.remaining_amount, expiry_date: b.expiry_date });
        if (b.ticket_type === 'REGULAR') g.regular_balance += b.remaining_amount;
        if (b.ticket_type === 'RACING') g.racing_balance += b.remaining_amount;
    });
    res.json(Object.values(grouped));
});

app.post('/api/tickets/purchase', async (req, res) => {
    const { people_id, type, amount, last_5_digits, total_price } = req.body;
    db.prepare(`INSERT INTO TicketRequests (team_id, people_id, type, amount, last_5_digits, total_price) VALUES (?, ?, ?, ?, ?, ?)`).run(TEAM_ID, people_id, type, amount, last_5_digits, total_price || 0);
    
    const person = db.prepare("SELECT name FROM People WHERE id = ?").get(people_id);
    await createNotificationForRole('COACH', `購票申請: ${person?.name}`, '/?page=settings&target=coach_requests');
    
    res.json({ success: true });
});

app.post('/api/tickets/add', async (req, res) => {
    const { people_id, type, amount, expiry_date, note, price_paid } = req.body;
    const expiry = expiry_date || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
    let remainingToAdd = parseInt(amount);
    
    if (remainingToAdd > 0) {
        const debts = db.prepare(`SELECT id, remaining_amount FROM TicketBatches WHERE people_id = ? AND ticket_type = ? AND remaining_amount < 0 ORDER BY expiry_date ASC`).all(people_id, type);
        for (const debt of debts) {
            if (remainingToAdd <= 0) break;
            const debtValue = Math.abs(debt.remaining_amount);
            if (remainingToAdd >= debtValue) { 
                db.prepare("DELETE FROM TicketBatches WHERE id = ?").run(debt.id); 
                remainingToAdd -= debtValue; 
            } else { 
                db.prepare("UPDATE TicketBatches SET remaining_amount = remaining_amount + ? WHERE id = ?").run(remainingToAdd, debt.id); 
                remainingToAdd = 0; 
            }
        }
    }
    if (remainingToAdd > 0) {
        db.prepare(`INSERT INTO TicketBatches (team_id, people_id, ticket_type, initial_amount, remaining_amount, expiry_date) VALUES (?, ?, ?, ?, ?, ?)`).run(TEAM_ID, people_id, type, remainingToAdd, remainingToAdd, expiry);
    }
    await logFinance({ peopleId: people_id, type: 'DEPOSIT', amountTicket: amount, amountCash: price_paid || 0, ticketType: type, note: note || '手動儲值' });
    await createNotification(people_id, `儲值通知: ${amount}張 (${type})`, '/?page=settings&target=rider_history');
    res.json({ success: true });
});

app.post('/api/tickets/manual-add', async (req, res) => {
    const { people_id, type, amount, expiry_date, price, note } = req.body;
    const expiry = expiry_date || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
    
    // Add to TicketBatches
    db.prepare(`INSERT INTO TicketBatches (team_id, people_id, ticket_type, initial_amount, remaining_amount, expiry_date) VALUES (?, ?, ?, ?, ?, ?)`).run(TEAM_ID, people_id, type, amount, amount, expiry);
    
    // Log Finance (DEPOSIT if amount > 0, SPEND if amount < 0)
    const transactionType = amount >= 0 ? 'DEPOSIT' : 'SPEND';
    const logAmount = Math.abs(amount);
    
    db.prepare(`INSERT INTO FinancialRecords (team_id, people_id, transaction_type, amount_cash, amount_ticket, ticket_type, note) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(TEAM_ID, people_id, transactionType, price || 0, logAmount, type, note || '管理員手動調整');

    await createNotification(people_id, `庫存調整: ${amount > 0 ? '+' : ''}${amount}張 (${type})`, '/?page=settings&target=rider_history');
    
    res.json({ success: true });
});

app.get('/api/tickets/requests', (req, res) => {
    const results = db.prepare(`SELECT TR.*, P.name as person_name FROM TicketRequests TR JOIN People P ON TR.people_id = P.id WHERE TR.team_id = ${TEAM_ID} ORDER BY TR.created_at DESC`).all();
    res.json(results);
});

app.delete('/api/tickets/requests', async (req, res) => {
    const id = req.query.id;
    const reason = req.query.reason || '';
    const reqData = db.prepare("SELECT * FROM TicketRequests WHERE id = ?").get(id);
    db.prepare("DELETE FROM TicketRequests WHERE id = ?").run(id);
    if (reqData) {
        db.prepare(`INSERT INTO FinancialRecords (team_id, people_id, transaction_type, amount_cash, amount_ticket, ticket_type, note) VALUES (?, ?, 'REJECTED', 0, ?, ?, ?)`).run(TEAM_ID, reqData.people_id, reqData.amount, reqData.type, `申請被拒: ${reason || '無原因'}`);
        await createNotification(reqData.people_id, `購票申請被拒: ${reason || '無原因'}`, '/?page=settings&target=rider_history');
    }
    res.json({ success: true });
});

app.put('/api/tickets/batch', (req, res) => {
    const { batch_id, amount, expiry_date } = req.body;
    db.prepare(`UPDATE TicketBatches SET remaining_amount = ?, expiry_date = ? WHERE id = ?`).run(amount, expiry_date, batch_id);
    res.json({ success: true });
});

// --- Vite Middleware ---
async function startServer() {
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        // In production, serve static files from dist
        app.use(express.static('dist'));
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
